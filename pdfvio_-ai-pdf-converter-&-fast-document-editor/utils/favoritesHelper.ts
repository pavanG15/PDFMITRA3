import { useState, useEffect, useCallback } from 'react';
import { TOOLS } from '../constants';
import { PDFTool } from '../types';

export const FAVORITES_STORAGE_KEY = 'pixelpro_favorite_tool_ids';
export const FAVORITES_CHANGED_EVENT = 'pixelpro_favorites_changed';

/**
 * Default favorite tools pinned on first app launch.
 * Includes 'id-merge' (Aadhaar / Any ID Card 1-Page), 'merge', 'scan-to-pdf', and 'compress'.
 */
export const DEFAULT_FAVORITE_TOOL_IDS = [
  'id-merge',
  'merge',
  'scan-to-pdf',
  'compress',
];

/**
 * Safely retrieve pinned favorite tool IDs from localStorage.
 */
export function getStoredFavoriteIds(): string[] {
  if (typeof window === 'undefined') return DEFAULT_FAVORITE_TOOL_IDS;

  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) {
      // First-time setup: initialize with defaults
      localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(DEFAULT_FAVORITE_TOOL_IDS)
      );
      return DEFAULT_FAVORITE_TOOL_IDS;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
      // Filter out any IDs that no longer exist in TOOLS
      const validToolIds = new Set(TOOLS.map((t) => t.id));
      const filtered = parsed.filter((id) => validToolIds.has(id));
      return filtered;
    }
  } catch (err) {
    console.warn('[Favorites] Failed to read stored favorites:', err);
  }

  return DEFAULT_FAVORITE_TOOL_IDS;
}

/**
 * Save favorite tool IDs to localStorage and notify all listeners.
 */
export function saveFavoriteIds(ids: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    // Deduplicate and filter valid tools
    const validToolIds = new Set(TOOLS.map((t) => t.id));
    const uniqueIds = Array.from(new Set(ids)).filter((id) => validToolIds.has(id));

    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(uniqueIds));
    window.dispatchEvent(
      new CustomEvent(FAVORITES_CHANGED_EVENT, { detail: uniqueIds })
    );
  } catch (err) {
    console.warn('[Favorites] Failed to persist favorites:', err);
  }
}

/**
 * Check if a tool is pinned.
 */
export function isToolFavorite(toolId: string): boolean {
  const current = getStoredFavoriteIds();
  return current.includes(toolId);
}

/**
 * Toggle favorite state for a tool. Returns the new state (true if pinned, false if unpinned).
 */
export function toggleToolFavorite(toolId: string): boolean {
  const current = getStoredFavoriteIds();
  let updated: string[];
  let isNowFavorite = false;

  if (current.includes(toolId)) {
    updated = current.filter((id) => id !== toolId);
    isNowFavorite = false;
  } else {
    updated = [toolId, ...current]; // Place recently pinned tool at the front
    isNowFavorite = true;
  }

  saveFavoriteIds(updated);
  return isNowFavorite;
}

/**
 * Reorder favorite tools.
 */
export function reorderFavorites(newOrderIds: string[]): void {
  saveFavoriteIds(newOrderIds);
}

/**
 * Reset favorites back to the default list.
 */
export function resetFavoritesToDefault(): string[] {
  saveFavoriteIds(DEFAULT_FAVORITE_TOOL_IDS);
  return DEFAULT_FAVORITE_TOOL_IDS;
}

/**
 * React Hook for consuming and managing pinned favorite tools.
 */
export function useFavoriteTools() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    getStoredFavoriteIds()
  );

  useEffect(() => {
    // Update local state when favorites change in any component or tab
    const handleFavoritesChanged = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFavoriteIds(customEvent.detail);
      } else {
        setFavoriteIds(getStoredFavoriteIds());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === FAVORITES_STORAGE_KEY) {
        setFavoriteIds(getStoredFavoriteIds());
      }
    };

    window.addEventListener(FAVORITES_CHANGED_EVENT, handleFavoritesChanged);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(
        FAVORITES_CHANGED_EVENT,
        handleFavoritesChanged
      );
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const isFavorite = useCallback(
    (toolId: string) => favoriteIds.includes(toolId),
    [favoriteIds]
  );

  const toggle = useCallback((toolId: string) => {
    return toggleToolFavorite(toolId);
  }, []);

  const pin = useCallback((toolId: string) => {
    const current = getStoredFavoriteIds();
    if (!current.includes(toolId)) {
      saveFavoriteIds([toolId, ...current]);
    }
  }, []);

  const unpin = useCallback((toolId: string) => {
    const current = getStoredFavoriteIds();
    saveFavoriteIds(current.filter((id) => id !== toolId));
  }, []);

  const reset = useCallback(() => {
    return resetFavoritesToDefault();
  }, []);

  // Map favorite IDs to full PDFTool objects in preservation order
  const favoriteTools = favoriteIds
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter((t): t is PDFTool => Boolean(t && !t.hidden));

  return {
    favoriteIds,
    favoriteTools,
    isFavorite,
    toggleFavorite: toggle,
    pinFavorite: pin,
    unpinFavorite: unpin,
    resetFavorites: reset,
  };
}
