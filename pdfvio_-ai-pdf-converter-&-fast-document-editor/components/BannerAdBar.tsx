import React, { useEffect } from 'react';
import { showBannerAd } from '../utils/shareHelper';

interface BannerAdBarProps {
  className?: string;
  isOverlay?: boolean;
}

/**
 * Universal Banner Ad Slot (320x50 / Adaptive Banner)
 * Ensures dedicated space at the bottom of pages and overlays so native
 * Android AdMob Banner Ad displays cleanly without obscuring buttons,
 * and notifies AndroidBridge.showBannerAd() / refreshBannerAd()
 */
export const BannerAdBar: React.FC<BannerAdBarProps> = ({ className = '', isOverlay = false }) => {
  useEffect(() => {
    // Request Android bridge to show and refresh banner ad for this screen
    showBannerAd();
  }, []);

  return (
    <div
      id="admob-banner-slot"
      className={`w-full flex flex-col items-center justify-center shrink-0 min-h-[58px] py-1 select-none z-[100] ${
        isOverlay
          ? 'bg-black/70 border-t border-white/10 text-white/70'
          : 'bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/80 text-slate-600 dark:text-slate-400'
      } ${className}`}
      role="complementary"
      aria-label="Banner Advertisement Slot"
    >
      {/* 320x50 Standard AdMob Banner Frame */}
      <div className="w-[320px] max-w-full h-[50px] rounded-xl flex items-center justify-between px-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.5 rounded-md shadow-xs">
            AD
          </span>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            AdMob Banner (320×50)
          </span>
        </div>
        <div className="text-[9px] text-slate-400 dark:text-slate-600 font-mono">
          AdSpace
        </div>
      </div>
    </div>
  );
};

export default BannerAdBar;
