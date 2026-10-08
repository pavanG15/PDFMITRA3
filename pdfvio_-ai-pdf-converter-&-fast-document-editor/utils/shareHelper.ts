/**
 * Universal Android WebView Bridge & Web Share Helper
 * Converts generated PDF/JPG files to Base64 strings and invokes
 * AndroidBridge.shareFile(base64Data, fileName) for native Android sharing.
 */

/**
 * Universal Android WebView Bridge & Web Share Helper
 * Converts generated PDF/JPG files to Base64 strings and invokes
 * AndroidBridge.shareFile(base64Data, fileName) for native Android sharing,
 * and communicates with native AdMob banner and interstitial ads.
 */

export interface AndroidBridgeInterface {
  shareFile?: (base64Data: string, fileName: string) => void;
  showInterstitialAd?: () => void;
  showInterstitialAdForDownload?: () => void;
  showAd?: () => void;
  showInterstitial?: () => void;
  showBannerAd?: (page?: string) => void;
  refreshBannerAd?: (page?: string) => void;
  hideBannerAd?: () => void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
    onInterstitialClosedForDownload?: (success?: boolean) => void;
  }
}

/**
 * Checks whether the native AndroidBridge is present in the current runtime environment
 */
export function isAndroidBridgeAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.AndroidBridge === 'object' &&
    window.AndroidBridge !== null
  );
}

/**
 * Checks whether the native bridge provides banner ad controls
 */
export function hasNativeBannerSupport(): boolean {
  if (!isAndroidBridgeAvailable()) return false;
  const bridge = window.AndroidBridge;
  return (
    typeof bridge?.showBannerAd === 'function' ||
    typeof bridge?.refreshBannerAd === 'function'
  );
}

/**
 * Triggers Banner Ad to display/refresh via AndroidBridge.showBannerAd(page)
 * or AndroidBridge.refreshBannerAd(page) on route navigation.
 */
export function showBannerAd(page?: string): boolean {
  try {
    if (typeof window !== 'undefined' && window.AndroidBridge) {
      console.log('[ADS] AndroidBridge detected');
      const bridge = window.AndroidBridge;
      if (typeof bridge.refreshBannerAd === 'function') {
        console.log('[ADS] showBannerAd() called');
        bridge.refreshBannerAd(page || '');
        return true;
      }
      if (typeof bridge.showBannerAd === 'function') {
        console.log('[ADS] showBannerAd() called');
        bridge.showBannerAd(page || '');
        return true;
      }
      console.warn('[ADS] AndroidBridge detected but showBannerAd/refreshBannerAd is not a function');
      return false;
    }
    console.log('[ADS] AndroidBridge unavailable');
    return false;
  } catch (err) {
    console.error('[ADS] Banner request failed from web bridge', err);
    return false;
  }
}

/**
 * Hides Banner Ad via AndroidBridge.hideBannerAd()
 */
export function hideBannerAd(): boolean {
  try {
    if (
      typeof window !== 'undefined' &&
      window.AndroidBridge &&
      typeof window.AndroidBridge.hideBannerAd === 'function'
    ) {
      console.log('[ADS] Invoking AndroidBridge.hideBannerAd()');
      window.AndroidBridge.hideBannerAd();
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.warn('[ADS] Error calling hideBannerAd:', err);
    return false;
  }
}

export const ADMOB_TEST_CONFIG = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerUnitId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialUnitId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
  appOpenUnitId: 'ca-app-pub-3940256099942544/9257395921',
};

/**
 * Renders a simulated AdMob Test Interstitial Ad modal in browser preview
 * so developers and users can verify the ad flow and see test IDs in action.
 */
export function showSimulatedInterstitialAd(onClose?: () => void): void {
  if (typeof document === 'undefined') return;
  // If an ad is already showing, don't duplicate
  if (document.getElementById('admob-simulated-interstitial')) return;

  const overlay = document.createElement('div');
  overlay.id = 'admob-simulated-interstitial';
  overlay.className = 'fixed inset-0 z-[999999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200';
  
  let countdown = 2;

  overlay.innerHTML = `
    <div class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200">
      <!-- Google AdMob Test Ad Header -->
      <div class="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-xs">
            TEST AD
          </span>
          <span class="text-xs font-bold text-slate-300">
            Google AdMob Interstitial
          </span>
        </div>
        <button id="admob-close-btn" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold transition-all disabled:opacity-40" disabled title="Close Ad">
          <span id="admob-timer-count">${countdown}s</span>
        </button>
      </div>

      <!-- Ad Content Creative -->
      <div class="p-6 flex flex-col items-center text-center bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-950">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-500/30 mb-4">
          <i class="fas fa-file-pdf"></i>
        </div>
        <h3 class="text-lg font-black text-slate-900 dark:text-white mb-1">
          PDFVio Pro Features
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
          High-resolution 300 DPI A4 Aadhaar Card Merge, instant conversion, & offline local file security.
        </p>

        <!-- Test ID Info Box -->
        <div class="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200 dark:border-slate-700 text-left text-[11px] font-mono space-y-1 mb-5">
          <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 font-sans text-[10px] font-bold uppercase">
            <span>AdMob Test Unit ID</span>
            <span class="text-emerald-600 dark:text-emerald-400">ACTIVE</span>
          </div>
          <div class="text-slate-800 dark:text-slate-200 text-[10px] font-bold break-all select-all">
            ${ADMOB_TEST_CONFIG.interstitialUnitId}
          </div>
        </div>

        <button id="admob-dismiss-btn" class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50" disabled>
          Continue to Download (${countdown}s)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector('#admob-close-btn') as HTMLButtonElement;
  const dismissBtn = overlay.querySelector('#admob-dismiss-btn') as HTMLButtonElement;
  const timerCount = overlay.querySelector('#admob-timer-count') as HTMLElement;

  const dismiss = () => {
    try {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      onClose?.();
    } catch {}
  };

  const timer = setInterval(() => {
    countdown -= 1;
    if (countdown <= 0) {
      clearInterval(timer);
      if (closeBtn) {
        closeBtn.disabled = false;
        closeBtn.innerHTML = '<i class="fas fa-xmark"></i>';
      }
      if (dismissBtn) {
        dismissBtn.disabled = false;
        dismissBtn.innerText = 'Continue to Download';
      }
    } else {
      if (timerCount) timerCount.innerText = `${countdown}s`;
      if (dismissBtn) dismissBtn.innerText = `Continue to Download (${countdown}s)`;
    }
  }, 1000);

  closeBtn?.addEventListener('click', dismiss);
  dismissBtn?.addEventListener('click', dismiss);
}

/**
 * Triggers an Interstitial Ad before download or share via AndroidBridge.showInterstitialAd()
 */
export function triggerInterstitialAd(): boolean {
  try {
    if (typeof window !== 'undefined' && window.AndroidBridge) {
      const bridge = window.AndroidBridge as any;
      if (typeof bridge.showInterstitialAd === 'function') {
        console.log('[AndroidBridge] Invoking AndroidBridge.showInterstitialAd()');
        bridge.showInterstitialAd();
        return true;
      }
      if (typeof bridge.showAd === 'function') {
        console.log('[AndroidBridge] Invoking AndroidBridge.showAd()');
        bridge.showAd();
        return true;
      }
      if (typeof bridge.showInterstitial === 'function') {
        console.log('[AndroidBridge] Invoking AndroidBridge.showInterstitial()');
        bridge.showInterstitial();
        return true;
      }
    }
    
    // In browser preview outside WebView, only simulate interstitial ad if debug mode is active
    const isDebug =
      typeof window !== 'undefined' &&
      (() => {
        try {
          const params = new URLSearchParams(window.location.search);
          return (
            params.get('debugAds') === 'true' ||
            params.get('debug_ads') === 'true' ||
            localStorage.getItem('debug_ads') === 'true'
          );
        } catch {
          return false;
        }
      })();

    if (isDebug) {
      console.log(`[ADS] Simulating AdMob Test Interstitial for debug preview: ${ADMOB_TEST_CONFIG.interstitialUnitId}`);
      showSimulatedInterstitialAd();
    } else {
      console.log('[ADS] Browser environment detected (no native AndroidBridge). Skipping interstitial.');
    }
    return true;
  } catch (err) {
    console.warn('[ADS] Error calling showInterstitialAd:', err);
    return false;
  }
}

/**
 * Single real function that performs the programmatic browser file download
 */
export function triggerBrowserDownload(fileUrl: string, fileName: string = 'document.pdf'): void {
  try {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      } catch {}
    }, 200);
  } catch (err) {
    console.error('Error triggering download:', err);
    window.open(fileUrl, '_blank');
  }
}

// Module-level guard flag to prevent duplicate clicks while an ad or download is in-flight
let isDownloadFlowActive = false;

/**
 * Returns whether a download action is currently in-flight (waiting for ad or processing)
 */
export function isDownloadInProgress(): boolean {
  return isDownloadFlowActive;
}

/**
 * Reusable Download-With-Ad Coordinator:
 * 1. Checks duplicate protection (ignores rapid multi-clicks).
 * 2. Checks for native AndroidBridge.
 *    - In WebView: requests native interstitial and WAITS for Android callback (dismissed or failed).
 *    - In Normal Browser: proceeds directly without blocking or fake ad screens.
 * 3. Starts the actual file download action exactly once after ad lifecycle finishes.
 * 4. Resets state on completion or failure so user can retry.
 */
export async function executeDownloadWithAd(
  downloadAction: () => Promise<void> | void,
  options?: {
    onStateChange?: (state: 'idle' | 'waiting_for_ad' | 'downloading') => void;
  }
): Promise<boolean> {
  // 1. DUPLICATE PROTECTION: check whether download action is already processing
  if (isDownloadFlowActive) {
    console.log('[DOWNLOAD] duplicate click ignored');
    return false;
  }

  isDownloadFlowActive = true;
  options?.onStateChange?.('waiting_for_ad');
  console.log('[DOWNLOAD] download flow started');

  const cleanup = () => {
    isDownloadFlowActive = false;
    options?.onStateChange?.('idle');
  };

  try {
    // 2. CHECK ANDROID BRIDGE AVAILABILITY
    const bridgeAvailable = isAndroidBridgeAvailable();
    const bridge = bridgeAvailable ? window.AndroidBridge : undefined;

    const hasDedicatedDownloadAd = typeof bridge?.showInterstitialAdForDownload === 'function';
    const hasStandardInterstitial =
      typeof bridge?.showInterstitialAd === 'function' ||
      typeof bridge?.showAd === 'function' ||
      typeof bridge?.showInterstitial === 'function';

    const canShowNativeInterstitial = bridgeAvailable && (hasDedicatedDownloadAd || hasStandardInterstitial);

    if (!canShowNativeInterstitial) {
      if (bridgeAvailable) {
        console.log('[DOWNLOAD] AndroidBridge detected');
      } else {
        console.log('[ADS] AndroidBridge unavailable');
      }
      console.log('[DOWNLOAD] interstitial unavailable');
    } else {
      console.log('[DOWNLOAD] AndroidBridge detected');
      console.log('[DOWNLOAD] waiting for interstitial');

      // 3. WAIT FOR REAL LIFECYCLE CALLBACK FROM ANDROID
      await new Promise<void>((resolve) => {
        let hasFinishedAdWait = false;

        const handleAdCompletion = (success: boolean) => {
          if (hasFinishedAdWait) return;
          hasFinishedAdWait = true;

          // Clear safety timeout
          if (safetyTimer) clearTimeout(safetyTimer);

          // Clean up custom event listener
          if (typeof window !== 'undefined') {
            window.removeEventListener('onInterstitialClosedForDownload', customEventListener);
          }

          if (success) {
            console.log('[DOWNLOAD] interstitial dismissed');
          } else {
            console.log('[DOWNLOAD] interstitial failed');
          }
          resolve();
        };

        // Safety watchdog: If native bridge freezes, encounters an unhandled error, or never calls back,
        // do not permanently trap the user; continue to download.
        const safetyTimer = setTimeout(() => {
          console.warn('[DOWNLOAD] Interstitial response timeout; continuing to download');
          handleAdCompletion(false);
        }, 12000);

        // Global callback for Android WebView evaluateJavascript
        window.onInterstitialClosedForDownload = (success: boolean = true) => {
          handleAdCompletion(success);
        };

        // CustomEvent listener support
        const customEventListener = (e: Event) => {
          const customEvent = e as CustomEvent<{ success?: boolean }>;
          handleAdCompletion(customEvent.detail?.success ?? true);
        };
        window.addEventListener('onInterstitialClosedForDownload', customEventListener);

        console.log('[DOWNLOAD] interstitial requested');
        try {
          if (hasDedicatedDownloadAd) {
            bridge!.showInterstitialAdForDownload!();
          } else if (typeof bridge!.showInterstitialAd === 'function') {
            bridge!.showInterstitialAd!();
          } else if (typeof bridge!.showAd === 'function') {
            bridge!.showAd!();
          } else if (typeof bridge!.showInterstitial === 'function') {
            bridge!.showInterstitial!();
          }
        } catch (bridgeErr) {
          console.error('[DOWNLOAD] Interstitial invocation failed on bridge:', bridgeErr);
          handleAdCompletion(false);
        }
      });
    }

    // 4. START ACTUAL DOWNLOAD PROCESS
    options?.onStateChange?.('downloading');
    console.log('[DOWNLOAD] starting actual download');

    await downloadAction();

    console.log('[DOWNLOAD] download completed');
    cleanup();
    return true;
  } catch (downloadErr) {
    console.error('[DOWNLOAD] download failed', downloadErr);
    cleanup();
    throw downloadErr;
  }
}

/**
 * Downloads a file safely by running through the native interstitial ad lifecycle
 * before triggering the browser download.
 */
export async function downloadFileWithAd(
  fileUrl: string,
  fileName: string = 'document.pdf',
  options?: {
    onStateChange?: (state: 'idle' | 'waiting_for_ad' | 'downloading') => void;
  }
): Promise<boolean> {
  console.log('[DOWNLOAD] button tapped');
  return executeDownloadWithAd(() => {
    triggerBrowserDownload(fileUrl, fileName);
  }, options);
}

/**
 * Helper to call before initiating file download
 */
export function onBeforeDownload(): void {
  // Provided for backwards compatibility
}

/**
 * Converts a Blob, File, data URL, or object URL to a Base64 string.
 */
export async function fileToBase64(fileOrUrl: string | Blob | File): Promise<string> {
  if (typeof fileOrUrl === 'string') {
    // If it's already a Data URL, return it directly
    if (fileOrUrl.startsWith('data:')) {
      return fileOrUrl;
    }

    // If it's a blob: URL or http URL, fetch and read as data URL
    const response = await fetch(fileOrUrl);
    const blob = await response.blob();
    return blobToBase64(blob);
  }

  return blobToBase64(fileOrUrl);
}

/**
 * Reads a Blob as a Base64 Data URL
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert blob to base64 string'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Shares a file via native AndroidBridge.shareFile(base64Data, fileName).
 * Falls back to Web Share API or download when running outside native WebView.
 */
export async function shareFileViaAndroidBridge(
  fileOrUrl: string | Blob | File,
  fileName: string = 'document.pdf'
): Promise<boolean> {
  try {
    // Show interstitial ad before sharing as requested
    triggerInterstitialAd();

    const base64Data = await fileToBase64(fileOrUrl);

    // 1. Native AndroidBridge interface invocation
    if (
      typeof window !== 'undefined' &&
      window.AndroidBridge &&
      typeof window.AndroidBridge.shareFile === 'function'
    ) {
      console.log(`[AndroidBridge] Invoking AndroidBridge.shareFile for "${fileName}"`);
      window.AndroidBridge.shareFile(base64Data, fileName);
      return true;
    }

    // 2. Standard Web Share API fallback (mobile Chrome, Safari, Android browsers without custom bridge)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        let blob: Blob;
        if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('data:')) {
          const res = await fetch(fileOrUrl);
          blob = await res.blob();
        } else if (typeof fileOrUrl === 'string') {
          const res = await fetch(fileOrUrl);
          blob = await res.blob();
        } else {
          blob = fileOrUrl;
        }

        const mimeType = fileName.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')
          ? 'image/jpeg'
          : 'application/octet-stream';

        const file = new File([blob], fileName, { type: mimeType });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
          });
          return true;
        }
      } catch (shareErr) {
        // User cancelled or share failed, fallback to log
        console.warn('[WebShare] Share error or dismissed:', shareErr);
      }
    }

    // 3. Fallback for desktop testing / preview environments without AndroidBridge
    console.info(
      `[AndroidBridge] AndroidBridge.shareFile(base64Data, "${fileName}") would be called on Android. (Data length: ${base64Data.length})`
    );
    return true;
  } catch (error) {
    console.error('[AndroidBridge] Error in shareFileViaAndroidBridge:', error);
    throw error;
  }
}
