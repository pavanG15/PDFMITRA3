/**
 * Universal In-Browser PDF and Image Compression Helper
 * Uses pdf.js + jsPDF for PDFs and Canvas API for JPG/PNG images.
 * Designed for Indian portal requirements (<50 KB, <100 KB, <200 KB).
 */

declare const pdfjsLib: any;
declare const jspdf: any;

export interface CompressResult {
  blob: Blob;
  url: string;
  size: number;
  originalSize: number;
  reductionPercentage: number;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  const k = 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`;
  return `${(bytes / (k * k)).toFixed(2)} MB`;
}

/**
 * Compresses an image (DataURL or Blob) to targeted KB limits
 */
export async function compressImage(
  source: Blob | string,
  targetPreset: '50kb' | '100kb' | '200kb' | 'custom',
  customQuality = 0.65
): Promise<CompressResult> {
  let originalBlob: Blob;
  let imgSourceUrl: string;

  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      const response = await fetch(source);
      originalBlob = await response.blob();
      imgSourceUrl = source;
    } else {
      const response = await fetch(source);
      originalBlob = await response.blob();
      imgSourceUrl = URL.createObjectURL(originalBlob);
    }
  } else {
    originalBlob = source;
    imgSourceUrl = URL.createObjectURL(source);
  }

  const originalSize = originalBlob.size;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = (e) => reject(e);
    el.src = imgSourceUrl;
  });

  // Calculate target resolution & quality
  let maxDimension = 1600;
  let quality = 0.75;

  if (targetPreset === '50kb') {
    maxDimension = 800;
    quality = 0.45;
  } else if (targetPreset === '100kb') {
    maxDimension = 1100;
    quality = 0.60;
  } else if (targetPreset === '200kb') {
    maxDimension = 1400;
    quality = 0.72;
  } else {
    quality = Math.max(0.1, Math.min(0.95, customQuality));
    maxDimension = Math.round(1800 * (quality + 0.2));
  }

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // White background for transparent PNG to JPG conversion
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const compressedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create compressed image blob'));
      },
      'image/jpeg',
      quality
    );
  });

  const url = URL.createObjectURL(compressedBlob);
  const size = compressedBlob.size;
  const reductionPercentage = originalSize > 0 ? Math.max(0, Math.round(((originalSize - size) / originalSize) * 100)) : 0;

  return {
    blob: compressedBlob,
    url,
    size,
    originalSize,
    reductionPercentage,
  };
}

/**
 * Compresses an existing PDF (from Blob or Object URL)
 */
export async function compressPdf(
  source: Blob | string,
  targetPreset: '50kb' | '100kb' | '200kb' | 'custom',
  customQuality = 0.60,
  onProgress?: (progress: number, message: string) => void
): Promise<CompressResult> {
  let pdfBuffer: ArrayBuffer;
  let originalSize = 0;

  if (typeof source === 'string') {
    const res = await fetch(source);
    const b = await res.blob();
    originalSize = b.size;
    pdfBuffer = await b.arrayBuffer();
  } else {
    originalSize = source.size;
    pdfBuffer = await source.arrayBuffer();
  }

  const pdfjs = (window as any).pdfjsLib;
  const jspdfLib = (window as any).jspdf;
  if (!pdfjs) throw new Error('PDF.js library not loaded');
  if (!jspdfLib) throw new Error('jsPDF library not loaded');

  const jsPDF = jspdfLib.jsPDF || jspdfLib;
  const pdfDoc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
  const numPages = pdfDoc.numPages;

  let renderScale = 1.2;
  let jpegQuality = 0.65;

  if (targetPreset === '50kb') {
    renderScale = 0.85;
    jpegQuality = 0.40;
  } else if (targetPreset === '100kb') {
    renderScale = 1.0;
    jpegQuality = 0.52;
  } else if (targetPreset === '200kb') {
    renderScale = 1.25;
    jpegQuality = 0.68;
  } else {
    const q = Math.max(0.1, Math.min(0.95, customQuality));
    renderScale = Math.max(0.75, Math.min(1.8, 0.6 + q * 1.1));
    jpegQuality = q;
  }

  // Get first page to initialize dimensions
  const firstPage = await pdfDoc.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: renderScale });
  const isLandscape = firstViewport.width > firstViewport.height;

  const outputPdf = new jsPDF({
    orientation: isLandscape ? 'l' : 'p',
    unit: 'pt',
    format: [firstViewport.width, firstViewport.height],
    compress: true,
  });

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const progress = Math.round(((pageNum - 1) / numPages) * 100);
    if (onProgress) {
      onProgress(progress, `Compressing page ${pageNum} of ${numPages}...`);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imgData = canvas.toDataURL('image/jpeg', jpegQuality);

    if (pageNum > 1) {
      const pageIsLandscape = viewport.width > viewport.height;
      outputPdf.addPage([viewport.width, viewport.height], pageIsLandscape ? 'l' : 'p');
    }

    outputPdf.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height, undefined, 'FAST');
  }

  if (onProgress) {
    onProgress(100, 'Finalizing compressed document...');
  }

  const compressedBlob = outputPdf.output('blob');
  const compressedUrl = URL.createObjectURL(compressedBlob);
  const size = compressedBlob.size;
  const reductionPercentage = originalSize > 0 ? Math.max(0, Math.round(((originalSize - size) / originalSize) * 100)) : 0;

  return {
    blob: compressedBlob,
    url: compressedUrl,
    size,
    originalSize,
    reductionPercentage,
  };
}
