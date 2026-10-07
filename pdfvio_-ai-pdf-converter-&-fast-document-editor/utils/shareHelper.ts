/**
 * Universal Android WebView Bridge & Web Share Helper
 * Converts generated PDF/JPG files to Base64 strings and invokes
 * AndroidBridge.shareFile(base64Data, fileName) for native Android sharing.
 */

declare global {
  interface Window {
    AndroidBridge?: {
      shareFile?: (base64Data: string, fileName: string) => void;
      showInterstitialAd?: () => void;
      showBannerAd?: (page?: string) => void;
      refreshBannerAd?: (page?: string) => void;
      hideBannerAd?: () => void;
      [key: string]: any;
    };
  }
}

/**
 * Triggers Banner Ad to display/refresh via AndroidBridge.showBannerAd(page)
 * or AndroidBridge.refreshBannerAd(page) on route navigation.
 */
export function showBannerAd(page?: string): boolean {
  try {
    if (typeof window !== 'undefined' && window.AndroidBridge) {
      if (typeof window.AndroidBridge.refreshBannerAd === 'function') {
        console.log(`[AndroidBridge] Invoking AndroidBridge.refreshBannerAd("${page || ''}")`);
        window.AndroidBridge.refreshBannerAd(page || '');
        return true;
      }
      if (typeof window.AndroidBridge.showBannerAd === 'function') {
        console.log(`[AndroidBridge] Invoking AndroidBridge.showBannerAd("${page || ''}")`);
        window.AndroidBridge.showBannerAd(page || '');
        return true;
      }
    }
    console.log('[AndroidBridge] showBannerAd() requested (bridge not present in this browser environment)');
    return false;
  } catch (err) {
    console.warn('[AndroidBridge] Error calling showBannerAd:', err);
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
      console.log('[AndroidBridge] Invoking AndroidBridge.hideBannerAd()');
      window.AndroidBridge.hideBannerAd();
      return true;
    } else {
      console.log('[AndroidBridge] hideBannerAd() requested (bridge not present in this browser environment)');
      return false;
    }
  } catch (err) {
    console.warn('[AndroidBridge] Error calling hideBannerAd:', err);
    return false;
  }
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
    console.log(
      '[AndroidBridge] showInterstitialAd() requested (bridge not present in this browser environment)'
    );
    return false;
  } catch (err) {
    console.warn('[AndroidBridge] Error calling showInterstitialAd:', err);
    return false;
  }
}

/**
 * Downloads a file safely while triggering the Interstitial Ad via AndroidBridge.showInterstitialAd()
 */
export function downloadFileWithAd(fileUrl: string, fileName: string = 'document.pdf'): void {
  // 1. Immediately invoke Interstitial Ad
  triggerInterstitialAd();

  // 2. Trigger programmatic download
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

/**
 * Helper to call before initiating file download
 */
export function onBeforeDownload(): void {
  triggerInterstitialAd();
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
