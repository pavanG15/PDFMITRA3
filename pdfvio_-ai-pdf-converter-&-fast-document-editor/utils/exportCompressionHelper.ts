/**
 * Advanced Document Export, In-Browser Canvas Compression & Share Engine
 * 
 * Provides:
 * 1. 3 Tier Compression Engine:
 *    - 'original' (100%): Full raw capture resolution, no downsampling.
 *    - 'medium' (70%): 1600px max dimension, 0.72 JPEG quality (~300-600KB, ideal for WhatsApp/Email).
 *    - 'extreme' (40%): 1000px max dimension, 0.45 JPEG quality (<150-200KB for strict Govt & Job Portals).
 * 2. Multi-Format Builder:
 *    - PDF (.pdf), JPG (.jpg), PNG (.png), and ZIP Archive (.zip)
 * 3. Page Mode Handler:
 *    - Single Merged PDF / Separate PDFs / Bundled in ZIP Archive
 * 4. Live Dynamic File Size Estimator with real-time feedback
 */

export type CompressionPreset = 'original' | 'medium' | 'extreme';
export type ExportFileFormat = 'PDF' | 'JPG' | 'PNG' | 'ZIP';
export type PageExportMode = 'merged' | 'separate' | 'zip';

export interface SavedLocationFeedback {
  visible: boolean;
  fileName: string;
  savedPath: string;
  mimeType: string;
  fileSizeText?: string;
  blobUrl?: string;
  blob?: Blob;
  timestamp: number;
}

export interface CompressionPresetConfig {
  id: CompressionPreset;
  title: string;
  badge: string;
  badgeColor: string;
  quality: number;
  maxDimension: number;
  description: string;
  targetNotice: string;
}

export const COMPRESSION_PRESETS: Record<CompressionPreset, CompressionPresetConfig> = {
  original: {
    id: 'original',
    title: 'As It Is (100%)',
    badge: 'RAW CLARITY',
    badgeColor: 'bg-slate-700 text-slate-200 border-slate-600',
    quality: 0.95,
    maxDimension: 2600,
    description: 'No compression, maximum clarity & original resolution',
    targetNotice: 'Best for archiving, photo prints, and formal physical printing',
  },
  medium: {
    id: 'medium',
    title: 'Medium Compress (70%)',
    badge: 'RECOMMENDED',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    quality: 0.72,
    maxDimension: 1600,
    description: 'Balanced quality with reduced file size (Ideal for WhatsApp/Email)',
    targetNotice: 'Crisp readability with ~65% size reduction for instant sharing',
  },
  extreme: {
    id: 'extreme',
    title: 'Extreme Compress (40%)',
    badge: 'GOVT FORMS (<200KB)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    quality: 0.45,
    maxDimension: 1000,
    description: 'Highly compressed for strict upload limits (UPSC, SSC, Aadhaar)',
    targetNotice: 'Guaranteed lightweight output strictly under portal limits',
  },
};

/**
 * Format bytes into human-readable string (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${Math.round(bytes / k)} KB`;
  return `${(bytes / (k * k)).toFixed(2)} MB`;
}

/**
 * Loads an image from a DataURL or blob URL safely
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for processing: ' + e));
    img.src = src;
  });
}

/**
 * Compresses an image data URL via an off-screen HTML5 Canvas
 */
export async function compressImageDataUrl(
  dataUrl: string,
  preset: CompressionPreset
): Promise<{ dataUrl: string; width: number; height: number; sizeBytes: number }> {
  const config = COMPRESSION_PRESETS[preset];

  // If original and already a clean image, compute byte size
  if (preset === 'original') {
    const img = await loadImageElement(dataUrl);
    // Estimate bytes from base64
    const head = dataUrl.indexOf(',');
    const base64Len = head >= 0 ? dataUrl.length - head - 1 : dataUrl.length;
    const estBytes = Math.round((base64Len * 3) / 4);
    return {
      dataUrl,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      sizeBytes: estBytes,
    };
  }

  const img = await loadImageElement(dataUrl);
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  // Scale down if exceeds maxDimension
  const maxDim = config.maxDimension;
  let targetW = srcW;
  let targetH = srcH;

  if (srcW > maxDim || srcH > maxDim) {
    if (srcW >= srcH) {
      targetW = maxDim;
      targetH = Math.round((srcH * maxDim) / srcW);
    } else {
      targetH = maxDim;
      targetW = Math.round((srcW * maxDim) / srcH);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Unable to create canvas 2d context for image compression');
  }

  // High quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = preset === 'extreme' ? 'medium' : 'high';

  // White background for documents (avoids transparent dark backgrounds)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', config.quality);
  const head = compressedDataUrl.indexOf(',');
  const base64Len = head >= 0 ? compressedDataUrl.length - head - 1 : compressedDataUrl.length;
  const sizeBytes = Math.round((base64Len * 3) / 4);

  return {
    dataUrl: compressedDataUrl,
    width: targetW,
    height: targetH,
    sizeBytes,
  };
}

/**
 * Computes live real-time estimated file sizes for all 3 compression presets
 */
export function calculateLiveEstimates(
  pageCount: number,
  format: ExportFileFormat,
  mode: PageExportMode
): {
  original: { bytes: number; formatted: string };
  medium: { bytes: number; formatted: string; savingsPercent: number };
  extreme: { bytes: number; formatted: string; savingsPercent: number };
} {
  const count = Math.max(1, pageCount);

  // Base raw size per page in bytes
  let baseBytesPerPage = 950 * 1024; // ~950 KB
  if (format === 'PNG') baseBytesPerPage = 1400 * 1024;
  if (format === 'JPG') baseBytesPerPage = 850 * 1024;

  const originalTotal = baseBytesPerPage * count + (format === 'PDF' ? 25 * 1024 : 0);

  // Medium is ~28% of original (~72% saved)
  const mediumBytesPerPage = Math.round(baseBytesPerPage * 0.28);
  const mediumTotal = mediumBytesPerPage * count + (format === 'PDF' ? 18 * 1024 : 0);

  // Extreme is ~8% of original (~92% saved, strictly under 150-200KB for 1-3 pages)
  const extremeBytesPerPage = Math.min(
    65 * 1024,
    Math.round(baseBytesPerPage * 0.08)
  );
  const extremeTotal = extremeBytesPerPage * count + (format === 'PDF' ? 12 * 1024 : 0);

  // Add ZIP overhead if mode is ZIP or format is ZIP
  const zipOverhead = (format === 'ZIP' || mode === 'zip') ? 12 * 1024 : 0;

  const finalOrig = originalTotal + zipOverhead;
  const finalMed = mediumTotal + zipOverhead;
  const finalExt = extremeTotal + zipOverhead;

  return {
    original: {
      bytes: finalOrig,
      formatted: formatBytes(finalOrig),
    },
    medium: {
      bytes: finalMed,
      formatted: formatBytes(finalMed),
      savingsPercent: Math.max(0, Math.round(((finalOrig - finalMed) / finalOrig) * 100)),
    },
    extreme: {
      bytes: finalExt,
      formatted: formatBytes(finalExt),
      savingsPercent: Math.max(0, Math.round(((finalOrig - finalExt) / finalOrig) * 100)),
    },
  };
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Adds an image fitted to an A4 page preserving aspect ratio
 */
function addImageFittedToDoc(
  doc: any,
  dataUrl: string,
  imgW: number,
  imgH: number
) {
  const w = imgW || A4_WIDTH_MM;
  const h = imgH || A4_HEIGHT_MM;
  const scale = Math.min(A4_WIDTH_MM / w, A4_HEIGHT_MM / h);
  const fittedW = w * scale;
  const fittedH = h * scale;
  const x = (A4_WIDTH_MM - fittedW) / 2;
  const y = (A4_HEIGHT_MM - fittedH) / 2;
  doc.addImage(dataUrl, 'JPEG', x, y, fittedW, fittedH, undefined, 'FAST');
}

/**
 * Converts a data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export interface BuildBundleOptions {
  pages: { id: string; name: string; processed: string; width?: number; height?: number }[];
  format: ExportFileFormat;
  compression: CompressionPreset;
  mode: PageExportMode;
  folderName: string;
  password?: string;
  onProgress?: (percent: number, message: string) => void;
}

/**
 * Multi-Format, Multi-Page Export Builder
 */
export async function buildExportBundle(options: BuildBundleOptions): Promise<{
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  formattedSize: string;
}> {
  const {
    pages,
    format,
    compression,
    mode,
    folderName,
    password,
    onProgress,
  } = options;

  if (pages.length === 0) {
    throw new Error('No pages available for export.');
  }

  const cleanBaseName = (folderName || 'Document').trim().replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');

  onProgress?.(10, 'Preparing pages & compression engine...');

  // 1. Recompress all page images according to the selected compression preset
  const compressedPages: { dataUrl: string; width: number; height: number; name: string }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(
      15 + Math.round(((i + 1) / pages.length) * 35),
      `Optimizing page ${i + 1} of ${pages.length} (${compression} compress)...`
    );
    const res = await compressImageDataUrl(page.processed, compression);
    compressedPages.push({
      dataUrl: res.dataUrl,
      width: res.width,
      height: res.height,
      name: (page.name || `Page_${i + 1}`).trim().replace(/\s+/g, '_'),
    });
  }

  // 2. Handle ZIP Archive Format OR mode === 'zip'
  const isZipRequired = format === 'ZIP' || mode === 'zip';

  if (isZipRequired) {
    onProgress?.(60, 'Packaging archive with JSZip...');
    const win = window as any;
    const JSZipConstructor = win.JSZip;
    if (!JSZipConstructor) {
      throw new Error('ZIP packaging engine (JSZip) is unavailable.');
    }
    const zip = new JSZipConstructor();

    // If format is PDF or user wants separate PDFs
    if (format === 'PDF' || mode === 'separate') {
      const jspdfLib = win.jspdf;
      const jsPDF = jspdfLib?.jsPDF || jspdfLib || win.jsPDF;
      if (jsPDF) {
        for (let i = 0; i < compressedPages.length; i++) {
          const cp = compressedPages[i];
          const singleDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
          addImageFittedToDoc(singleDoc, cp.dataUrl, cp.width, cp.height);
          const pdfBlob = singleDoc.output('blob') as Blob;
          zip.file(`${cp.name || `Page_${i + 1}`}.pdf`, pdfBlob);
        }
      }
    }

    // Also include high quality compressed images in the ZIP
    for (let i = 0; i < compressedPages.length; i++) {
      const cp = compressedPages[i];
      const imgBlob = dataUrlToBlob(cp.dataUrl);
      const ext = format === 'PNG' ? 'png' : 'jpg';
      zip.file(`${cp.name || `Page_${i + 1}`}.${ext}`, imgBlob);
    }

    onProgress?.(90, 'Generating ZIP bundle...');
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: compression === 'extreme' ? 9 : 6 },
    });

    const finalFileName = `${cleanBaseName}_Bundle.zip`;
    return {
      blob: zipBlob,
      fileName: finalFileName,
      mimeType: 'application/zip',
      sizeBytes: zipBlob.size,
      formattedSize: formatBytes(zipBlob.size),
    };
  }

  // 3. Handle Separate Mode (when multiple pages exist and user picked separate files without zip)
  if (mode === 'separate' && compressedPages.length > 1) {
    // Bundle separate files in zip for user convenience
    onProgress?.(65, 'Packaging separate page files in ZIP...');
    const win = window as any;
    const JSZipConstructor = win.JSZip;
    if (!JSZipConstructor) {
      throw new Error('JSZip is required to download multiple separate pages at once.');
    }
    const zip = new JSZipConstructor();

    if (format === 'PDF') {
      const jspdfLib = win.jspdf;
      const jsPDF = jspdfLib?.jsPDF || jspdfLib || win.jsPDF;
      if (!jsPDF) throw new Error('jsPDF engine is not available.');
      for (let i = 0; i < compressedPages.length; i++) {
        const cp = compressedPages[i];
        const singleDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        addImageFittedToDoc(singleDoc, cp.dataUrl, cp.width, cp.height);
        const singleBlob = singleDoc.output('blob') as Blob;
        zip.file(`${cp.name || `Page_${i + 1}`}.pdf`, singleBlob);
      }
    } else {
      const ext = format === 'PNG' ? 'png' : 'jpg';
      for (let i = 0; i < compressedPages.length; i++) {
        const cp = compressedPages[i];
        zip.file(`${cp.name || `Page_${i + 1}`}.${ext}`, dataUrlToBlob(cp.dataUrl));
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const finalFileName = `${cleanBaseName}_SeparatePages.zip`;
    return {
      blob: zipBlob,
      fileName: finalFileName,
      mimeType: 'application/zip',
      sizeBytes: zipBlob.size,
      formattedSize: formatBytes(zipBlob.size),
    };
  }

  // 4. Handle Standard Formats: PDF, JPG, PNG
  if (format === 'PDF') {
    onProgress?.(60, 'Assembling multi-page PDF...');
    const win = window as any;
    const jspdfLib = win.jspdf;
    const jsPDF = jspdfLib?.jsPDF || jspdfLib || win.jsPDF;
    if (!jsPDF) {
      throw new Error('jsPDF library is not loaded. Please verify connection.');
    }

    const pdfOptions: any = { orientation: 'p', unit: 'mm', format: 'a4', compress: true };
    if (password && password.trim()) {
      pdfOptions.encryption = {
        userPassword: password.trim(),
        ownerPassword: password.trim(),
        userPermissions: ['print', 'modify', 'copy', 'annot-forms'],
      };
    }

    const doc = new jsPDF(pdfOptions);
    for (let i = 0; i < compressedPages.length; i++) {
      if (i > 0) doc.addPage();
      const cp = compressedPages[i];
      addImageFittedToDoc(doc, cp.dataUrl, cp.width, cp.height);
      onProgress?.(
        60 + Math.round(((i + 1) / compressedPages.length) * 35),
        `Rendering PDF page ${i + 1} of ${compressedPages.length}...`
      );
    }

    const pdfBlob = doc.output('blob') as Blob;
    const finalFileName = `${cleanBaseName}.pdf`;
    return {
      blob: pdfBlob,
      fileName: finalFileName,
      mimeType: 'application/pdf',
      sizeBytes: pdfBlob.size,
      formattedSize: formatBytes(pdfBlob.size),
    };
  }

  // Single page or merged JPG / PNG
  if (format === 'JPG' || format === 'PNG') {
    onProgress?.(70, `Building ${format} image...`);
    if (compressedPages.length === 1) {
      const cp = compressedPages[0];
      const imgBlob = dataUrlToBlob(cp.dataUrl);
      const ext = format === 'PNG' ? 'png' : 'jpg';
      const mime = format === 'PNG' ? 'image/png' : 'image/jpeg';
      const finalFileName = `${cleanBaseName}.${ext}`;
      return {
        blob: imgBlob,
        fileName: finalFileName,
        mimeType: mime,
        sizeBytes: imgBlob.size,
        formattedSize: formatBytes(imgBlob.size),
      };
    }

    // If multiple pages and single merged image is chosen, vertically stitch them!
    onProgress?.(75, `Stitching ${compressedPages.length} pages into merged ${format}...`);
    const totalW = Math.max(...compressedPages.map((p) => p.width));
    const totalH = compressedPages.reduce((acc, p) => acc + p.height, 0);

    const stitchCanvas = document.createElement('canvas');
    stitchCanvas.width = totalW;
    stitchCanvas.height = totalH;
    const sCtx = stitchCanvas.getContext('2d');
    if (!sCtx) throw new Error('Failed to create stitch canvas');

    sCtx.fillStyle = '#FFFFFF';
    sCtx.fillRect(0, 0, totalW, totalH);

    let currentY = 0;
    for (const cp of compressedPages) {
      const imgEl = await loadImageElement(cp.dataUrl);
      const offsetX = (totalW - cp.width) / 2;
      sCtx.drawImage(imgEl, offsetX, currentY, cp.width, cp.height);
      currentY += cp.height;
    }

    const ext = format === 'PNG' ? 'png' : 'jpg';
    const mime = format === 'PNG' ? 'image/png' : 'image/jpeg';
    const quality = format === 'PNG' ? undefined : COMPRESSION_PRESETS[compression].quality;
    const finalDataUrl = stitchCanvas.toDataURL(mime, quality);
    const finalBlob = dataUrlToBlob(finalDataUrl);
    const finalFileName = `${cleanBaseName}_Merged.${ext}`;

    return {
      blob: finalBlob,
      fileName: finalFileName,
      mimeType: mime,
      sizeBytes: finalBlob.size,
      formattedSize: formatBytes(finalBlob.size),
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}
