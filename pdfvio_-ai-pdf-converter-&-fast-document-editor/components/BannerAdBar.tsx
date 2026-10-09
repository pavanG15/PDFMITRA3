import React, { useEffect, useState, useRef } from 'react';
import {
  ADMOB_TEST_CONFIG,
  showSimulatedInterstitialAd,
  isAndroidBridgeAvailable,
  hasNativeBannerSupport,
  AndroidBridgeInterface,
} from '../utils/shareHelper';

interface BannerAdBarProps {
  className?: string;
  isOverlay?: boolean;
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
    // Graceful fallback for sandboxed/restricted environments
  }
  return false;
}

/**
 * Universal Banner Ad Slot (Adaptive / 320x50 Banner)
 * Communicates with the native Android layer via window.AndroidBridge.showBannerAd().
 * In production, renders a clean reserved layout container without fake test ad badges.
 * The diagnostic "TEST AD" placeholder is visible ONLY behind an explicit DEBUG flag.
 */
export const BannerAdBar: React.FC<BannerAdBarProps> = ({ className = '', isOverlay = false }) => {
  const [isDebug, setIsDebug] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Guard ref to ensure showBannerAd() is called once on mount and not repeated on simple re-renders
  const hasRequestedBannerRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Mandatory console debugging: component mounted
    console.log('[ADS] BannerAdBar mounted');
    setIsDebug(checkDebugAdMode());
    // Note: showBannerAd() is NOT called here to prevent fixed bottom ads on Android screen.
    // Ads are strictly anchored to the Download Complete section.
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(label);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <>
      <div
        id="admob-banner-slot"
        className={`w-full flex flex-col items-center justify-center shrink-0 min-h-[50px] py-1 select-none z-[100] ${
          isOverlay
            ? 'bg-transparent text-slate-400'
            : 'bg-transparent text-slate-500'
        } ${className}`}
        role="region"
        aria-label="Advertisement"
      >
        {/*
          PRODUCTION MODE (Default):
          Clean, transparent reserved banner space (320x50 / adaptive)
          so the layout does not jump when native Android AdMob banner loads.
          No fake test impressions are shown to end users.
        */}
        {!isDebug && (
          <div
            className="w-[320px] max-w-full h-[50px] pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/*
          DEBUG MODE ONLY:
          Rendered ONLY when ?debugAds=true or localStorage.getItem('debug_ads') === 'true'.
          Allows developers to verify test unit IDs and test interstitials.
        */}
        {isDebug && (
          <div className="w-[340px] max-w-full h-[52px] rounded-xl flex items-center justify-between px-2.5 sm:px-3 border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 shadow-xs relative overflow-hidden group">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                DEBUG AD
              </span>
              <div className="flex flex-col -space-y-0.5 min-w-0">
                <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 truncate">
                  AdMob Banner (320×50 Slot)
                </span>
                <span
                  className="text-[8px] font-mono text-slate-400 dark:text-slate-500 truncate"
                  title={ADMOB_TEST_CONFIG.bannerUnitId}
                >
                  Test ID: {ADMOB_TEST_CONFIG.bannerUnitId}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-1.5">
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="text-[9px] font-bold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1 cursor-pointer"
                title="View AdMob Test IDs & Android Bridge details"
              >
                <i className="fas fa-circle-info text-[9px]"></i>
                <span className="hidden xs:inline">Test IDs</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Developer Diagnostic Modal (Only accessible in DEBUG mode) */}
      {isDebug && showInfoModal && (
        <div className="fixed inset-0 z-[1000000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs">
                  GOOGLE ADMOB
                </span>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Diagnostic Test IDs
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Google AdMob requires sample test unit IDs during development so your account is never flagged for invalid impressions or self-clicks.
            </p>

            {/* Test IDs List */}
            <div className="space-y-3 mb-5">
              {/* App ID */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Android App ID (Manifest)</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(ADMOB_TEST_CONFIG.appId, 'appId')}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    {copiedId === 'appId' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 break-all select-all">
                  {ADMOB_TEST_CONFIG.appId}
                </div>
              </div>

              {/* Banner Unit ID */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Banner Ad Unit ID</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(ADMOB_TEST_CONFIG.bannerUnitId, 'banner')}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    {copiedId === 'banner' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 break-all select-all">
                  {ADMOB_TEST_CONFIG.bannerUnitId}
                </div>
              </div>

              {/* Interstitial Unit ID */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Interstitial Ad Unit ID</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(ADMOB_TEST_CONFIG.interstitialUnitId, 'interstitial')}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    {copiedId === 'interstitial' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 break-all select-all">
                  {ADMOB_TEST_CONFIG.interstitialUnitId}
                </div>
              </div>
            </div>

            {/* Test Actions */}
            <div className="space-y-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowInfoModal(false);
                  setTimeout(() => showSimulatedInterstitialAd(), 150);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <i className="fas fa-play"></i>
                <span>Test Interstitial Ad Now</span>
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BannerAdBar;
