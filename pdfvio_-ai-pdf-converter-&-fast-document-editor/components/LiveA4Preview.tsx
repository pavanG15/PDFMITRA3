import React from 'react';
import { useLanguage } from '../i18n';
import AadhaarCardMockup from './AadhaarCardMockup';

interface LiveA4PreviewProps {
  frontImage: string | null;
  backImage: string | null;
  cardLayout: 'standard' | 'large';
  addCutGuides: boolean;
}

const LiveA4Preview: React.FC<LiveA4PreviewProps> = ({
  frontImage,
  backImage,
  cardLayout,
  addCutGuides,
}) => {
  const { t } = useLanguage();

  // Standard width: 100mm on 210mm paper = ~52%
  // Large width: 160mm on 210mm paper = ~78%
  const cardWidthClass = cardLayout === 'standard' ? 'w-[68%] max-w-[240px]' : 'w-[88%] max-w-[320px]';

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
          {t('a4PageHint')}
        </span>
      </div>

      {/* Realistic A4 Sheet Representation (Aspect Ratio 210 x 297) */}
      <div className="relative w-full max-w-[380px] aspect-[210/297] bg-white rounded-xl shadow-2xl ring-1 ring-slate-300 dark:ring-slate-700 p-4 sm:p-6 flex flex-col justify-between items-center overflow-hidden transition-all select-none">
        {/* Subtle Watermark or Page Border */}
        <div className="w-full flex items-center justify-between text-[8px] font-black text-slate-400/80 tracking-wider uppercase border-b border-slate-100 pb-1">
          <span>A4 SINGLE PAGE • 300 DPI</span>
          <span>{cardLayout === 'standard' ? '100 mm' : '160 mm'}</span>
        </div>

        {/* Center Content: Both Cards Stacked */}
        <div className="w-full flex flex-col items-center justify-center my-auto space-y-3 sm:space-y-5">
          {/* Front Card Section */}
          <div className={`flex flex-col items-start transition-all duration-300 ${cardWidthClass}`}>
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-700 tracking-wider uppercase flex items-center gap-1">
                <i className="fas fa-scissors text-[7px] text-slate-400"></i> {t('frontSideLabel')}
              </span>
            </div>
            <div
              className={`w-full aspect-[1.586/1] rounded overflow-hidden flex items-center justify-center relative transition-all ${
                addCutGuides
                  ? 'p-0.5 border border-dashed border-slate-400 shadow-sm'
                  : 'border border-slate-200 shadow-sm'
              }`}
            >
              {frontImage ? (
                <img
                  src={frontImage}
                  alt="Front Side Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                /* Authentic Front Aadhaar Card Mockup */
                <AadhaarCardMockup side="front" />
              )}
            </div>
          </div>

          {/* Back Card Section */}
          <div className={`flex flex-col items-start transition-all duration-300 ${cardWidthClass}`}>
            <div className="flex items-center justify-between w-full mb-1">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-700 tracking-wider uppercase flex items-center gap-1">
                <i className="fas fa-scissors text-[7px] text-slate-400"></i> {t('backSideLabel')}
              </span>
            </div>
            <div
              className={`w-full aspect-[1.586/1] rounded overflow-hidden flex items-center justify-center relative transition-all ${
                addCutGuides
                  ? 'p-0.5 border border-dashed border-slate-400 shadow-sm'
                  : 'border border-slate-200 shadow-sm'
              }`}
            >
              {backImage ? (
                <img
                  src={backImage}
                  alt="Back Side Preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                /* Authentic Back Aadhaar Card Mockup */
                <AadhaarCardMockup side="back" />
              )}
            </div>
          </div>
        </div>

        {/* Bottom subtle indicator */}
        <div className="w-full pt-1 border-t border-slate-100 flex items-center justify-between text-[7px] sm:text-[8px] font-bold text-slate-400 tracking-wider">
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
