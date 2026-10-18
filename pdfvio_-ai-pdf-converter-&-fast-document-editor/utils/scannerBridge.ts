import type { AndroidBridgeInterface } from './shareHelper';

/**
 * Universal Native Android ML Kit Document Scanner & Web Camera Bridge
 *
 * Checks if the application is running inside the Android WebView container:
 * const isAndroidApp = typeof window !== 'undefined' && (window.AndroidScanner || window.AndroidBridge);
 *
 * When the user clicks "Scan to PDF", "/scan", or the camera FAB:
 * - If isAndroidApp is true: DO NOT open the web camera screen.
 *   Immediately call window.AndroidScanner.startScan() or window.AndroidBridge.startDocumentScan().
 * - Only fallback to the web camera UI if running in a normal desktop/mobile browser where the native bridge is not available.
 */

declare global {
  interface Window {
    AndroidScanner?: {
      startScan?: () => void;
      startDocumentScan?: () => void;
      [key: string]: unknown;
    };
    AndroidBridge?: AndroidBridgeInterface;
    onScanComplete?: (payload: any) => void;
    onScanBatchComplete?: (payload: any) => void;
    onDocumentScanResult?: (payload: any) => void;
  }
}

/**
 * Check if running inside the Android WebView:
 * const isAndroidApp = typeof window !== 'undefined' && (window.AndroidScanner || window.AndroidBridge);
 */
export const isAndroidApp = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    Boolean(
      (window as any).AndroidScanner ||
      (window as any).AndroidBridge ||
      ((window as any).Android && ((window as any).Android.scanner || (window as any).Android.scannerBridge))
    )
  );
};

export const isAndroidScannerAvailable = isAndroidApp;

/**
 * Triggers the native Google ML Kit Document Scanner.
 * If running inside Android WebView:
 * - Calls window.AndroidBridge.startDocumentScan() or window.AndroidScanner.startScan()
 * - Returns true and DOES NOT open the web camera screen.
 * If running in a normal browser:
 * - Calls the fallback function (e.g. open web camera screen)
 * - Returns false.
 */
export const triggerScan = (fallbackCallback?: () => void): boolean => {
  if (typeof window === 'undefined') {
    fallbackCallback?.();
    return false;
  }

  const win = window as any;
  const isApp = Boolean(win.AndroidScanner || win.AndroidBridge);

  if (isApp) {
    try {
      if (win.AndroidBridge && typeof win.AndroidBridge.startDocumentScan === 'function') {
        win.AndroidBridge.startDocumentScan();
        return true;
      }
      if (win.AndroidScanner && typeof win.AndroidScanner.startScan === 'function') {
        win.AndroidScanner.startScan();
        return true;
      }
      if (win.AndroidBridge && typeof win.AndroidBridge.startScan === 'function') {
        win.AndroidBridge.startScan();
        return true;
      }
      if (win.AndroidScanner && typeof win.AndroidScanner.startDocumentScan === 'function') {
        win.AndroidScanner.startDocumentScan();
        return true;
      }
    } catch (err) {
      console.error('[ScannerBridge] Error launching native scanner:', err);
    }
    return true;
  }

  if (fallbackCallback) {
    fallbackCallback();
  }
  return false;
};

export const launchNativeScannerIfAvailable = triggerScan;
