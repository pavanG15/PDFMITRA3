import React, { useEffect, useRef, useState } from 'react';
import {
  isAndroidBridgeAvailable,
  triggerDownloadSuccessAd,
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
 * Dedicated Success-Area Advertisement Container:
 * Displayed strictly after download completion in a clearly separated area
 * below the success details and action buttons.
 *
 * Prevents overlapping with buttons and avoids fake HTML ad impressions in production.
 * Transparently reserves space for Android native layer AdMob rendering.
 */
export const DownloadSuccessAdArea: React.FC<DownloadSuccessAdAreaProps> = ({
  downloadKey,
  className = '',
}) => {
  const [isDebug, setIsDebug] = useState<boolean>(false);
  const hasTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    setIsDebug(checkDebugAdMode());

    // Trigger ad only once upon mounting this success-area container
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      triggerDownloadSuccessAd(downloadKey);
    }
  }, [downloadKey]);

  return (
    <div
      id="download-success-ad-container"
      className={`w-full mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center select-none ${className}`}
      role="region"
      aria-label="Advertisement"
    >
      {/* Visual Separator & Muted Label */}
      <div className="flex items-center gap-2 mb-2 text-slate-400 dark:text-slate-500">
        <span className="w-8 h-[1px] bg-slate-300 dark:bg-slate-700" />
        <span className="text-[10px] uppercase font-extrabold tracking-[0.2em]">
          Advertisement
        </span>
        <span className="w-8 h-[1px] bg-slate-300 dark:bg-slate-700" />
      </div>

      {/*
        Native Android AdMob Slot:
        In production, cleanly reserves 320x50 space for Android WebView's native AdMob
        view so layout never jumps and buttons are never blocked.
      */}
      <div
        id="native-download-success-slot"
        className="w-[320px] max-w-full min-h-[50px] flex items-center justify-center"
      >
        {isDebug ? (
          <div className="w-full h-[50px] rounded-xl flex items-center justify-between px-3 border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 text-[10px]">
            <span className="font-black bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[9px]">
              DEBUG AD
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Native AdMob Slot (Download Success)
            </span>
          </div>
        ) : (
          <div
            className="w-[320px] max-w-full h-[50px] pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};

export default DownloadSuccessAdArea;
