import React from 'react';
import { useLanguage } from '../i18n';

interface AadhaarCardMockupProps {
  side: 'front' | 'back';
  userImage?: string | null;
  className?: string;
  compact?: boolean;
}

export const AadhaarCardMockup: React.FC<AadhaarCardMockupProps> = ({
  side,
  userImage,
  className = '',
}) => {
  const { language } = useLanguage();

  if (userImage) {
    return (
      <div className={`w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
        <img src={userImage} alt={`${side} card`} className="w-full h-full object-contain" />
      </div>
    );
  }

  const isFront = side === 'front';

  return (
    <div
      className={`relative w-full h-full bg-slate-50/80 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-3 select-none text-center transition-colors group-hover:border-blue-400 dark:group-hover:border-blue-500 ${className}`}
    >
      {/* Top subtle tricolor accent line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-white to-emerald-600 rounded-t-lg opacity-80"></div>

      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm sm:text-base mb-1.5 shadow-xs">
        <i className={isFront ? 'fas fa-address-card' : 'fas fa-qrcode'}></i>
      </div>

      <span className="text-[10px] sm:text-xs font-black text-slate-800 dark:text-slate-200">
        {isFront
          ? language === 'mr'
            ? 'समोरची बाजू (Front)'
            : language === 'hi'
            ? 'सामने का भाग (Front)'
            : 'Front Side'
          : language === 'mr'
          ? 'मागील बाजू (Back)'
          : language === 'hi'
          ? 'पीछे का भाग (Back)'
          : 'Back Side'}
      </span>

      <span className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 flex items-center gap-1">
        <i className="fas fa-plus text-[8px]"></i>
        <span>
          {language === 'mr'
            ? 'फोटो जोडण्यासाठी टॅप करा'
            : language === 'hi'
            ? 'फोटो जोड़ने के लिए टैप करें'
            : 'Tap to add photo'}
        </span>
      </span>
    </div>
  );
};

export default AadhaarCardMockup;
