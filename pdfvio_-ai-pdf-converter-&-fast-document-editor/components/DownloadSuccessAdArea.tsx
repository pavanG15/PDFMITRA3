import React, { useEffect, useRef, useState } from 'react';
import {
  isAndroidBridgeAvailable,
  AndroidBridgeInterface,
  AnchorPositionData,
} from '../utils/shareHelper';

interface DownloadSuccessAdAreaProps {
  downloadKey?: string;
  className?: string;
}

/**
 * Checks if debug ad mode is explicitly requested via URL param or localStorage
 */
function checkDebugAdMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugAds') === 'true' || params.get('debug_ads') === 'true') {
      return true;
    }
    if (localStorage.getItem('debug_ads') === 'true') {
      return true;
    }
  } catch {
    // Graceful fallback
  }
  return false;
}

/**
 * Measure the exact bounding box of the anchor container in both CSS pixels
 * and Android physical screen pixels, plus viewport scroll offsets.
 */
function measureAnchor(element: HTMLElement | null): AnchorPositionData | null {
  if (!element || typeof window === 'undefined') return null;
  const rect = element.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  return {
    id: element.id || 'download-success-ad-container',
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    physicalX: Math.round(rect.left * dpr),
    physicalY: Math.round(rect.top * dpr),
    physicalWidth: Math.round(rect.width * dpr),
    physicalHeight: Math.round(rect.height * dpr),
    scrollX: Math.round(window.scrollX || window.pageXOffset || 0),
    scrollY: Math.round(window.scrollY || window.pageYOffset || 0),
    dpr: Number(dpr.toFixed(2)),
  };
}

/**
 * Sends show ad instruction with anchor coordinates to AndroidBridge
 */
function notifyAndroidShowAd(anchor: AnchorPositionData | null): void {
  if (!isAndroidBridgeAvailable()) return;
  const bridge = window.AndroidBridge as AndroidBridgeInterface | undefined;
  const anchorJson = JSON.stringify(anchor || {});

  try {
    if (typeof bridge?.showDownloadSuccessAdWithAnchor === 'function') {
      bridge.showDownloadSuccessAdWithAnchor(anchorJson);
      return;
    }
    if (typeof bridge?.positionAdAtAnchor === 'function') {
      bridge.positionAdAtAnchor('download-success-ad-container', anchorJson);
      return;
    }
    if (typeof bridge?.showDownloadSuccessAd === 'function') {
      bridge.showDownloadSuccessAd(anchorJson);
      return;
    }
    if (typeof bridge?.showNativeAd === 'function') {
      bridge.showNativeAd('download_success');
      return;
    }
    if (typeof bridge?.onDownloadSuccess === 'function') {
      bridge.onDownloadSuccess();
      return;
    }
  } catch (err) {
    console.error('[ADS-WEB] Failed to notify Android bridge for show ad:', err);
  }
}

/**
 * Sends hide ad instruction to AndroidBridge
 */
function notifyAndroidHideAd(): void {
  if (!isAndroidBridgeAvailable()) return;
  const bridge = window.AndroidBridge as AndroidBridgeInterface | undefined;

  try {
    if (typeof bridge?.hideDownloadSuccessAd === 'function') {
      bridge.hideDownloadSuccessAd();
      return;
    }
    if (typeof bridge?.hideBannerAd === 'function') {
      bridge.hideBannerAd();
      return;
    }
  } catch (err) {
    console.warn('[ADS-WEB] Failed to notify Android bridge for hide ad:', err);
  }
}

/**
 * Dedicated Success-Area Advertisement Container:
 * Located inside the Download Complete card.
 *
 * Renders a stable anchor slot (<div id="download-success-ad-container">)
 * with responsive width and reserved 60px height so the native AdMob ad
 * (468x60 or 320x50) fits inside without overlapping any buttons.
 *
 * Communicates viewport visibility and anchor position coordinates to Android native layer.
 */
export const DownloadSuccessAdArea: React.FC<DownloadSuccessAdAreaProps> = ({
  className = '',
}) => {
  const [isDebug, setIsDebug] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);

  // Guards against duplicate bridge calls on simple re-renders
  const hasLoggedContainerRef = useRef<boolean>(false);
  const hasRequestedAdRef = useRef<boolean>(false);
  const isVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    setIsDebug(checkDebugAdMode());

    const containerEl = containerRef.current || document.getElementById('download-success-ad-container');
    const slotEl = slotRef.current || document.getElementById('native-download-success-slot');

    // Requirement: [ADS-WEB] Download success ad container found
    if (containerEl && !hasLoggedContainerRef.current) {
      hasLoggedContainerRef.current = true;
      console.log('[ADS-WEB] Download success ad container found');
    }

    // Set up IntersectionObserver to track when the ad section becomes visible/hidden in viewport
    let observer: IntersectionObserver | null = null;

    const handleVisibilityChange = (isIntersecting: boolean) => {
      if (isIntersecting) {
        if (!isVisibleRef.current) {
          isVisibleRef.current = true;
          // Requirement: [ADS-WEB] Advertisement section visible
          console.log('[ADS-WEB] Advertisement section visible');

          // Requirement: [ADS-WEB] Download success ad requested (only when visible)
          if (!hasRequestedAdRef.current) {
            hasRequestedAdRef.current = true;
            console.log('[ADS-WEB] Download success ad requested');
          }

          const anchor = measureAnchor(slotEl || containerEl);
          notifyAndroidShowAd(anchor);
        }
      } else {
        if (isVisibleRef.current) {
          isVisibleRef.current = false;
          // Requirement: [ADS-WEB] Advertisement section hidden
          console.log('[ADS-WEB] Advertisement section hidden');
          notifyAndroidHideAd();
        }
      }
    };

    if (containerEl && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            handleVisibilityChange(entry.isIntersecting);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerEl);
    } else {
      // Fallback if IntersectionObserver not available in older WebViews
      handleVisibilityChange(true);
    }

    // Update anchor coordinates on window scroll/resize if ad is visible
    let scrollRafId: number | null = null;
    const handleScrollOrResize = () => {
      if (!isVisibleRef.current) return;
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      scrollRafId = requestAnimationFrame(() => {
        const anchor = measureAnchor(slotEl || containerEl);
        if (anchor && isAndroidBridgeAvailable()) {
          const bridge = window.AndroidBridge as AndroidBridgeInterface | undefined;
          if (typeof bridge?.positionAdAtAnchor === 'function') {
            bridge.positionAdAtAnchor('download-success-ad-container', JSON.stringify(anchor));
          }
        }
      });
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    // Cleanup: hide ad when component unmounts or section disappears
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);

      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        // Requirement: [ADS-WEB] Advertisement section hidden
        console.log('[ADS-WEB] Advertisement section hidden');
        notifyAndroidHideAd();
      }
    };
  }, []);

  return (
    <div
      id="download-success-ad-container"
      ref={containerRef}
      className={`w-full mt-4 pt-3.5 border-t border-emerald-200/80 dark:border-emerald-800/80 flex flex-col items-center justify-center select-none ${className}`}
      role="region"
      aria-label="Advertisement"
    >
      {/* Visual Separator & Muted Label */}
      <div className="flex items-center gap-2 mb-2 text-slate-400 dark:text-slate-500">
        <span className="w-8 h-[1px] bg-slate-300 dark:bg-slate-700" />
        <span className="text-[10px] uppercase font-extrabold tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Advertisement
        </span>
        <span className="w-8 h-[1px] bg-slate-300 dark:bg-slate-700" />
      </div>

      {/*
        Dedicated Native Ad Anchor Slot:
        Responsive width up to 468px (for 468x60 / 320x50 banners).
        Reserves exactly 60px minimum height so the native AdMob ad
        fits cleanly without overlapping buttons or surrounding content.
        No fake HTML ad is rendered here in production.
      */}
      <div
        id="native-download-success-slot"
        ref={slotRef}
        className="w-full max-w-[468px] min-h-[60px] h-[60px] flex items-center justify-center relative overflow-hidden"
      >
        {isDebug ? (
          <div className="w-full h-[60px] rounded-xl flex items-center justify-between px-3 border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 text-[10px]">
            <span className="font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[9px]">
              DEBUG AD
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Native AdMob Anchor (Download Complete Card)
            </span>
          </div>
        ) : (
          <div
            className="w-full h-[60px] pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};

export default DownloadSuccessAdArea;
