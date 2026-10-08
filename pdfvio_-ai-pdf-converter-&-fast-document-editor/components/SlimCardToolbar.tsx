import React, { useState } from 'react';
import { EditableCardState, CARD_SIZES } from '../cardLayoutConfig';
import { useLanguage } from '../i18n';

interface SlimCardToolbarProps {
  card: EditableCardState;
  hasImage: boolean;
  onUpdateCard: (updates: Partial<EditableCardState>) => void;
  onOpenCrop: () => void;
  onRemoveImage: () => void;
  onDeselect: () => void;
}

export const SlimCardToolbar: React.FC<SlimCardToolbarProps> = ({
  card,
  hasImage,
  onUpdateCard,
  onOpenCrop,
  onRemoveImage,
  onDeselect,
}) => {
  const { language } = useLanguage();
  const [showSizeSlider, setShowSizeSlider] = useState<boolean>(false);

  const isFront = card.id === 'front';

  // Rotate +90 degrees
  const handleRotate = () => {
    onUpdateCard({ rotation: (card.rotation + 90) % 360 });
  };

  // Quick resize presets
  const handleSetStandardSize = () => {
    onUpdateCard({
      width: CARD_SIZES.standard.widthMm,
      height: CARD_SIZES.standard.heightMm,
    });
  };

  const handleSetLargeSize = () => {
    onUpdateCard({
      width: CARD_SIZES.large.widthMm,
      height: CARD_SIZES.large.heightMm,
    });
  };

  // Slider change maintaining aspect ratio
  const handleSliderWidthChange = (newWidth: number) => {
    const aspect = card.width / card.height || CARD_SIZES.standard.aspectRatio;
    const newHeight = Math.round((newWidth / aspect) * 10) / 10;
    onUpdateCard({
      width: Math.round(newWidth * 10) / 10,
      height: newHeight,
    });
  };

  return (
    <div className="w-full max-w-[430px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 shadow-md transition-all animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Top Header Pill */}
      <div className="flex items-center justify-between px-2 pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              isFront ? 'bg-blue-500' : 'bg-indigo-500'
            }`}
          ></span>
          <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
            {isFront
              ? language === 'mr'
                ? 'समोरची बाजू (Front)'
                : language === 'hi'
                ? 'सामने का भाग (Front)'
                : 'Front Card'
              : language === 'mr'
              ? 'मागील बाजू (Back)'
              : language === 'hi'
              ? 'पीछे का भाग (Back)'
              : 'Back Card'}
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {Math.round(card.width)}×{Math.round(card.height)}mm
          </span>
          {card.rotation !== 0 && (
            <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold">
              {card.rotation}°
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onDeselect}
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 text-xs"
          title="Done"
        >
          <i className="fas fa-check"></i>
        </button>
      </div>

      {/* The 4 Slim Icon Buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* 1. Size Slider Button */}
        <button
          type="button"
          onClick={() => setShowSizeSlider((prev) => !prev)}
          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            showSizeSlider
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <i className="fas fa-expand text-sm mb-1"></i>
          <span className="text-[10px] tracking-tight">
            {language === 'mr' ? 'साईज' : language === 'hi' ? 'साइज' : 'Size'}
          </span>
        </button>

        {/* 2. Rotate Button */}
        <button
          type="button"
          onClick={handleRotate}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
          title="Rotate 90°"
        >
          <i className="fas fa-rotate-right text-sm mb-1 text-blue-500"></i>
          <span className="text-[10px] tracking-tight">
            {language === 'mr' ? 'फिरवा' : language === 'hi' ? 'घुमाएं' : 'Rotate'}
          </span>
        </button>

        {/* 3. Crop Button */}
        <button
          type="button"
          onClick={onOpenCrop}
          disabled={!hasImage}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Crop photo"
        >
          <i className="fas fa-crop-simple text-sm mb-1 text-emerald-500"></i>
          <span className="text-[10px] tracking-tight">
            {language === 'mr' ? 'क्रॉप' : language === 'hi' ? 'क्रॉप' : 'Crop'}
          </span>
        </button>

        {/* 4. Remove Button */}
        <button
          type="button"
          onClick={onRemoveImage}
          disabled={!hasImage}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          title="Remove photo"
        >
          <i className="fas fa-trash-can text-sm mb-1"></i>
          <span className="text-[10px] tracking-tight">
            {language === 'mr' ? 'काढा' : language === 'hi' ? 'हटाएं' : 'Remove'}
          </span>
        </button>
      </div>

      {/* Inline Size Control Drawer (Expands when Size button is clicked) */}
      {showSizeSlider && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col space-y-2 animate-in fade-in duration-100">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={handleSetStandardSize}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition-all ${
                Math.round(card.width) === 86
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              85.6mm (Std)
            </button>
            <button
              type="button"
              onClick={handleSetLargeSize}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-black transition-all ${
                Math.round(card.width) === 110
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              110mm (Large)
            </button>
          </div>

          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-mono text-slate-400 shrink-0">W:</span>
            <input
              type="range"
              min="50"
              max="190"
              step="1"
              value={card.width}
              onChange={(e) => handleSliderWidthChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 font-bold shrink-0">
              {Math.round(card.width)}mm
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlimCardToolbar;
