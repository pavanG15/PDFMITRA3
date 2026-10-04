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
