import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../i18n';
import {
  Point,
  loadIdImage,
  rotateDataUrl90Clockwise,
  autoPrepareLandscapeCR80,
  warpPerspectiveToCR80,
} from '../utils/idCardImageProcessor';

interface CardCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropDone: (croppedDataUrl: string) => void;
  sideTitle: string;
  onEnsureCameraStopped?: () => void;
}

const DEFAULT_CORNERS: [Point, Point, Point, Point] = [
  { x: 0.06, y: 0.08 }, // Top-Left
  { x: 0.94, y: 0.08 }, // Top-Right
  { x: 0.94, y: 0.92 }, // Bottom-Right
  { x: 0.06, y: 0.92 }, // Bottom-Left
];

interface ImgBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export const CardCropModal: React.FC<CardCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropDone,
  sideTitle,
  onEnsureCameraStopped,
}) => {
  const { language } = useLanguage();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [currentImage, setCurrentImage] = useState<string | null>(imageSrc);
  const [corners, setCorners] = useState<[Point, Point, Point, Point]>(DEFAULT_CORNERS);
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  const [imgBounds, setImgBounds] = useState<ImgBounds | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const dragCornerRef = useRef<{ index: number } | null>(null);

  // Compute rendered image rectangle inside stage (object-contain geometry)
  const measureStageAndImage = useCallback(() => {
    const stage = stageRef.current;
    const img = loadedImgRef.current;
    if (!stage || !img) return;

    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!stageW || !stageH || !natW || !natH) return;

    // Slight padding so corner handles at 0 or 1 remain comfortable to touch
    const pad = 16;
    const availW = Math.max(100, stageW - pad * 2);
    const availH = Math.max(100, stageH - pad * 2);

    const scale = Math.min(availW / natW, availH / natH);
    const renderW = natW * scale;
    const renderH = natH * scale;
    const left = (stageW - renderW) / 2;
    const top = (stageH - renderH) / 2;

    setImgBounds({
      left,
      top,
      width: renderW,
      height: renderH,
      naturalWidth: natW,
      naturalHeight: natH,
    });
  }, []);

  // Load image whenever modal opens or image rotates
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setCurrentImage(null);
      loadedImgRef.current = null;
      setImgBounds(null);
      return;
    }

    setCurrentImage(imageSrc);
    setCorners(DEFAULT_CORNERS.map((p) => ({ ...p })) as [Point, Point, Point, Point]);
    setActiveCorner(null);
  }, [imageSrc, isOpen]);

  useEffect(() => {
    if (!isOpen || !currentImage) return;
    let cancelled = false;

    loadIdImage(currentImage)
      .then((img) => {
        if (cancelled) return;
        loadedImgRef.current = img;
        measureStageAndImage();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentImage, isOpen, measureStageAndImage]);

  // Re-measure on resize
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('resize', measureStageAndImage);
    return () => window.removeEventListener('resize', measureStageAndImage);
  }, [isOpen, measureStageAndImage]);

  // Lock background scroll & Escape key cleanup
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEnsureCameraStopped?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose, onEnsureCameraStopped]);

  // Draw 2.5x zoom loupe magnifier whenever activeCorner moves
  useEffect(() => {
    if (activeCorner === null || !loupeCanvasRef.current || !loadedImgRef.current) return;
    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = loadedImgRef.current;
    if (!ctx) return;

    const pt = corners[activeCorner];
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const srcX = pt.x * natW;
    const srcY = pt.y * natH;

    // Sample box around dragged corner in natural pixels
    const sampleSpan = Math.min(natW, natH) * 0.22;
    const sx = srcX - sampleSpan / 2;
    const sy = srcY - sampleSpan / 2;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    ctx.drawImage(img, sx, sy, sampleSpan, sampleSpan, 0, 0, size, size);

    // Precision crosshair in center of loupe
    const mid = size / 2;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mid - 14, mid);
    ctx.lineTo(mid + 14, mid);
    ctx.moveTo(mid, mid - 14);
    ctx.lineTo(mid, mid + 14);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(mid, mid, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [activeCorner, corners]);

  const handleCloseSafe = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onEnsureCameraStopped?.();
    onClose();
  };

  const handleCornerPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    dragCornerRef.current = { index };
    setActiveCorner(index);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleStagePointerMove = (e: React.PointerEvent) => {
    const drag = dragCornerRef.current;
    if (!drag || !stageRef.current || !imgBounds) return;
    e.stopPropagation();
    e.preventDefault();

    const stageRect = stageRef.current.getBoundingClientRect();
    const relX = (e.clientX - stageRect.left - imgBounds.left) / imgBounds.width;
    const relY = (e.clientY - stageRect.top - imgBounds.top) / imgBounds.height;

    const clampedX = Math.max(0, Math.min(1, relX));
    const clampedY = Math.max(0, Math.min(1, relY));

    setCorners((prev) => {
      const next = prev.map((p) => ({ ...p })) as [Point, Point, Point, Point];
      next[drag.index] = { x: clampedX, y: clampedY };
      return next;
    });
  };

  const handleStagePointerUp = (e: React.PointerEvent) => {
    if (dragCornerRef.current) {
      e.stopPropagation();
      dragCornerRef.current = null;
      setActiveCorner(null);
    }
  };

  const handleRotate90 = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentImage || isProcessing) return;
    setIsProcessing(true);
    try {
      const rotated = await rotateDataUrl90Clockwise(currentImage);
      setCurrentImage(rotated);
      setCorners(DEFAULT_CORNERS.map((p) => ({ ...p })) as [Point, Point, Point, Point]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetCorners = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCorners(DEFAULT_CORNERS.map((p) => ({ ...p })) as [Point, Point, Point, Point]);
  };

  const handleFullImageCorners = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCorners([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
  };

  const handleApplyWarp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentImage || isProcessing) return;
    setIsProcessing(true);
    try {
      const warped = await warpPerspectiveToCR80(currentImage, corners);
      onEnsureCameraStopped?.();
      onCropDone(warped);
      onClose();
    } catch (err) {
      console.error('Perspective warp failed, falling back to autoPrepare:', err);
      const fallback = await autoPrepareLandscapeCR80(currentImage);
      onEnsureCameraStopped?.();
      onCropDone(fallback);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseAsIs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentImage || isProcessing) return;
    setIsProcessing(true);
    try {
      const prepared = await autoPrepareLandscapeCR80(currentImage);
      onEnsureCameraStopped?.();
      onCropDone(prepared);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !currentImage) return null;

  // Pixel coordinates on stage for SVG polygon & handles
  const stageW = stageRef.current?.clientWidth || 400;
  const stageH = stageRef.current?.clientHeight || 300;
  const ptsPx = imgBounds
    ? corners.map((c) => ({
        x: imgBounds.left + c.x * imgBounds.width,
        y: imgBounds.top + c.y * imgBounds.height,
      }))
    : [];

  const lerpPt = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  // Determine loupe corner placement opposite the active dragged corner
  const loupeOnRight = activeCorner !== null && corners[activeCorner].x < 0.5;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
      onClick={handleCloseSafe}
    >
      <div
        className="relative w-full max-w-xl max-h-[96vh] sm:max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col my-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <i className="fas fa-crop-simple text-sm"></i>
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base leading-tight truncate">
                {language === 'mr'
                  ? '४ कोपरे क्रॉप करा'
                  : language === 'hi'
                  ? '4 कोने क्रॉप करें'
                  : '4-Corner Perspective Crop'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                {sideTitle} •{' '}
                {language === 'mr'
                  ? 'कोपरे ओढून कार्ड सरळ करा (85.6 × 54 mm)'
                  : language === 'hi'
                  ? 'कोनों को खींचकर कार्ड सीधा करें (85.6 × 54 mm)'
                  : 'Drag corners onto card edges → 85.6 × 54 mm'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseSafe}
            aria-label="Close"
            className="w-10 h-10 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95 shrink-0"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {/* Interactive 4-Corner Perspective Stage */}
        <div
          ref={stageRef}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          className="relative flex-1 min-h-[290px] max-h-[58vh] bg-slate-950 overflow-hidden select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Underlying image */}
          {imgBounds && (
            <img
              src={currentImage}
              alt={sideTitle}
              draggable={false}
              className="absolute pointer-events-none select-none"
              style={{
                left: `${imgBounds.left}px`,
                top: `${imgBounds.top}px`,
                width: `${imgBounds.width}px`,
                height: `${imgBounds.height}px`,
              }}
            />
          )}

          {/* SVG Mask + Perspective Grid + Quad Edges */}
          {imgBounds && ptsPx.length === 4 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${stageW} ${stageH}`}
            >
              {/* Darkened outside area with quad cutout */}
              <path
                fillRule="evenodd"
                fill="rgba(2, 6, 23, 0.62)"
                d={`M 0 0 H ${stageW} V ${stageH} H 0 Z M ${ptsPx[0].x} ${ptsPx[0].y} L ${ptsPx[1].x} ${ptsPx[1].y} L ${ptsPx[2].x} ${ptsPx[2].y} L ${ptsPx[3].x} ${ptsPx[3].y} Z`}
              />

              {/* Perspective alignment 3x3 guide lines */}
              {[1 / 3, 2 / 3].map((t) => {
                const topPt = lerpPt(ptsPx[0], ptsPx[1], t);
                const botPt = lerpPt(ptsPx[3], ptsPx[2], t);
                const leftPt = lerpPt(ptsPx[0], ptsPx[3], t);
                const rightPt = lerpPt(ptsPx[1], ptsPx[2], t);
                return (
                  <g key={t} stroke="rgba(255,255,255,0.32)" strokeWidth="1" strokeDasharray="3 3">
                    <line x1={topPt.x} y1={topPt.y} x2={botPt.x} y2={botPt.y} />
                    <line x1={leftPt.x} y1={leftPt.y} x2={rightPt.x} y2={rightPt.y} />
                  </g>
                );
              })}

              {/* Outer quad polygon */}
              <polygon
                points={ptsPx.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {/* 4 Touch-Friendly Draggable Corner Handles (>=48px hit area) */}
          {imgBounds &&
            ptsPx.map((pt, idx) => {
              const isActive = activeCorner === idx;
              return (
                <div
                  key={idx}
                  role="slider"
                  aria-label={`Corner ${idx + 1}`}
                  aria-valuenow={Math.round(corners[idx].x * 100)}
                  onPointerDown={(e) => handleCornerPointerDown(e, idx)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center cursor-grab active:cursor-grabbing z-20"
                  style={{
                    left: `${pt.x}px`,
                    top: `${pt.y}px`,
                    touchAction: 'none',
                  }}
                >
                  <div
                    className={`rounded-full border-2 shadow-lg transition-transform ${
                      isActive
                        ? 'w-7 h-7 bg-emerald-400 border-white scale-115 ring-4 ring-emerald-400/35'
                        : 'w-5 h-5 bg-white border-emerald-500'
                    }`}
                  />
                </div>
              );
            })}

          {/* Zoom Loupe Magnifier while dragging a corner */}
          {activeCorner !== null && (
            <div
              className={`absolute top-3 z-30 pointer-events-none flex flex-col items-center gap-1 ${
                loupeOnRight ? 'right-3' : 'left-3'
              }`}
            >
              <div className="w-28 h-28 rounded-full border-[3px] border-emerald-400 shadow-2xl overflow-hidden bg-slate-900">
                <canvas ref={loupeCanvasRef} width={112} height={112} className="w-full h-full block" />
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-900/90 text-[10px] font-bold text-emerald-300 border border-slate-700">
                2.5× Zoom
              </span>
            </div>
          )}
        </div>

        {/* Tools Strip: Rotate 90°, Reset Corners, Full Frame */}
        <div className="p-2.5 sm:p-3 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleRotate90}
              disabled={isProcessing}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <i className="fas fa-rotate-right text-blue-400"></i>
              <span>{language === 'mr' ? '९०° फिरवा' : language === 'hi' ? '90° घुमाएं' : 'Rotate 90°'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetCorners}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95"
            >
              <i className="fas fa-vector-square text-emerald-400"></i>
              <span>{language === 'mr' ? 'कोपरे रिसेट' : language === 'hi' ? 'रीसेट' : 'Reset'}</span>
            </button>

            <button
              type="button"
              onClick={handleFullImageCorners}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95"
            >
              <i className="fas fa-expand text-slate-400"></i>
              <span>{language === 'mr' ? 'पूर्ण' : language === 'hi' ? 'पूरा' : 'Full'}</span>
            </button>
          </div>

          <span className="text-[11px] font-mono font-bold text-emerald-400 px-2">
            CR80 · 85.6×54mm
          </span>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleUseAsIs}
            disabled={isProcessing}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            {language === 'mr' ? 'मूळ वापरा' : language === 'hi' ? 'यथावत रखें' : 'Use As Is'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseSafe}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all active:scale-95"
            >
              {language === 'mr' ? 'रद्द करा' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleApplyWarp}
              disabled={isProcessing}
              className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-check"></i>
              )}
              <span>
                {language === 'mr'
                  ? 'सरळ करा व लावा'
                  : language === 'hi'
                  ? 'सीधा करें व लागू करें'
                  : 'Done & Straighten'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardCropModal;
