import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ADMOB_CONFIG,
  REAL_ADMOB_BANNER_ID,
  REAL_ADMOB_INTERSTITIAL_ID,
  showSimulatedInterstitialAd,
  isAndroidBridgeAvailable,
  hasNativeBannerSupport,
  showBannerAd,
  hideBannerAd,
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
    // Graceful fallback for sandboxed/restricted WebView environments
  }
  return false;
}

export const BannerAdBar: React.FC<BannerAdBarProps> = ({
  className = '',
  isOverlay = false,
}) => {
  const [isDebug, setIsDebug] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    bridgeAvailable: boolean;
    bannerSupported: boolean;
  }>({ bridgeAvailable: false, bannerSupported: false });

  // Refs to prevent memory leaks if component unmounts while timers are active
  const copyTimeoutRef = useRef<number | null>(null);
  const interstitialTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    console.log('[ADS] BannerAdBar mounted');
    setIsDebug(checkDebugAdMode());

    // Trigger real production Banner Ad unit on native Android bridge
    showBannerAd(REAL_ADMOB_BANNER_ID);

    try {
      setBridgeStatus({
        bridgeAvailable: Boolean(isAndroidBridgeAvailable?.()),
        bannerSupported: Boolean(hasNativeBannerSupport?.()),
      });
    } catch {
      // Fallback if bridge helpers fail
    }

    return () => {
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      if (interstitialTimeoutRef.current) window.clearTimeout(interstitialTimeoutRef.current);
    };
  }, []);

  // Lock background scroll & handle Escape key when diagnostic modal is open
  useEffect(() => {
    if (!showInfoModal) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowInfoModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showInfoModal]);

  // WebView-safe clipboard helper with fallback
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    if (!text) return;
    let copied = false;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {
      copied = false;
    }

    // Fallback for Android WebViews where navigator.clipboard is restricted
    if (!copied && typeof document !== 'undefined') {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        copied = true;
      } catch (err) {
        console.warn('[ADS] Clipboard copy failed:', err);
      }
    }

    if (copied) {
      setCopiedId(label);
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    }
  }, []);

  const handleDisableDebugMode = () => {
    try {
      localStorage.removeItem('debug_ads');
    } catch {
      // Ignore storage errors
    }
    setShowInfoModal(false);
    setIsDebug(false);
  };

  return (
    <>
      <div
        id="admob-banner-slot"
        className={`w-full flex flex-col items-center justify-center shrink-0 min-h-[60px] h-[60px] select-none z-[100] ${
          isOverlay
            ? 'bg-transparent text-slate-400'
            : 'bg-transparent text-slate-500'
        } ${className}`}
        role="region"
        aria-label="Advertisement"
      >
        {/* PRODUCTION MODE: Reserved 60px height for Native Android AdMob overlay */}
        {!isDebug && (
          <div
            className="w-full max-w-[468px] h-[60px] pointer-events-none shrink-0"
            aria-hidden="true"
          />
        )}

        {/* DEBUG MODE ONLY */}
        {isDebug && (
          <div className="w-full max-w-[468px] h-[58px] rounded-xl flex items-center justify-between px-2.5 sm:px-3 border border-amber-300 dark:border-amber-700/60 bg-amber-50/90 dark:bg-amber-950/40 shadow-xs relative overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                DEBUG AD
              </span>
              <div className="flex flex-col -space-y-0.5 min-w-0">
                <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 truncate">
                  AdMob Banner (468×60 / 320×50 Slot)
                </span>
                <span
                  className="text-[8px] font-mono text-slate-500 dark:text-slate-400 truncate"
                  title={REAL_ADMOB_BANNER_ID}
                >
                  Unit: {REAL_ADMOB_BANNER_ID}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-1.5">
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="text-[9px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                title="View AdMob Unit IDs & Android Bridge details"
              >
                <i className="fas fa-circle-info text-[9px]"></i>
                <span>Ad Info</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Developer Diagnostic Modal */}
      {isDebug && showInfoModal && (
        <div
          className="fixed inset-0 z-[1000000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[88vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs">
                  GOOGLE ADMOB
                </span>
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Ad Configuration
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                aria-label="Close modal"
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center text-xs transition-colors"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            {/* Android Native Bridge Status */}
            <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                Android Native Bridge:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  bridgeStatus.bridgeAvailable
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
              >
                {bridgeStatus.bridgeAvailable ? 'Connected' : 'Web Browser Mode'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              Google AdMob production unit ID configured for the app:
            </p>

            {/* Ad Unit IDs List */}
            <div className="space-y-3 mb-5">
              {[
                {
                  key: 'banner',
                  label: 'Real Banner Ad Unit ID (Bannerpdf)',
                  value: REAL_ADMOB_BANNER_ID,
                },
                {
                  key: 'interstitial',
                  label: 'Real Interstitial Ad Unit ID',
                  value: REAL_ADMOB_INTERSTITIAL_ID,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {item.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.value, item.key)}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                    >
                      {copiedId === item.key ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 break-all select-all">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Test Actions */}
            <div className="space-y-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowInfoModal(false);
                  if (interstitialTimeoutRef.current) {
                    window.clearTimeout(interstitialTimeoutRef.current);
                  }
                  interstitialTimeoutRef.current = window.setTimeout(() => {
                    showSimulatedInterstitialAd(undefined, REAL_ADMOB_INTERSTITIAL_ID);
                  }, 150);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <i className="fas fa-play"></i>
                <span>Test Interstitial Ad Now</span>
              </button>

              {bridgeStatus.bannerSupported && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => showBannerAd?.()}
                    className="flex-1 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all"
                  >
                    Show Native Banner
                  </button>
                  <button
                    type="button"
                    onClick={() => hideBannerAd?.()}
                    className="flex-1 py-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider active:scale-95 transition-all"
                  >
                    Hide Native Banner
                  </button>
                </div>
              )}
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDisableDebugMode}
                className="text-[10px] text-rose-500 hover:underline font-bold"
              >
                Hide Debug Bar
              </button>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold px-3 py-1"
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