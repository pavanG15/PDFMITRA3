import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, LANGUAGES, Language } from '../i18n';

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (compact) {
    // Quick segmented switch for mobile / compact bars
    return (
      <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
        {LANGUAGES.map((item) => {
          const isActive = language === item.code;
          return (
            <button
              key={item.code}
              onClick={() => setLanguage(item.code)}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={item.label}
              aria-label={`Switch to ${item.label}`}
            >
              {item.code === 'en' ? 'EN' : item.code === 'hi' ? 'हि' : 'म'}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200/80 dark:border-slate-800 text-xs font-bold shadow-xs shrink-0"
        aria-label="Select Language"
        aria-expanded={isOpen}
      >
        <span className="text-sm">{currentLang.flag}</span>
        <span className="font-extrabold hidden sm:inline">{currentLang.nativeLabel}</span>
        <span className="font-extrabold sm:hidden text-[11px]">{currentLang.code.toUpperCase()}</span>
        <i className={`fas fa-chevron-down text-[8px] sm:text-[9px] text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
            भाषा / Language
          </div>
          {LANGUAGES.map((item) => {
            const isSelected = language === item.code;
            return (
              <button
                key={item.code}
                onClick={() => {
                  setLanguage(item.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.flag}</span>
                  <div className="text-left">
                    <div className="font-black leading-none">{item.nativeLabel}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{item.label}</div>
                  </div>
                </div>
                {isSelected && <i className="fas fa-check text-blue-600 dark:text-blue-400 text-xs"></i>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
