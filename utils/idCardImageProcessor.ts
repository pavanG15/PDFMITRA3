/**
 * Pure HTML5 Canvas Image Processing for Aadhaar / ID Cards
 * - Projective 4-corner perspective homography warp into exact CR80 (85.6mm x 54mm)
 * - Auto-rotation (portrait -> landscape) & clean CR80 aspect normalization
 * - Non-destructive print enhancement filters: Original, Magic Color, Xerox B&W
 */

export type IDCardFilterType = 'original' | 'magic_color' | 'xerox_bw';

export interface Point {
  x: number;
  y: number;
}

export const CR80_ASPECT_RATIO = 85.6 / 54.0; // ~1.585185

/**
 * Safely loads a Data URL, Blob URL, or HTTP URL into an HTMLImageElement.
 * Avoids setting crossOrigin on data:/blob: URLs to prevent WebView load stalls.
 */
export function loadIdImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load ID card image'));
    img.src = src;
  });
}

/**
 * Rotates a Data URL by 90 degrees clockwise.
 */
export async function rotateDataUrl90Clockwise(dataUrl: string): Promise<string> {
  const img = await loadIdImage(dataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = h;
  canvas.height = w;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Automatically prepares a pre-cropped ID card (e.g. from Android ML Kit):
 * 1. Auto-rotates 90 degrees if portrait (height > width)
 * 2. Normalizes cleanly into exact CR80 85.6:54 landscape rectangle
 *    without table/bedsheet background margins
 */
export async function autoPrepareLandscapeCR80(dataUrl: string): Promise<string> {
  const img = await loadIdImage(dataUrl);
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  // Draw onto working canvas (rotating if portrait)
  const workCanvas = document.createElement('canvas');
  const workCtx = workCanvas.getContext('2d');
  if (!workCtx) return dataUrl;

  if (srcH > srcW) {
    workCanvas.width = srcH;
    workCanvas.height = srcW;
    workCtx.translate(workCanvas.width / 2, workCanvas.height / 2);
    workCtx.rotate(Math.PI / 2);
    workCtx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
    const tmp = srcW;
    srcW = srcH;
    srcH = tmp;
  } else {
    workCanvas.width = srcW;
    workCanvas.height = srcH;
    workCtx.drawImage(img, 0, 0, srcW, srcH);
  }

  // Output canvas at CR80 aspect (minimum 1011px wide = 300 DPI for 85.6mm, capped at 1800px)
  const targetW = Math.min(1800, Math.max(1011, srcW));
  const targetH = Math.round(targetW / CR80_ASPECT_RATIO);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetW;
  outCanvas.height = targetH;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return workCanvas.toDataURL('image/jpeg', 0.95);

  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, targetW, targetH);

  // Center-crop ("cover") slightly only when aspect ratio is close; otherwise clean center fit
  // Since auto-cropped cards from ML Kit have edge bounds ~CR80, cover removes stray dark edges
  const srcAspect = srcW / srcH;
  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (srcAspect > CR80_ASPECT_RATIO) {
    cropW = Math.round(srcH * CR80_ASPECT_RATIO);
    cropX = Math.round((srcW - cropW) / 2);
  } else if (srcAspect < CR80_ASPECT_RATIO) {
    cropH = Math.round(srcW / CR80_ASPECT_RATIO);
    cropY = Math.round((srcH - cropH) / 2);
  }

  outCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);
  return outCanvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Solves an 8x8 linear system A * x = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem8(A: number[][], b: number[]): number[] | null {
  const n = 8;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(M[r][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }
    if (maxVal < 1e-10) return null;

    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }

    const pivot = M[col][col];
    for (let c = col; c <= n; c++) {
      M[col][c] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Computes projective homography coefficients [h0..h7] mapping
 * destination rectangle (dstW x dstH) -> source quadrilateral [TL, TR, BR, BL].
 */
function computeInverseHomography(
  dstW: number,
  dstH: number,
  srcCorners: [Point, Point, Point, Point]
): number[] | null {
  const dstPoints: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const u = dstPoints[i].x;
    const v = dstPoints[i].y;
    const x = srcCorners[i].x;
    const y = srcCorners[i].y;

    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  return solveLinearSystem8(A, b);
}

/**
 * Warps an arbitrary 4-corner quadrilateral (normalized 0..1 coords: [TL, TR, BR, BL])
 * into a crisp CR80 (85.6 x 54 mm) landscape rectangle using projective homography + bilinear filtering.
 */
export async function warpPerspectiveToCR80(
  dataUrl: string,
  normalizedCorners: [Point, Point, Point, Point],
  targetAspect: number = CR80_ASPECT_RATIO
): Promise<string> {
  const img = await loadIdImage(dataUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Draw source onto offscreen canvas to read pixel buffer safely
  // Downscale ultra-massive camera photos (e.g. 8000px) to max 3200px first for mobile RAM safety
  const maxSrcDim = 3200;
  let readW = srcW;
  let readH = srcH;
  if (readW > maxSrcDim || readH > maxSrcDim) {
    const scale = Math.min(maxSrcDim / readW, maxSrcDim / readH);
    readW = Math.round(readW * scale);
    readH = Math.round(readH * scale);
  }

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = readW;
  srcCanvas.height = readH;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) return dataUrl;
  srcCtx.drawImage(img, 0, 0, readW, readH);
  const srcPixels = srcCtx.getImageData(0, 0, readW, readH).data;

  const srcCorners: [Point, Point, Point, Point] = [
    { x: normalizedCorners[0].x * (readW - 1), y: normalizedCorners[0].y * (readH - 1) },
    { x: normalizedCorners[1].x * (readW - 1), y: normalizedCorners[1].y * (readH - 1) },
    { x: normalizedCorners[2].x * (readW - 1), y: normalizedCorners[2].y * (readH - 1) },
    { x: normalizedCorners[3].x * (readW - 1), y: normalizedCorners[3].y * (readH - 1) },
  ];

  // Estimate destination width in pixels (~300 to 475 DPI on 85.6mm CR80)
  const topWidth = Math.hypot(srcCorners[1].x - srcCorners[0].x, srcCorners[1].y - srcCorners[0].y);
  const bottomWidth = Math.hypot(srcCorners[2].x - srcCorners[3].x, srcCorners[2].y - srcCorners[3].y);
  const estWidth = Math.max(topWidth, bottomWidth);

  const dstW = Math.max(1011, Math.min(1600, Math.round(estWidth)));
  const dstH = Math.round(dstW / targetAspect);

  const H = computeInverseHomography(dstW - 1, dstH - 1, srcCorners);
  if (!H) {
    return autoPrepareLandscapeCR80(dataUrl);
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstW;
  dstCanvas.height = dstH;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) return dataUrl;

  const dstImg = dstCtx.createImageData(dstW, dstH);
  const dstData = dstImg.data;
  const maxX = readW - 1;
  const maxY = readH - 1;

  for (let v = 0; v < dstH; v++) {
    const h1v_h2 = h1 * v + h2;
    const h4v_h5 = h4 * v + h5;
    const h7v_1 = h7 * v + 1;
    let outOffset = v * dstW * 4;

    for (let u = 0; u < dstW; u++) {
      const denom = h6 * u + h7v_1;
      const sx = (h0 * u + h1v_h2) / denom;
      const sy = (h3 * u + h4v_h5) / denom;

      const xClamped = sx < 0 ? 0 : sx > maxX ? maxX : sx;
      const yClamped = sy < 0 ? 0 : sy > maxY ? maxY : sy;

      const x0 = xClamped | 0;
      const y0 = yClamped | 0;
      const x1 = x0 < maxX ? x0 + 1 : maxX;
      const y1 = y0 < maxY ? y0 + 1 : maxY;

      const dx = xClamped - x0;
      const dy = yClamped - y0;
      const w00 = (1 - dx) * (1 - dy);
      const w10 = dx * (1 - dy);
      const w01 = (1 - dx) * dy;
      const w11 = dx * dy;

      const idx00 = (y0 * readW + x0) * 4;
      const idx10 = (y0 * readW + x1) * 4;
      const idx01 = (y1 * readW + x0) * 4;
      const idx11 = (y1 * readW + x1) * 4;

      dstData[outOffset] =
        srcPixels[idx00] * w00 +
        srcPixels[idx10] * w10 +
        srcPixels[idx01] * w01 +
        srcPixels[idx11] * w11;
      dstData[outOffset + 1] =
        srcPixels[idx00 + 1] * w00 +
        srcPixels[idx10 + 1] * w10 +
        srcPixels[idx01 + 1] * w01 +
        srcPixels[idx11 + 1] * w11;
      dstData[outOffset + 2] =
        srcPixels[idx00 + 2] * w00 +
        srcPixels[idx10 + 2] * w10 +
        srcPixels[idx01 + 2] * w01 +
        srcPixels[idx11 + 2] * w11;
      dstData[outOffset + 3] = 255;

      outOffset += 4;
    }
  }

  dstCtx.putImageData(dstImg, 0, 0);
  return dstCanvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Applies a fast 3x3 unsharp-mask pass on RGB buffer to sharpen Aadhaar text & QR modules.
 */
function applyUnsharpMask(data: Uint8ClampedArray, w: number, h: number, strength = 0.45): void {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = (row + x) * 4;
      const up = ((y - 1) * w + x) * 4;
      const dn = ((y + 1) * w + x) * 4;
      const lf = (row + x - 1) * 4;
      const rt = (row + x + 1) * 4;

      for (let c = 0; c < 3; c++) {
        const blur =
          (copy[idx + c] * 4 + copy[up + c] + copy[dn + c] + copy[lf + c] + copy[rt + c]) *
          0.125;
        const val = copy[idx + c] + (copy[idx + c] - blur) * strength;
        data[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
    }
  }
}

/**
 * Non-destructively applies a print enhancement filter to a cropped card image.
 * Always pass the un-filtered cropped image (`rawCropped`) so switching filters never degrades quality.
 */
export async function applyIdCardFilter(
  croppedDataUrl: string,
  filter: IDCardFilterType
): Promise<string> {
  if (filter === 'original') {
    return croppedDataUrl;
  }

  const img = await loadIdImage(croppedDataUrl);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  // Cap at 1600px width for crisp ~475 DPI output with responsive filtering
  const maxW = 1600;
  if (w > maxW) {
    const scale = maxW / w;
    w = maxW;
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return croppedDataUrl;

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Build luminance histogram from sampled pixels for fast white-point / shadow estimation
  const hist = new Uint32Array(256);
  let sampleCount = 0;
  for (let i = 0; i < data.length; i += 16) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[lum < 0 ? 0 : lum > 255 ? 255 : lum]++;
    sampleCount++;
  }

  const findPercentile = (pct: number, fallback: number): number => {
    const target = Math.floor(sampleCount * pct);
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= target) return i;
    }
    return fallback;
  };

  if (filter === 'magic_color') {
    // Magic Color: neutralize shadow/gray cast by stretching to clean white background + sharpen + boost color
    const blackPt = Math.min(48, findPercentile(0.02, 12));
    const whitePt = Math.max(175, findPercentile(0.88, 232));
    const span = Math.max(40, whitePt - blackPt);

    for (let i = 0; i < data.length; i += 4) {
      let r = ((data[i] - blackPt) * 255) / span;
      let g = ((data[i + 1] - blackPt) * 255) / span;
      let b = ((data[i + 2] - blackPt) * 255) / span;

      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;

      // Subtle saturation & clarity boost while pulling near-white paper cleanly to 255
      const avg = 0.299 * r + 0.587 * g + 0.114 * b;
      if (avg > 224) {
        const pull = Math.min(1, (avg - 224) / 31);
        r = r + (255 - r) * pull * 0.65;
        g = g + (255 - g) * pull * 0.65;
        b = b + (255 - b) * pull * 0.65;
      } else {
        const satBoost = 1.18;
        r = avg + (r - avg) * satBoost;
        g = avg + (g - avg) * satBoost;
        b = avg + (b - avg) * satBoost;
      }

      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }

    applyUnsharpMask(data, w, h, 0.55);
  } else if (filter === 'xerox_bw') {
    // Xerox B&W: Crisp high-contrast grayscale photocopy mode (pure white paper, deep black text, preserved portrait midtones)
    const blackPt = Math.min(72, findPercentile(0.05, 32));
    const whitePt = Math.max(155, findPercentile(0.72, 205));
    const span = Math.max(40, whitePt - blackPt);

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      let norm = (lum - blackPt) / span;
      norm = norm < 0 ? 0 : norm > 1 ? 1 : norm;

      // S-curve contrast tailored for crisp photocopy text + readable QR
      const contrasted = norm < 0.5
        ? Math.pow(norm * 2, 1.35) * 0.5
        : 1 - Math.pow((1 - norm) * 2, 1.45) * 0.5;

      let out = Math.round(contrasted * 255);
      if (out > 230) out = 255;
      else if (out < 26) out = 0;

      data[i] = out;
      data[i + 1] = out;
      data[i + 2] = out;
    }

    applyUnsharpMask(data, w, h, 0.6);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.94);
}
