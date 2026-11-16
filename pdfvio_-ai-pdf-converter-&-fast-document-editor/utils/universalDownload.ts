/**
 * Universal File Download Utility for Web Browsers & Android WebView
 *
 * Supports:
 * - Blob, File, Uint8Array, data: URLs, and blob:/http: URLs
 * - Safe FileReader.readAsDataURL conversion (zero stack overflow on large PDFs/ZIPs)
 * - Automatic MIME type detection from Blob.type or filename extension
 * - Android WebView small-file direct bridge (`window.Android.downloadFile`)
 * - Android WebView large-file (>= 1.5MB) chunked bridge (`startChunkedDownload` -> `appendDownloadChunk` -> `finishChunkedDownload`)
 * - Automatic Global `<a download>` interceptor for third-party libraries (jsPDF.save, JSZip, FileSaver.js)
 * - Global completion toast & `"Saving..."` status notifications via `window.onFileDownloadComplete`
 */

export type UniversalDownloadSource = Blob | File | Uint8Array | string;

export interface UniversalDownloadStatusEvent {
  phase: 'saving' | 'completed' | 'error';
  fileName?: string;
  message?: string;
}

const CHUNK_THRESHOLD_CHARS = Math.floor(1.5 * 1024 * 1024); // 1.5 MB Base64 threshold
const CHUNK_SIZE_CHARS = 512 * 1024; // 512 KB per WebView bridge chunk

const statusListeners = new Set<(event: UniversalDownloadStatusEvent) => void>();
let interceptorInstalled = false;

export function subscribeUniversalDownloadStatus(
  listener: (event: UniversalDownloadStatusEvent) => void
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function emitUniversalDownloadStatus(event: UniversalDownloadStatusEvent): void {
  statusListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore subscriber errors
    }
  });
}

/**
 * Infers MIME type cleanly from file extension when omitted or generic.
 */
export function inferMimeTypeFromExtension(fileName: string = 'download'): string {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.txt')) return 'text/plain;charset=utf-8';
  if (lower.endsWith('.csv')) return 'text/csv;charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

/**
 * Safely converts a Blob or File to a Base64 Data URL using FileReader.readAsDataURL.
 * Never uses `btoa(String.fromCharCode(...))`, avoiding call-stack limits on large PDFs/ZIPs.
 */
export function blobToDataUrlSafe(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader did not produce a Base64 string'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read Blob as Data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes a data: URL into a Blob cleanly without `String.fromCharCode` spread.
 */
export function dataUrlToBlobSafe(dataUrl: string, fallbackMime?: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx) : '';
  const body = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  const mimeMatch = header.match(/data:([^;]+)/i);
  const detectedMime = mimeMatch?.[1] || fallbackMime || 'application/octet-stream';
  const isBase64 = /;base64/i.test(header);

  if (!isBase64) {
    return new Blob([decodeURIComponent(body)], { type: detectedMime });
  }

  const binary = atob(body);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: detectedMime });
}

/**
 * Normalizes any supported source into `{ blob, cleanBase64?, mimeType }`.
 */
async function resolveSourceToBlobAndMime(
  source: UniversalDownloadSource,
  fileName: string,
  explicitMimeType?: string
): Promise<{ blob: Blob; mimeType: string; precomputedBase64?: string }> {
  const fallbackMime = inferMimeTypeFromExtension(fileName);

  if (source instanceof Blob) {
    const resolvedMime =
      explicitMimeType || (source.type && source.type !== 'application/octet-stream' ? source.type : '') || fallbackMime;
    return { blob: source, mimeType: resolvedMime };
  }

  if (source instanceof Uint8Array) {
    const copy = new Uint8Array(source.byteLength);
    copy.set(source);
    const resolvedMime = explicitMimeType || fallbackMime;
    return {
      blob: new Blob([copy.buffer], { type: resolvedMime }),
      mimeType: resolvedMime,
    };
  }

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      const commaIdx = source.indexOf(',');
      const header = commaIdx >= 0 ? source.slice(0, commaIdx) : '';
      const mimeMatch = header.match(/data:([^;]+)/i);
      const resolvedMime = explicitMimeType || mimeMatch?.[1] || fallbackMime;
      const isBase64 = /;base64/i.test(header);
      const blob = dataUrlToBlobSafe(source, resolvedMime);
      const precomputedBase64 = isBase64 && commaIdx >= 0 ? source.slice(commaIdx + 1) : undefined;
      return { blob, mimeType: resolvedMime, precomputedBase64 };
    }

    // Handles blob: or http(s): URLs
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch download source (${response.status})`);
    }
    const fetchedBlob = await response.blob();
    const resolvedMime =
      explicitMimeType ||
      (fetchedBlob.type && fetchedBlob.type !== 'application/octet-stream' ? fetchedBlob.type : '') ||
      fallbackMime;
    return { blob: fetchedBlob, mimeType: resolvedMime };
  }

  throw new Error('Unsupported download source type');
}

/**
 * Performs standard browser download using URL.createObjectURL + `<a download>`.
 * Marks the synthetic anchor with `__bypassUniversalDownload = true` so the global
 * WebView interceptor never loops on browser fallback.
 */
function triggerStandardBrowserDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a') as HTMLAnchorElement & {
    __bypassUniversalDownload?: boolean;
  };
  link.__bypassUniversalDownload = true;
  link.href = objectUrl;
  link.download = fileName || 'download';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    try {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    } catch {
      // Ignore cleanup errors
    }
  }, 250);

  setTimeout(() => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Ignore revoke errors
    }
  }, 5000);
}

/**
 * Universal download entry point for ALL tools across browsers and Android WebView.
 */
export async function universalDownload(
  source: UniversalDownloadSource,
  fileName: string = 'download',
  mimeType?: string
): Promise<boolean> {
  const safeFileName = (fileName || 'download').trim();
  emitUniversalDownloadStatus({
    phase: 'saving',
    fileName: safeFileName,
    message: `Saving ${safeFileName}...`,
  });

  try {
    const { blob, mimeType: resolvedMime, precomputedBase64 } = await resolveSourceToBlobAndMime(
      source,
      safeFileName,
      mimeType
    );

    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    const androidBridge = win?.Android || win?.AndroidBridge;

    if (androidBridge) {
      try {
        const cleanBase64 =
          precomputedBase64 ||
          (() => {
            return null;
          })();

        const resolvedCleanBase64 =
          cleanBase64 ??
          (await (async () => {
            const dataUrl = await blobToDataUrlSafe(blob);
            const commaIdx = dataUrl.indexOf(',');
            return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
          })());

        // Large file (>= 1.5MB Base64): use chunked transfer when supported by WebView bridge
        if (
          resolvedCleanBase64.length >= CHUNK_THRESHOLD_CHARS &&
          typeof androidBridge.startChunkedDownload === 'function' &&
          typeof androidBridge.appendDownloadChunk === 'function' &&
          typeof androidBridge.finishChunkedDownload === 'function'
        ) {
          const transferId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const totalChunks = Math.ceil(resolvedCleanBase64.length / CHUNK_SIZE_CHARS);

          androidBridge.startChunkedDownload(transferId, safeFileName, resolvedMime, totalChunks);

          for (let idx = 0; idx < totalChunks; idx++) {
            const start = idx * CHUNK_SIZE_CHARS;
            const end = Math.min(start + CHUNK_SIZE_CHARS, resolvedCleanBase64.length);
            const chunk = resolvedCleanBase64.slice(start, end);
            androidBridge.appendDownloadChunk(transferId, idx, chunk);

            // Yield briefly every 4 chunks so UI stays responsive on WebView
            if (idx % 4 === 3) {
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }

          androidBridge.finishChunkedDownload(transferId);

          // If host WebView doesn't invoke onFileDownloadComplete itself, emit local completion fallback gently
          if (typeof win?.onFileDownloadComplete === 'function') {
            setTimeout(() => {
              emitUniversalDownloadStatus({
                phase: 'completed',
                fileName: safeFileName,
                message: `Saved to Downloads: ${safeFileName}`,
              });
            }, 350);
          }
          return true;
        }

        // Small file (< 1.5MB) or single-shot downloadFile bridge
        if (typeof androidBridge.downloadFile === 'function') {
          androidBridge.downloadFile(resolvedCleanBase64, safeFileName, resolvedMime);
          setTimeout(() => {
            emitUniversalDownloadStatus({
              phase: 'completed',
              fileName: safeFileName,
              message: `Saved to Downloads: ${safeFileName}`,
            });
          }, 300);
          return true;
        }
      } catch (bridgeErr) {
        console.warn('[universalDownload] Android bridge failed, falling back to browser download:', bridgeErr);
      }
    }

    // Standard browser fallback
    triggerStandardBrowserDownload(blob, safeFileName);
    if (typeof win?.onFileDownloadComplete === 'function') {
      win.onFileDownloadComplete(true, safeFileName);
    } else {
      emitUniversalDownloadStatus({
        phase: 'completed',
        fileName: safeFileName,
        message: `Saved to Downloads: ${safeFileName}`,
      });
    }
    return true;
  } catch (err: any) {
    const errMessage = err?.message || 'Failed to save file';
    console.error('[universalDownload] Error:', err);
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (typeof win?.onFileDownloadComplete === 'function') {
      win.onFileDownloadComplete(false, errMessage);
    } else {
      emitUniversalDownloadStatus({
        phase: 'error',
        fileName: safeFileName,
        message: errMessage,
      });
    }
    return false;
  }
}

/**
 * Installs an automatic global `<a download>` click interceptor ONLY when `window.Android` exists.
 * Intercepts programmatic `HTMLAnchorElement.prototype.click()` when `this.hasAttribute('download')`
 * and `this.href` starts with `blob:` or `data:`, so third-party libraries (jsPDF.save, JSZip,
 * FileSaver.js) and legacy `<a download>` triggers automatically route through `universalDownload`.
 */
export function installGlobalDownloadInterceptor(): () => void {
  if (typeof window === 'undefined' || interceptorInstalled) {
    return () => {};
  }

  const win = window as any;
  if (!win.Android) {
    return () => {};
  }

  const originalClick = HTMLAnchorElement.prototype.click;
  interceptorInstalled = true;

  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const anchor = this as HTMLAnchorElement & { __bypassUniversalDownload?: boolean };
    const href = anchor.getAttribute('href') || anchor.href || '';
    const hasDownloadAttr = anchor.hasAttribute('download');

    if (
      !anchor.__bypassUniversalDownload &&
      hasDownloadAttr &&
      (href.startsWith('blob:') || href.startsWith('data:'))
    ) {
      const targetName = anchor.getAttribute('download') || anchor.download || 'download';

      if (href.startsWith('blob:')) {
        fetch(href)
          .then((r) => r.blob())
          .then((blob) => universalDownload(blob, targetName, blob.type))
          .catch((err) => {
            console.warn('[DownloadInterceptor] Blob fetch failed, falling back to native click:', err);
            originalClick.call(this);
          });
        return;
      }

      if (href.startsWith('data:')) {
        const blob = dataUrlToBlobSafe(href);
        void universalDownload(blob, targetName, blob.type);
        return;
      }
    }

    return originalClick.call(this);
  };

  return () => {
    if (interceptorInstalled) {
      HTMLAnchorElement.prototype.click = originalClick;
      interceptorInstalled = false;
    }
  };
}
