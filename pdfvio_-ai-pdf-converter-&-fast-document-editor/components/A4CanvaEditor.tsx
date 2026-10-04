import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';
import AadhaarCardMockup from './AadhaarCardMockup';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  EditableCardState,
  CanvasEditorViewOptions,
  CARD_SIZES,
  CardLayoutType,
} from '../cardLayoutConfig';

interface A4CanvaEditorProps {
  cards: Record<'front' | 'back', EditableCardState>;
  frontImage: string | null;
  backImage: string | null;
  selectedCardId: 'front' | 'back' | null;
  onSelectCard: (id: 'front' | 'back' | null) => void;
  onUpdateCard: (id: 'front' | 'back', updates: Partial<EditableCardState>) => void;
  options: CanvasEditorViewOptions;
  onOpenCrop: (side: 'front' | 'back') => void;
  onOpenPickImage: (side: 'front' | 'back') => void;
  onRemoveImage: (side: 'front' | 'back') => void;
}

interface DragState {
  type: 'move' | 'resize' | 'rotate';
  handle?: string; // 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  cardId: 'front' | 'back';
  startX: number;
  startY: number;
  initialCard: EditableCardState;
  centerPx?: { x: number; y: number };
  initialAngle?: number;
}

interface SnapGuide {
  type: 'vertical' | 'horizontal';
  posMm: number;
  label?: string;
}

export const A4CanvaEditor: React.FC<A4CanvaEditorProps> = ({
  cards,
  frontImage,
  backImage,
  selectedCardId,
  onSelectCard,
  onUpdateCard,
  options,
  onOpenCrop,
  onOpenPickImage,
  onRemoveImage,
}) => {
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1.8); // pixels per mm
  const [activeSnapGuides, setActiveSnapGuides] = useState<SnapGuide[]>([]);
  const dragStateRef = useRef<DragState | null>(null);

  // 2-finger touch tracking
  const initialTouchDistRef = useRef<number | null>(null);
  const initialTouchAngleRef = useRef<number | null>(null);
  const initialPinchCardRef = useRef<EditableCardState | null>(null);

  // Update scale (px per mm) based on rendered container width
  const updateScale = useCallback(() => {
    if (containerRef.current) {
      const clientW = containerRef.current.clientWidth;
      if (clientW > 0) {
        setScale(clientW / A4_PAGE_WIDTH_MM);
      }
    }
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  // Pointer event handlers for moving, resizing, and rotating
  const handlePointerDown = (
    e: React.PointerEvent,
    cardId: 'front' | 'back',
    type: 'move' | 'resize' | 'rotate',
    handle?: string
  ) => {
    e.stopPropagation();
    e.preventDefault();

    onSelectCard(cardId);
    const targetCard = cards[cardId];
    if (!targetCard || !containerRef.current) return;

    const sheetRect = containerRef.current.getBoundingClientRect();
    const cardCenterPx = {
      x: sheetRect.left + (targetCard.x + targetCard.width / 2) * scale,
      y: sheetRect.top + (targetCard.y + targetCard.height / 2) * scale,
    };

    let initialAngle = 0;
    if (type === 'rotate') {
      const dx = e.clientX - cardCenterPx.x;
      const dy = e.clientY - cardCenterPx.y;
      initialAngle = Math.atan2(dy, dx) * (180 / Math.PI) - targetCard.rotation;
    }

    dragStateRef.current = {
      type,
      handle,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      initialCard: { ...targetCard },
      centerPx: cardCenterPx,
      initialAngle,
    };

    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag || !containerRef.current) return;

    e.preventDefault();
    const { type, handle, cardId, startX, startY, initialCard, centerPx, initialAngle } = drag;
    const currentScale = scale || 1.8;

    const deltaPxX = e.clientX - startX;
    const deltaPxY = e.clientY - startY;
    const deltaMmX = deltaPxX / currentScale;
    const deltaMmY = deltaPxY / currentScale;

    const otherCard = cards[cardId === 'front' ? 'back' : 'front'];
    const snapGuides: SnapGuide[] = [];

    if (type === 'move') {
      let nextX = initialCard.x + deltaMmX;
      let nextY = initialCard.y + deltaMmY;

      // Magnetic Snapping (~2mm threshold)
      if (options.snapToGuides) {
        const snapThreshold = 2.0;
        const currentCenterX = nextX + initialCard.width / 2;
        const currentCenterY = nextY + initialCard.height / 2;

        // Snap to Page Horizontal Center (105mm)
        if (Math.abs(currentCenterX - A4_PAGE_WIDTH_MM / 2) < snapThreshold) {
          nextX = A4_PAGE_WIDTH_MM / 2 - initialCard.width / 2;
          snapGuides.push({ type: 'vertical', posMm: A4_PAGE_WIDTH_MM / 2, label: 'Page Center' });
        }
        // Snap to Margins (10mm left / right)
        else if (Math.abs(nextX - 10) < snapThreshold) {
          nextX = 10;
          snapGuides.push({ type: 'vertical', posMm: 10, label: '10mm Margin' });
        } else if (Math.abs(nextX + initialCard.width - (A4_PAGE_WIDTH_MM - 10)) < snapThreshold) {
          nextX = A4_PAGE_WIDTH_MM - 10 - initialCard.width;
          snapGuides.push({ type: 'vertical', posMm: A4_PAGE_WIDTH_MM - 10, label: '10mm Margin' });
        }
        // Snap to other card's center X
        else if (otherCard) {
          const otherCenterX = otherCard.x + otherCard.width / 2;
          if (Math.abs(currentCenterX - otherCenterX) < snapThreshold) {
            nextX = otherCenterX - initialCard.width / 2;
            snapGuides.push({ type: 'vertical', posMm: otherCenterX, label: 'Aligned' });
          } else if (Math.abs(nextX - otherCard.x) < snapThreshold) {
            nextX = otherCard.x;
            snapGuides.push({ type: 'vertical', posMm: otherCard.x, label: 'Left Aligned' });
          }
        }

        // Snap to Page Vertical Center (148.5mm)
        if (Math.abs(currentCenterY - A4_PAGE_HEIGHT_MM / 2) < snapThreshold) {
          nextY = A4_PAGE_HEIGHT_MM / 2 - initialCard.height / 2;
          snapGuides.push({ type: 'horizontal', posMm: A4_PAGE_HEIGHT_MM / 2, label: 'Page Center' });
        }
      }

      // Keep within reasonable A4 boundaries (-10mm to +10mm offpage allowable)
      nextX = Math.max(-20, Math.min(A4_PAGE_WIDTH_MM - initialCard.width + 20, nextX));
      nextY = Math.max(-20, Math.min(A4_PAGE_HEIGHT_MM - initialCard.height + 20, nextY));

      setActiveSnapGuides(snapGuides);
      onUpdateCard(cardId, {
        x: Math.round(nextX * 10) / 10,
        y: Math.round(nextY * 10) / 10,
      });
    } else if (type === 'resize') {
      const minSize = 25.0; // mm
      const maxSize = 200.0; // mm
      let newW = initialCard.width;
      let newH = initialCard.height;
      let newX = initialCard.x;
      let newY = initialCard.y;

      const aspect = initialCard.width / initialCard.height;

      if (handle === 'se') {
        newW = Math.max(minSize, Math.min(maxSize, initialCard.width + deltaMmX));
        newH = options.lockAspectRatio ? newW / aspect : Math.max(minSize, Math.min(maxSize, initialCard.height + deltaMmY));
      } else if (handle === 'sw') {
        newW = Math.max(minSize, Math.min(maxSize, initialCard.width - deltaMmX));
        newH = options.lockAspectRatio ? newW / aspect : Math.max(minSize, Math.min(maxSize, initialCard.height + deltaMmY));
        newX = initialCard.x + (initialCard.width - newW);
      } else if (handle === 'ne') {
        newW = Math.max(minSize, Math.min(maxSize, initialCard.width + deltaMmX));
        newH = options.lockAspectRatio ? newW / aspect : Math.max(minSize, Math.min(maxSize, initialCard.height - deltaMmY));
        newY = initialCard.y + (initialCard.height - newH);
      } else if (handle === 'nw') {
        newW = Math.max(minSize, Math.min(maxSize, initialCard.width - deltaMmX));
        newH = options.lockAspectRatio ? newW / aspect : Math.max(minSize, Math.min(maxSize, initialCard.height - deltaMmY));
        newX = initialCard.x + (initialCard.width - newW);
        newY = initialCard.y + (initialCard.height - newH);
      } else if (handle === 'e') {
        newW = Math.max(minSize, Math.min(maxSize, initialCard.width + deltaMmX));
        if (options.lockAspectRatio) newH = newW / aspect;
      } else if (handle === 'w') {
        newW = Math.max(minSize, Math.min(maxSize, initialCard.width - deltaMmX));
        newX = initialCard.x + (initialCard.width - newW);
        if (options.lockAspectRatio) newH = newW / aspect;
      } else if (handle === 's') {
        newH = Math.max(minSize, Math.min(maxSize, initialCard.height + deltaMmY));
        if (options.lockAspectRatio) newW = newH * aspect;
      } else if (handle === 'n') {
        newH = Math.max(minSize, Math.min(maxSize, initialCard.height - deltaMmY));
        newY = initialCard.y + (initialCard.height - newH);
        if (options.lockAspectRatio) newW = newH * aspect;
      }

      onUpdateCard(cardId, {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        width: Math.round(newW * 10) / 10,
        height: Math.round(newH * 10) / 10,
      });
    } else if (type === 'rotate' && centerPx) {
      const dx = e.clientX - centerPx.x;
      const dy = e.clientY - centerPx.y;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) - (initialAngle || 0);

      // Normalize angle 0 to 360
      angle = ((angle % 360) + 360) % 360;

      // Magnetic snap to cardinal 0, 90, 180, 270 degrees (±4 threshold)
      const cardinals = [0, 90, 180, 270, 360];
      for (const cardAngle of cardinals) {
        if (Math.abs(angle - cardAngle) < 4) {
          angle = cardAngle % 360;
          break;
        }
      }

      onUpdateCard(cardId, { rotation: Math.round(angle) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      setActiveSnapGuides([]);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  // Two-Finger Touch Gestures (Pinch to resize & twist to rotate)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && selectedCardId) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

      initialTouchDistRef.current = dist;
      initialTouchAngleRef.current = angle;
      initialPinchCardRef.current = { ...cards[selectedCardId] };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (
      e.touches.length === 2 &&
      selectedCardId &&
      initialTouchDistRef.current !== null &&
      initialPinchCardRef.current !== null
    ) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

      const scaleFactor = dist / initialTouchDistRef.current;
      const angleDiff = angle - (initialTouchAngleRef.current || 0);

      const base = initialPinchCardRef.current;
      const newWidth = Math.max(30, Math.min(200, base.width * scaleFactor));
      const aspect = base.width / base.height;
      const newHeight = newWidth / aspect;

      // Adjust x and y to keep centered
      const newX = base.x + (base.width - newWidth) / 2;
      const newY = base.y + (base.height - newHeight) / 2;
      const newRot = (((base.rotation + angleDiff) % 360) + 360) % 360;

      onUpdateCard(selectedCardId, {
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        width: Math.round(newWidth * 10) / 10,
        height: Math.round(newHeight * 10) / 10,
        rotation: Math.round(newRot),
      });
    }
  };

  const handleTouchEnd = () => {
    initialTouchDistRef.current = null;
    initialTouchAngleRef.current = null;
    initialPinchCardRef.current = null;
  };

  // Keyboard arrow nudging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCardId) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1; // 1mm or 5mm with Shift
        const card = cards[selectedCardId];
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        onUpdateCard(selectedCardId, {
          x: Math.round((card.x + dx) * 10) / 10,
          y: Math.round((card.y + dy) * 10) / 10,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardId, cards, onUpdateCard]);

  const activeCard = selectedCardId ? cards[selectedCardId] : null;

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* Outer Viewport Wrapper with Canvas */}
      <div
        className="w-full flex justify-center py-2 px-1 relative"
        onClick={() => onSelectCard(null)}
      >
        {/* A4 Sheet Container */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-full max-w-[430px] aspect-[210/297] bg-white rounded-xl shadow-2xl ring-1 ring-slate-300 dark:ring-slate-700 overflow-hidden cursor-default transition-all"
          style={{ touchAction: 'none' }}
        >
          {/* Background Grid & Millimeter Rulers (Toggleable) */}
          {options.showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern
                    id="grid-small"
                    width={`${(10 / A4_PAGE_WIDTH_MM) * 100}%`}
                    height={`${(10 / A4_PAGE_HEIGHT_MM) * 100}%`}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 100 0 L 0 0 0 100"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-small)" />
                {/* Center crosshair */}
                <line
                  x1="50%"
                  y1="0"
                  x2="50%"
                  y2="100%"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </svg>
            </div>
          )}

          {/* Magnetic Alignment Snap Guidelines */}
          {activeSnapGuides.map((guide, idx) => (
            <div
              key={idx}
              className={`absolute pointer-events-none z-40 ${
                guide.type === 'vertical'
                  ? 'top-0 bottom-0 w-[1px] bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : 'left-0 right-0 h-[1px] bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.8)]'
              }`}
              style={{
                [guide.type === 'vertical' ? 'left' : 'top']: `${
                  (guide.posMm / (guide.type === 'vertical' ? A4_PAGE_WIDTH_MM : A4_PAGE_HEIGHT_MM)) * 100
                }%`,
              }}
            >
              {guide.label && (
                <span className="absolute top-2 left-2 bg-slate-900/90 text-white text-[8px] font-mono px-1.5 py-0.5 rounded shadow">
                  {guide.label}
                </span>
              )}
            </div>
          ))}

          {/* Render Both Cards (Front and Back) */}
          {(['front', 'back'] as const).map((side) => {
            const card = cards[side];
            const isSelected = selectedCardId === side;
            const imageSrc = side === 'front' ? frontImage : backImage;

            // Dimensions in pixels on canvas
            const pixelX = card.x * scale;
            const pixelY = card.y * scale;
            const pixelW = card.width * scale;
            const pixelH = card.height * scale;

            return (
              <div
                key={side}
                className="absolute transition-shadow select-none group touch-none cursor-move"
                style={{
                  left: `${pixelX}px`,
                  top: `${pixelY}px`,
                  width: `${pixelW}px`,
                  height: `${pixelH}px`,
                  transform: `rotate(${card.rotation}deg) scaleX(${card.flipHorizontal ? -1 : 1}) scaleY(${card.flipVertical ? -1 : 1})`,
                  transformOrigin: 'center center',
                  zIndex: card.zIndex,
                }}
                onPointerDown={(e) => handlePointerDown(e, side, 'move')}
              >
                {/* Optional Bilingual Front/Back Label Above Slot */}
                {options.showLabels && (
                  <div
                    className="absolute -top-4 left-0 right-0 flex items-center justify-between text-[8px] font-black tracking-wider text-slate-500 uppercase overflow-hidden px-0.5"
                    style={{
                      transform: `scaleX(${card.flipHorizontal ? -1 : 1}) scaleY(${card.flipVertical ? -1 : 1})`,
                    }}
                  >
                    <span>
                      {card.title} {language === 'mr' ? `(${card.marathiTitle})` : language === 'hi' ? `(${card.hindiTitle})` : ''}
                    </span>
                    <span className="font-mono text-[7px] text-slate-400">
                      {Math.round(card.width)}×{Math.round(card.height)}mm
                    </span>
                  </div>
                )}

                {/* Card Body Container */}
                <div
                  className={`w-full h-full rounded overflow-hidden flex items-center justify-center relative bg-white ${
                    options.showCutGuides
                      ? 'border-2 border-dashed border-slate-400 shadow-sm'
                      : 'border border-slate-200 shadow-sm'
                  } ${
                    isSelected
                      ? 'ring-2 ring-blue-500 shadow-2xl ring-offset-1'
                      : 'hover:ring-1 hover:ring-blue-400/60'
                  }`}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={card.title}
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-2"
                      onClick={() => onOpenPickImage(side)}
                    >
                      <AadhaarCardMockup side={side} />
                    </div>
                  )}
                </div>

                {/* Selection Handles & Controls (Active when selected) */}
                {isSelected && (
                  <>
                    {/* Top Rotate Stalk Handle */}
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-50"
                      onPointerDown={(e) => handlePointerDown(e, side, 'rotate')}
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg text-[10px] active:scale-95 transition-all">
                        <i className="fas fa-arrows-rotate"></i>
                      </div>
                      <div className="w-0.5 h-2 bg-blue-500"></div>
                      {card.rotation !== 0 && (
                        <span className="absolute -top-4 bg-slate-900 text-white text-[7px] font-mono px-1 py-0.2 rounded shadow">
                          {card.rotation}°
                        </span>
                      )}
                    </div>

                    {/* Corner Resize Handles */}
                    {/* NW */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'nw')}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow cursor-nwse-resize z-50 hover:scale-125 transition-transform touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                    {/* NE */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'ne')}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow cursor-nesw-resize z-50 hover:scale-125 transition-transform touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                    {/* SE */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'se')}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow cursor-nwse-resize z-50 hover:scale-125 transition-transform touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                    {/* SW */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'sw')}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow cursor-nesw-resize z-50 hover:scale-125 transition-transform touch-none before:absolute before:-inset-2 before:content-['']"
                    />

                    {/* Edge Resize Handles */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'n')}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-2.5 bg-white border border-blue-500 rounded-full shadow cursor-ns-resize z-50 touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 's')}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-2.5 bg-white border border-blue-500 rounded-full shadow cursor-ns-resize z-50 touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'w')}
                      className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-2.5 h-5 bg-white border border-blue-500 rounded-full shadow cursor-ew-resize z-50 touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, side, 'resize', 'e')}
                      className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-2.5 h-5 bg-white border border-blue-500 rounded-full shadow cursor-ew-resize z-50 touch-none before:absolute before:-inset-2 before:content-['']"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Quick Actions Pill on Canvas when Card is Selected */}
        {activeCard && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700 px-3 py-1.5 flex items-center gap-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <span className="text-[10px] font-black uppercase text-blue-400 border-r border-slate-700 pr-2">
              {activeCard.id === 'front' ? 'Front' : 'Back'}
            </span>

            {/* Quick Center H */}
            <button
              type="button"
              onClick={() =>
                onUpdateCard(activeCard.id, {
                  x: Math.round(((A4_PAGE_WIDTH_MM - activeCard.width) / 2) * 10) / 10,
                })
              }
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white text-xs transition-colors"
              title="Center Horizontally"
            >
              <i className="fas fa-arrows-left-right-to-line"></i>
            </button>

            {/* Quick Rotate +90 */}
            <button
              type="button"
              onClick={() =>
                onUpdateCard(activeCard.id, {
                  rotation: (activeCard.rotation + 90) % 360,
                })
              }
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white text-xs transition-colors"
              title="Rotate 90°"
            >
              <i className="fas fa-rotate-right"></i>
            </button>

            {/* Crop if image exists */}
            {(activeCard.id === 'front' ? frontImage : backImage) && (
              <button
                type="button"
                onClick={() => onOpenCrop(activeCard.id)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-emerald-400 text-xs transition-colors"
                title="Crop / Fine-tune"
              >
                <i className="fas fa-crop-simple"></i>
              </button>
            )}

            {/* Replace Image */}
            <button
              type="button"
              onClick={() => onOpenPickImage(activeCard.id)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-blue-400 text-xs transition-colors"
              title="Replace Image"
            >
              <i className="fas fa-image"></i>
            </button>

            {/* Bring to front */}
            <button
              type="button"
              onClick={() =>
                onUpdateCard(activeCard.id, {
                  zIndex: Math.max(cards.front.zIndex, cards.back.zIndex) + 1,
                })
              }
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 text-xs transition-colors"
              title="Bring Forward"
            >
              <i className="fas fa-layer-group"></i>
            </button>

            {/* Delete / Remove */}
            {(activeCard.id === 'front' ? frontImage : backImage) && (
              <button
                type="button"
                onClick={() => onRemoveImage(activeCard.id)}
                className="p-1.5 hover:bg-rose-950/50 rounded-lg text-rose-400 text-xs transition-colors border-l border-slate-700 pl-2"
                title="Remove Image"
              >
                <i className="fas fa-trash-can"></i>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Touch & Keyboard Hint Pill */}
      <div className="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-300 mt-2 px-2 text-center">
        <span>
          <i className="fas fa-hand-pointer text-blue-500 mr-1"></i>
          {language === 'mr'
            ? 'कार्ड्स ड्रॅग करून हव्या तिथे ठेवा, कोपऱ्यातून साईज बदला'
            : language === 'hi'
            ? 'कार्ड को खींचकर कहीं भी रखें, कोनों से आकार बदलें'
            : 'Drag to move, pull corner handles to resize, top icon to rotate'}
        </span>
      </div>
    </div>
  );
};

export default A4CanvaEditor;
