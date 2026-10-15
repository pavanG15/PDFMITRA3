import React from 'react';
import { useLanguage } from '../i18n';
import AadhaarCardMockup from './AadhaarCardMockup';
import {
  CardLayoutType,
  CARD_SIZES,
  getA4CardLayout,
} from '../cardLayoutConfig';

interface LiveA4PreviewProps {
  frontImage: string | null;
  backImage: string | null;
  cardLayout: CardLayoutType;
  addCutGuides: boolean;
}

const LiveA4Preview: React.FC<LiveA4PreviewProps> = ({
  frontImage,
  backImage,
  cardLayout,
  addCutGuides,
}) => {
  const { t, language } = useLanguage();
  const layout = getA4CardLayout(cardLayout);
  const sizeConfig = CARD_SIZES[cardLayout] || CARD_SIZES.standard;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Live Preview Header Pill */}
      <div className="flex items-center justify-between w-full mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {t('livePreviewTitle')}
          </span>
        </div>
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          {sizeConfig.shortLabel}
        </span>
      </div>

      {/* Realistic A4 Sheet Representation (Aspect Ratio 210 x 297 mm) */}
      <div className="relative w-full max-w-[390px] aspect-[210/297] bg-white rounded-xl shadow-2xl ring-1 ring-slate-300 dark:ring-slate-700 overflow-hidden select-none transition-all">
        {/* Subtle Watermark or Page Border Header */}
        <div className="absolute top-0 left-0 right-0 px-4 py-2 flex items-center justify-between text-[8px] font-black text-slate-400 tracking-wider uppercase border-b border-slate-100 bg-slate-50/50 z-10">
          <span>A4 SINGLE PAGE • 300 DPI</span>
          <span>{sizeConfig.name}</span>
        </div>

        {/* FRONT SIDE LABEL */}
        <div
          className="absolute flex items-center justify-between text-slate-500 font-bold overflow-hidden"
          style={{
            top: `${layout.preview.frontLabelTopPct}%`,
            left: `${layout.preview.leftPct}%`,
            width: `${layout.preview.slotWidthPct}%`,
            height: `${layout.preview.labelHeightPct}%`,
          }}
        >
          <span className="text-[8px] sm:text-[9px] font-black tracking-wider uppercase flex items-center gap-1 text-slate-600">
            <i className="fas fa-scissors text-[7px] text-slate-400"></i>
            <span>FRONT SIDE {language === 'mr' ? '(समोरची बाजू)' : language === 'hi' ? '(सामने की फोटो)' : ''}</span>
          </span>
          <span className="text-[7.5px] font-mono text-slate-400">
            {layout.slotWidthMm} × {layout.slotHeightMm} mm
          </span>
        </div>

        {/* FRONT CARD SLOT */}
        <div
          className={`absolute rounded overflow-hidden flex items-center justify-center transition-all ${
            addCutGuides
              ? 'border-2 border-dashed border-slate-400 shadow-sm'
              : 'border border-slate-200 shadow-sm'
          }`}
          style={{
            top: `${layout.preview.frontSlotTopPct}%`,
            left: `${layout.preview.leftPct}%`,
            width: `${layout.preview.slotWidthPct}%`,
            height: `${layout.preview.slotHeightPct}%`,
          }}
        >
          {frontImage ? (
            <img
              src={frontImage}
              alt="Front Side Preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <AadhaarCardMockup side="front" />
          )}
        </div>

        {/* BACK SIDE LABEL */}
        <div
          className="absolute flex items-center justify-between text-slate-500 font-bold overflow-hidden"
          style={{
            top: `${layout.preview.backLabelTopPct}%`,
            left: `${layout.preview.leftPct}%`,
            width: `${layout.preview.slotWidthPct}%`,
            height: `${layout.preview.labelHeightPct}%`,
          }}
        >
          <span className="text-[8px] sm:text-[9px] font-black tracking-wider uppercase flex items-center gap-1 text-slate-600">
            <i className="fas fa-scissors text-[7px] text-slate-400"></i>
            <span>BACK SIDE {language === 'mr' ? '(मागील बाजू)' : language === 'hi' ? '(पीछे की फोटो)' : ''}</span>
          </span>
          <span className="text-[7.5px] font-mono text-slate-400">
            {layout.slotWidthMm} × {layout.slotHeightMm} mm
          </span>
        </div>

        {/* BACK CARD SLOT */}
        <div
          className={`absolute rounded overflow-hidden flex items-center justify-center transition-all ${
            addCutGuides
              ? 'border-2 border-dashed border-slate-400 shadow-sm'
              : 'border border-slate-200 shadow-sm'
          }`}
          style={{
            top: `${layout.preview.backSlotTopPct}%`,
            left: `${layout.preview.leftPct}%`,
            width: `${layout.preview.slotWidthPct}%`,
            height: `${layout.preview.slotHeightPct}%`,
          }}
        >
          {backImage ? (
            <img
              src={backImage}
              alt="Back Side Preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <AadhaarCardMockup side="back" />
          )}
        </div>

        {/* Bottom subtle indicator */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-1.5 border-t border-slate-100 flex items-center justify-between text-[7px] sm:text-[8px] font-bold text-slate-400 tracking-wider bg-slate-50/50">
          <span>XEROX & KYC PRINT READY</span>
          <span className="text-emerald-600 font-black">100% PRIVATE</span>
        </div>
      </div>

      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-3 text-center">
        {t('livePreviewSubtitle')}
      </p>
    </div>
  );
};

export default LiveA4Preview;
