import React, { useState } from 'react';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  EditableCardState,
  CanvasEditorViewOptions,
  CardLayoutType,
} from '../cardLayoutConfig';
import { useLanguage } from '../i18n';

interface MoreOptionsAccordionProps {
  cards: Record<'front' | 'back', EditableCardState>;
  selectedCardId: 'front' | 'back' | null;
  onSelectCard: (id: 'front' | 'back' | null) => void;
  options: CanvasEditorViewOptions;
  activePreset: CardLayoutType | 'custom' | 'fitWidth';
  onUpdateCard: (id: 'front' | 'back', updates: Partial<EditableCardState>) => void;
  onApplyPreset: (preset: CardLayoutType | 'fitWidth') => void;
  onOptionsChange: (newOptions: Partial<CanvasEditorViewOptions>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayout: () => void;
}

export const MoreOptionsAccordion: React.FC<MoreOptionsAccordionProps> = ({
  cards,
  selectedCardId,
  onSelectCard,
  options,
  activePreset,
  onUpdateCard,
  onApplyPreset,
  onOptionsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetLayout,
}) => {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const activeCard = selectedCardId ? cards[selectedCardId] : cards.front;
  const targetId = activeCard.id;

  // Custom size input changes
  const handleWidthChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 20 && val <= 200) {
      const aspect = activeCard.width / activeCard.height;
      onUpdateCard(targetId, {
        width: Math.round(val * 10) / 10,
        height: options.lockAspectRatio ? Math.round((val / aspect) * 10) / 10 : activeCard.height,
      });
    }
  };

  const handleHeightChange = (valStr: string) => {
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 20 && val <= 280) {
      const aspect = activeCard.width / activeCard.height;
      onUpdateCard(targetId, {
        height: Math.round(val * 10) / 10,
        width: options.lockAspectRatio ? Math.round(val * aspect * 10) / 10 : activeCard.width,
      });
    }
  };

  // Center horizontally
  const handleCenterH = () => {
    onUpdateCard(targetId, {
      x: Math.round(((A4_PAGE_WIDTH_MM - activeCard.width) / 2) * 10) / 10,
    });
  };

  // Center page
  const handleCenterPage = () => {
    onUpdateCard(targetId, {
      x: Math.round(((A4_PAGE_WIDTH_MM - activeCard.width) / 2) * 10) / 10,
      y: Math.round(((A4_PAGE_HEIGHT_MM - activeCard.height) / 2) * 10) / 10,
    });
  };

  // Stack 1-over-1
  const handleStackVertically = () => {
    const frontW = cards.front.width;
    const frontH = cards.front.height;
    const backW = cards.back.width;
    const backH = cards.back.height;

    const gap = 16.0;
    const totalHeight = frontH + backH + gap;
    const startY = Math.max(20, (A4_PAGE_HEIGHT_MM - totalHeight) / 2);

    onUpdateCard('front', {
      x: Math.round(((A4_PAGE_WIDTH_MM - frontW) / 2) * 10) / 10,
      y: Math.round(startY * 10) / 10,
      rotation: 0,
    });

    onUpdateCard('back', {
      x: Math.round(((A4_PAGE_WIDTH_MM - backW) / 2) * 10) / 10,
      y: Math.round((startY + frontH + gap) * 10) / 10,
      rotation: 0,
    });
  };

  // Align Centers
  const handleAlignCenters = () => {
    const otherId = targetId === 'front' ? 'back' : 'front';
    const targetCenterX = activeCard.x + activeCard.width / 2;
    onUpdateCard(otherId, {
      x: Math.round((targetCenterX - cards[otherId].width / 2) * 10) / 10,
    });
  };

  // Align Lefts
  const handleAlignLefts = () => {
    const otherId = targetId === 'front' ? 'back' : 'front';
    onUpdateCard(otherId, { x: activeCard.x });
  };

  // Same size for both
  const handleSameSize = () => {
    const otherId = targetId === 'front' ? 'back' : 'front';
    onUpdateCard(otherId, {
      width: activeCard.width,
      height: activeCard.height,
    });
  };

  return (
    <div className="w-full max-w-[430px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all">
      {/* Accordion Toggle Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <i className="fas fa-sliders text-blue-500 text-xs"></i>
          <span className="text-xs font-black text-slate-800 dark:text-slate-200">
            {language === 'mr'
              ? 'अधिक ॲडव्हान्स सेटिंग्ज (Advanced settings)'
              : language === 'hi'
              ? 'अतिरिक्त उन्नत सेटिंग्स (Advanced settings)'
              : 'Advanced fine-tuning settings'}
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            (Custom mm, Flip, Grid)
          </span>
        </div>

        <i
          className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        ></i>
      </button>

      {/* Accordion Content (Collapsed by default) */}
      {isOpen && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col space-y-4 animate-in fade-in duration-150">
          {/* Active Card Pill & Undo/Redo/Reset Bar */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => onSelectCard('front')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  targetId === 'front'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => onSelectCard('back')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  targetId === 'back'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Back
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs disabled:opacity-40"
                title="Undo"
              >
                <i className="fas fa-rotate-left"></i>
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs disabled:opacity-40"
                title="Redo"
              >
                <i className="fas fa-rotate-right"></i>
              </button>
              <button
                type="button"
                onClick={onResetLayout}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1"
                title="Restore default layout"
              >
                <i className="fas fa-arrow-rotate-left text-blue-500"></i>
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Size Presets */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              Size Presets
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onApplyPreset('standard')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  activePreset === 'standard'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs font-black block">Standard</span>
                <span className="text-[9px] text-slate-400 font-mono">85.6×54mm</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyPreset('large')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  activePreset === 'large'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs font-black block">Large</span>
                <span className="text-[9px] text-slate-400 font-mono">110×69.4mm</span>
              </button>

              <button
                type="button"
                onClick={() => onApplyPreset('fitWidth')}
                className={`p-2 rounded-xl border text-center transition-all ${
                  activePreset === 'fitWidth'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 font-bold'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-xs font-black block">Fit Width</span>
                <span className="text-[9px] text-slate-400 font-mono">190mm</span>
              </button>
            </div>
          </div>

          {/* Custom Millimeter Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Custom Size (mm)
              </span>
              <button
                type="button"
                onClick={() => onOptionsChange({ lockAspectRatio: !options.lockAspectRatio })}
                className="text-[9px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"
              >
                <i className={options.lockAspectRatio ? 'fas fa-link' : 'fas fa-link-slash'}></i>
                <span>{options.lockAspectRatio ? 'Locked 1.586' : 'Free Resize'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400">W:</span>
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={activeCard.width}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-[9px] text-slate-400">mm</span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400">H:</span>
                <input
                  type="number"
                  min="20"
                  max="280"
                  value={activeCard.height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                />
                <span className="text-[9px] text-slate-400">mm</span>
              </div>
            </div>
          </div>

          {/* Alignment Tools */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              Alignment &amp; Arrangement
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={handleCenterH}
                className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-arrows-left-right-to-line text-blue-500 text-[10px]"></i>
                <span>Center H</span>
              </button>

              <button
                type="button"
                onClick={handleCenterPage}
                className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-bullseye text-blue-500 text-[10px]"></i>
                <span>Center Page</span>
              </button>

              <button
                type="button"
                onClick={handleStackVertically}
                className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-table-columns rotate-90 text-blue-500 text-[10px]"></i>
                <span>Stack 1-Over-1</span>
              </button>

              <button
                type="button"
                onClick={handleAlignCenters}
                className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-align-center text-blue-500 text-[10px]"></i>
                <span>Align Centers</span>
              </button>

              <button
                type="button"
                onClick={handleAlignLefts}
                className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-align-left text-blue-500 text-[10px]"></i>
                <span>Align Left</span>
              </button>

              <button
                type="button"
                onClick={handleSameSize}
                className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-clone text-blue-500 text-[10px]"></i>
                <span>Same Size</span>
              </button>
            </div>
          </div>

          {/* Rotate & Flip */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              Transform &amp; Layer
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { rotation: (activeCard.rotation + 90) % 360 })}
                className="py-1.5 px-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-rotate-right text-blue-500 text-[9px]"></i>
                <span>+90°</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { rotation: ((activeCard.rotation - 90) % 360 + 360) % 360 })}
                className="py-1.5 px-1 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1"
              >
                <i className="fas fa-rotate-left text-blue-500 text-[9px]"></i>
                <span>-90°</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { flipHorizontal: !activeCard.flipHorizontal })}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 ${
                  activeCard.flipHorizontal ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                <i className="fas fa-arrows-left-right text-[9px]"></i>
                <span>Flip H</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { flipVertical: !activeCard.flipVertical })}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 ${
                  activeCard.flipVertical ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                <i className="fas fa-arrows-up-down text-[9px]"></i>
                <span>Flip V</span>
              </button>
            </div>
          </div>

          {/* View Toggles */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
              View &amp; Guides
            </span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.showCutGuides}
                  onChange={(e) => onOptionsChange({ showCutGuides: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Dashed cut border
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.showLabels}
                  onChange={(e) => onOptionsChange({ showLabels: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Card labels (Front/Back)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.showGrid}
                  onChange={(e) => onOptionsChange({ showGrid: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  10mm grid overlay
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.snapToGuides}
                  onChange={(e) => onOptionsChange({ snapToGuides: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Magnetic snapping
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoreOptionsAccordion;
