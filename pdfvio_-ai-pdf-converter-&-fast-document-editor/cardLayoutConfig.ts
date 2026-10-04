/**
 * Shared A4 ID Card Layout Configuration
 * 
 * Single source of truth for:
 * 1. Live A4 PDF Preview component
 * 2. jsPDF generator
 * 
 * Ensures that dimensions, margins, cut guides, aspect ratios,
 * and positioning in mm can NEVER differ between the preview and the generated PDF.
 */

export const A4_PAGE_WIDTH_MM = 210;
export const A4_PAGE_HEIGHT_MM = 297;

export type CardLayoutType = 'standard' | 'large';

export interface CardSizeConfig {
  id: CardLayoutType;
  name: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number;
}

export const CARD_SIZES: Record<CardLayoutType, CardSizeConfig> = {
  standard: {
    id: 'standard',
    name: 'Standard (85.6 × 54 mm)',
    shortLabel: '85.6 × 54 mm',
    widthMm: 85.6,
    heightMm: 54.0,
    aspectRatio: 85.6 / 54.0, // ~1.585185 (ISO/IEC 7810 ID-1)
  },
  large: {
    id: 'large',
    name: 'Large (110 × 69.4 mm)',
    shortLabel: '110 × 69.4 mm',
    widthMm: 110.0,
    heightMm: 69.4,
    aspectRatio: 110.0 / 69.4, // ~1.585014
  },
};

export interface ComputedA4CardLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  slotWidthMm: number;
  slotHeightMm: number;
  gapMm: number;
  labelHeightMm: number;
  labelMarginBottomMm: number;
  startX: number;
  startY: number;
  totalHeightMm: number;

  // Front side positions (in mm)
  frontLabelY: number;
  frontSlotY: number;

  // Back side positions (in mm)
  backLabelY: number;
  backSlotY: number;

  // Percentage values of A4 page (for exact CSS preview positioning)
  preview: {
    slotWidthPct: number;
    slotHeightPct: number;
    leftPct: number;
    frontLabelTopPct: number;
    frontSlotTopPct: number;
    backLabelTopPct: number;
    backSlotTopPct: number;
    labelHeightPct: number;
  };
}

/**
 * Computes exact millimeter and percentage coordinates for a given layout size.
 */
export function getA4CardLayout(layoutType: CardLayoutType): ComputedA4CardLayout {
  const size = CARD_SIZES[layoutType] || CARD_SIZES.standard;
  const slotWidthMm = size.widthMm;
  const slotHeightMm = size.heightMm;

  const gapMm = 16.0;
  const labelHeightMm = 5.0;
  const labelMarginBottomMm = 2.0;

  // One card unit = label height + margin + slot height
  const oneUnitHeight = labelHeightMm + labelMarginBottomMm + slotHeightMm;
  const totalHeightMm = oneUnitHeight * 2 + gapMm;

  // Centering on A4 page
  const startX = (A4_PAGE_WIDTH_MM - slotWidthMm) / 2;
  const startY = Math.max(20, (A4_PAGE_HEIGHT_MM - totalHeightMm) / 2);

  // Front side
  const frontLabelY = startY;
  const frontSlotY = frontLabelY + labelHeightMm + labelMarginBottomMm;

  // Back side
  const backLabelY = frontSlotY + slotHeightMm + gapMm;
  const backSlotY = backLabelY + labelHeightMm + labelMarginBottomMm;

  // Preview percentages relative to A4 page dimensions
  const preview = {
    slotWidthPct: (slotWidthMm / A4_PAGE_WIDTH_MM) * 100,
    slotHeightPct: (slotHeightMm / A4_PAGE_HEIGHT_MM) * 100,
    leftPct: (startX / A4_PAGE_WIDTH_MM) * 100,
    frontLabelTopPct: (frontLabelY / A4_PAGE_HEIGHT_MM) * 100,
    frontSlotTopPct: (frontSlotY / A4_PAGE_HEIGHT_MM) * 100,
    backLabelTopPct: (backLabelY / A4_PAGE_HEIGHT_MM) * 100,
    backSlotTopPct: (backSlotY / A4_PAGE_HEIGHT_MM) * 100,
    labelHeightPct: (labelHeightMm / A4_PAGE_HEIGHT_MM) * 100,
  };

  return {
    pageWidthMm: A4_PAGE_WIDTH_MM,
    pageHeightMm: A4_PAGE_HEIGHT_MM,
    slotWidthMm,
    slotHeightMm,
    gapMm,
    labelHeightMm,
    labelMarginBottomMm,
    startX,
    startY,
    totalHeightMm,
    frontLabelY,
    frontSlotY,
    backLabelY,
    backSlotY,
    preview,
  };
}

export interface EditableCardState {
  id: 'front' | 'back';
  title: string;
  marathiTitle: string;
  hindiTitle: string;
  x: number; // in mm
  y: number; // in mm
  width: number; // in mm
  height: number; // in mm
  rotation: number; // degrees (0 - 360)
  zIndex: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}

export interface CanvasEditorViewOptions {
  showCutGuides: boolean;
  showLabels: boolean;
  showGrid: boolean;
  snapToGuides: boolean;
  lockAspectRatio: boolean;
}

export const DEFAULT_VIEW_OPTIONS: CanvasEditorViewOptions = {
  showCutGuides: true,
  showLabels: true,
  showGrid: false,
  snapToGuides: true,
  lockAspectRatio: true,
};

export const STORAGE_KEY_LAYOUT = 'aadhaar_editor_layout_v2';
export const STORAGE_KEY_OPTIONS = 'aadhaar_editor_options_v2';

/**
 * Computes default front and back card positions in millimeters for a given size preset.
 */
export function getDefaultCardStates(layoutType: CardLayoutType = 'standard'): Record<'front' | 'back', EditableCardState> {
  const layout = getA4CardLayout(layoutType);
  return {
    front: {
      id: 'front',
      title: 'FRONT SIDE',
      marathiTitle: 'समोरची बाजू',
      hindiTitle: 'सामने की फोटो',
      x: Math.round(layout.startX * 10) / 10,
      y: Math.round(layout.frontSlotY * 10) / 10,
      width: Math.round(layout.slotWidthMm * 10) / 10,
      height: Math.round(layout.slotHeightMm * 10) / 10,
      rotation: 0,
      zIndex: 10,
      flipHorizontal: false,
      flipVertical: false,
    },
    back: {
      id: 'back',
      title: 'BACK SIDE',
      marathiTitle: 'मागील बाजू',
      hindiTitle: 'पीछे की फोटो',
      x: Math.round(layout.startX * 10) / 10,
      y: Math.round(layout.backSlotY * 10) / 10,
      width: Math.round(layout.slotWidthMm * 10) / 10,
      height: Math.round(layout.slotHeightMm * 10) / 10,
      rotation: 0,
      zIndex: 20,
      flipHorizontal: false,
      flipVertical: false,
    },
  };
}

/**
 * Safely loads user saved layout from localStorage.
 */
export function loadSavedCardLayout(defaultPreset: CardLayoutType = 'standard'): {
  cards: Record<'front' | 'back', EditableCardState>;
  options: CanvasEditorViewOptions;
  preset: CardLayoutType;
} {
  try {
    const rawCards = localStorage.getItem(STORAGE_KEY_LAYOUT);
    const rawOpts = localStorage.getItem(STORAGE_KEY_OPTIONS);
    const defaults = getDefaultCardStates(defaultPreset);

    let cards = defaults;
    if (rawCards) {
      const parsed = JSON.parse(rawCards);
      if (parsed?.front && parsed?.back) {
        cards = {
          front: { ...defaults.front, ...parsed.front },
          back: { ...defaults.back, ...parsed.back },
        };
      }
    }

    let options = DEFAULT_VIEW_OPTIONS;
    let preset: CardLayoutType = defaultPreset;
    if (rawOpts) {
      const parsedOpts = JSON.parse(rawOpts);
      options = { ...DEFAULT_VIEW_OPTIONS, ...parsedOpts.options };
      if (parsedOpts.preset === 'standard' || parsedOpts.preset === 'large') {
        preset = parsedOpts.preset;
      }
    }

    return { cards, options, preset };
  } catch (e) {
    console.warn('Failed to load saved layout from localStorage, using defaults', e);
    return {
      cards: getDefaultCardStates(defaultPreset),
      options: DEFAULT_VIEW_OPTIONS,
      preset: defaultPreset,
    };
  }
}

/**
 * Safely saves user layout and view options to localStorage.
 */
export function saveCardLayoutToStorage(
  cards: Record<'front' | 'back', EditableCardState>,
  options: CanvasEditorViewOptions,
  preset: CardLayoutType
): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(cards));
    localStorage.setItem(STORAGE_KEY_OPTIONS, JSON.stringify({ options, preset }));
  } catch (e) {
    console.warn('Failed to persist layout to localStorage', e);
  }
}

/**
 * Prepares an image for jsPDF export:
 * - Applies flips (horizontal / vertical)
 * - Limits maximum pixel dimension to maxPixel (default 2400) to protect memory on mobile WebViews
 * - Preserves object-fit: contain aspect ratio
 */
export async function prepareCardImageForPdf(
  imgData: string,
  slotWidthMm: number,
  slotHeightMm: number,
  flipH = false,
  flipV = false,
  maxPixel = 2400
): Promise<{ dataUrl: string; widthMm: number; heightMm: number; renderWidthMm: number; renderHeightMm: number; offsetX: number; offsetY: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = (e) => reject(e);
    el.src = imgData;
  });

  const imgAspect = img.width / img.height;
  const slotAspect = slotWidthMm / slotHeightMm;

  let renderW = slotWidthMm;
  let renderH = slotHeightMm;

  if (imgAspect > slotAspect) {
    renderW = slotWidthMm;
    renderH = slotWidthMm / imgAspect;
  } else {
    renderH = slotHeightMm;
    renderW = slotHeightMm * imgAspect;
  }

  const offsetX = (slotWidthMm - renderW) / 2;
  const offsetY = (slotHeightMm - renderH) / 2;

  // If flipped or needs downscaling for mobile memory safety:
  const dpr = 11.811; // 300 DPI
  let canvasW = Math.round(renderW * dpr);
  let canvasH = Math.round(renderH * dpr);

  if (canvasW > maxPixel || canvasH > maxPixel) {
    const ratio = Math.min(maxPixel / canvasW, maxPixel / canvasH);
    canvasW = Math.round(canvasW * ratio);
    canvasH = Math.round(canvasH * ratio);
  }

  if (flipH || flipV || img.width > maxPixel || img.height > maxPixel) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(img, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
      ctx.restore();
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        widthMm: slotWidthMm,
        heightMm: slotHeightMm,
        renderWidthMm: renderW,
        renderHeightMm: renderH,
        offsetX,
        offsetY,
      };
    }
  }

  return {
    dataUrl: imgData,
    widthMm: slotWidthMm,
    heightMm: slotHeightMm,
    renderWidthMm: renderW,
    renderHeightMm: renderH,
    offsetX,
    offsetY,
  };
}

export interface RenderedPdfCardResult {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  x: number;
  y: number;
  width: number;
  height: number;
  corners: Array<{ x: number; y: number }>;
}

/**
 * Prepares and renders a card for jsPDF export with:
 * - Exact millimeter dimensions and positioning
 * - Object-fit: contain
 * - Flips (horizontal / vertical)
 * - Canvas rotation to guarantee 100% accurate rendering in jsPDF across all mobile browsers
 * - 300 DPI sharpness with maxPixel capping to protect device memory
 */
export async function renderCardForPdf(
  card: EditableCardState,
  imgData: string,
  maxPixel = 2400
): Promise<RenderedPdfCardResult> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = (e) => reject(e);
    el.src = imgData;
  });

  const slotW = card.width;
  const slotH = card.height;
  const imgAspect = img.width / img.height;
  const slotAspect = slotW / slotH;

  let renderW = slotW;
  let renderH = slotH;

  if (imgAspect > slotAspect) {
    renderW = slotW;
    renderH = slotW / imgAspect;
  } else {
    renderH = slotH;
    renderW = slotH * imgAspect;
  }

  const dpr = 11.811; // 300 DPI (300 dots / 25.4 mm)
  let canvasW = Math.round(slotW * dpr);
  let canvasH = Math.round(slotH * dpr);

  if (canvasW > maxPixel || canvasH > maxPixel) {
    const ratio = Math.min(maxPixel / canvasW, maxPixel / canvasH);
    canvasW = Math.round(canvasW * ratio);
    canvasH = Math.round(canvasH * ratio);
  }

  const drawW = Math.round(renderW * (canvasW / slotW));
  const drawH = Math.round(renderH * (canvasH / slotH));
  const drawX = Math.round((canvasW - drawW) / 2);
  const drawY = Math.round((canvasH - drawH) / 2);

  const cx = card.x + card.width / 2;
  const cy = card.y + card.height / 2;
  const normRotation = ((card.rotation % 360) + 360) % 360;

  const corners = calculateRotatedCardCorners(cx, cy, card.width, card.height, normRotation);

  if (normRotation === 0 && !card.flipHorizontal && !card.flipVertical) {
    // Fast path for non-rotated, non-flipped cards
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        format: 'JPEG',
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        corners,
      };
    }
  }

  // If rotated or flipped: rotate precisely on high-DPI canvas
  const rad = (normRotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  const rotCanvasW = Math.ceil(canvasW * cos + canvasH * sin);
  const rotCanvasH = Math.ceil(canvasW * sin + canvasH * cos);

  const canvas = document.createElement('canvas');
  canvas.width = rotCanvasW;
  canvas.height = rotCanvasH;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.save();
    ctx.translate(rotCanvasW / 2, rotCanvasH / 2);
    ctx.rotate(rad);
    ctx.scale(card.flipHorizontal ? -1 : 1, card.flipVertical ? -1 : 1);

    // Card white background inside the card slot
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-canvasW / 2, -canvasH / 2, canvasW, canvasH);

    // Draw contained card image
    ctx.drawImage(img, -canvasW / 2 + drawX, -canvasH / 2 + drawY, drawW, drawH);
    ctx.restore();

    const boxWidthMm = card.width * cos + card.height * sin;
    const boxHeightMm = card.width * sin + card.height * cos;
    const boxX = cx - boxWidthMm / 2;
    const boxY = cy - boxHeightMm / 2;

    return {
      dataUrl: canvas.toDataURL('image/png'),
      format: 'PNG',
      x: boxX,
      y: boxY,
      width: boxWidthMm,
      height: boxHeightMm,
      corners,
    };
  }

  return {
    dataUrl: imgData,
    format: 'JPEG',
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
    corners,
  };
}

/**
 * Calculates top-left coordinate for jsPDF addImage to rotate around center (cx, cy)
 */
export function calculateRotatedTopLeft(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotationDeg: number
): { x: number; y: number } {
  const rad = ((rotationDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const x = cx - (width / 2) * cos + (height / 2) * sin;
  const y = cy - (width / 2) * sin - (height / 2) * cos;

  return { x, y };
}

/**
 * Calculates the 4 rotated corner coordinates in mm for drawing dashed cut guides
 */
export function calculateRotatedCardCorners(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotationDeg: number
): Array<{ x: number; y: number }> {
  const rad = ((rotationDeg % 360) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const halfW = width / 2;
  const halfH = height / 2;

  const localCorners = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];

  return localCorners.map((pt) => ({
    x: cx + pt.x * cos - pt.y * sin,
    y: cy + pt.x * sin + pt.y * cos,
  }));
}

/**
 * Creates a high-resolution canvas image of bilingual (English + Devanagari) label.
 * This completely avoids jsPDF encoding issues with Devanagari Marathi text.
 */
export function createBilingualLabelImage(
  englishText: string,
  marathiText: string,
  widthMm: number,
  heightMm: number
): string {
  const dpr = 3; // 3x supersampling for razor sharp 300+ DPI PDF export
  const canvasWidth = Math.max(100, Math.round(widthMm * 10 * dpr));
  const canvasHeight = Math.max(20, Math.round(heightMm * 10 * dpr));

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Modern styling: subtle uppercase label
  const fontSize = Math.round(heightMm * 2.2 * dpr);
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif`;
  ctx.fillStyle = '#64748b'; // Slate 500
  ctx.textBaseline = 'middle';

  const fullText = `${englishText} (${marathiText})`;
  ctx.fillText(fullText, 0, canvasHeight / 2);

  return canvas.toDataURL('image/png');
}


