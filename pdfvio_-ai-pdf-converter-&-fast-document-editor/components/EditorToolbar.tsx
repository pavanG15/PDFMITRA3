import React from 'react';
import { useLanguage } from '../i18n';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  EditableCardState,
  CanvasEditorViewOptions,
  CARD_SIZES,
  CardLayoutType,
} from '../cardLayoutConfig';

interface EditorToolbarProps {
  cards: Record<'front' | 'back', EditableCardState>;
  frontImage: string | null;
  backImage: string | null;
  selectedCardId: 'front' | 'back' | null;
  onSelectCard: (id: 'front' | 'back' | null) => void;
  onUpdateCard: (id: 'front' | 'back', updates: Partial<EditableCardState>) => void;
  onApplyPreset: (preset: CardLayoutType | 'fitWidth') => void;
  activePreset: CardLayoutType | 'custom' | 'fitWidth';
  options: CanvasEditorViewOptions;
  onOptionsChange: (newOptions: Partial<CanvasEditorViewOptions>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayout: () => void;
  onOpenCrop: (side: 'front' | 'back') => void;
  onOpenCamera: (side: 'front' | 'back') => void;
  onOpenPickImage: (side: 'front' | 'back') => void;
  onRemoveImage: (side: 'front' | 'back') => void;
  hasBothImages: boolean;
  onGeneratePdf: () => void;
  isGeneratingPdf: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  cards,
  frontImage,
  backImage,
  selectedCardId,
  onSelectCard,
  onUpdateCard,
  onApplyPreset,
  activePreset,
  options,
  onOptionsChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetLayout,
  onOpenCrop,
  onOpenCamera,
  onOpenPickImage,
  onRemoveImage,
  hasBothImages,
  onGeneratePdf,
  isGeneratingPdf,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = React.useState<'presets' | 'align' | 'transform' | 'view' | 'photos'>('presets');

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

  // Center vertically / page
  const handleCenterPage = () => {
    onUpdateCard(targetId, {
      x: Math.round(((A4_PAGE_WIDTH_MM - activeCard.width) / 2) * 10) / 10,
      y: Math.round(((A4_PAGE_HEIGHT_MM - activeCard.height) / 2) * 10) / 10,
    });
  };

  // Stack both cards vertically (standard layout)
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
    <div className="w-full flex flex-col space-y-4">
      {/* Top Header Card Selector & Undo/Redo/Reset Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2.5">
        {/* Active Card Pill Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => onSelectCard('front')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedCardId === 'front'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-address-card mr-1.5"></i>
            <span>{language === 'mr' ? 'समोरची बाजू' : language === 'hi' ? 'सामने (Front)' : 'Front Card'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectCard('back')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
              selectedCardId === 'back'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <i className="fas fa-qrcode mr-1.5"></i>
            <span>{language === 'mr' ? 'मागील बाजू' : language === 'hi' ? 'पीछे (Back)' : 'Back Card'}</span>
          </button>
        </div>

        {/* Undo, Redo, Reset Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs disabled:opacity-40 transition-all active:scale-95"
            title="Undo (Ctrl+Z)"
          >
            <i className="fas fa-rotate-left"></i>
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs disabled:opacity-40 transition-all active:scale-95"
            title="Redo (Ctrl+Y)"
          >
            <i className="fas fa-rotate-right"></i>
          </button>

          <button
            type="button"
            onClick={onResetLayout}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
            title="Reset to default standard layout"
          >
            <i className="fas fa-arrow-rotate-left text-blue-500"></i>
            <span>{language === 'mr' ? 'रीसेट' : language === 'hi' ? 'रीसेट' : 'Reset'}</span>
          </button>
        </div>
      </div>

      {/* Canva Tool Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col space-y-4">
        {/* Tab Navigation Bar */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'photos', icon: 'fa-images', label: language === 'mr' ? 'फोटो' : language === 'hi' ? 'फोटो' : 'Photos' },
            { id: 'presets', icon: 'fa-vector-square', label: language === 'mr' ? 'साईज' : language === 'hi' ? 'आकार' : 'Size' },
            { id: 'align', icon: 'fa-align-center', label: language === 'mr' ? 'अलाईन' : language === 'hi' ? 'संरेखित' : 'Align' },
            { id: 'transform', icon: 'fa-wand-magic-sparkles', label: language === 'mr' ? 'रोटेट / फ्लिप' : language === 'hi' ? 'रोटेट / फ्लिप' : 'Transform' },
            { id: 'view', icon: 'fa-eye', label: language === 'mr' ? 'व्ह्यू' : language === 'hi' ? 'दृश्य' : 'View' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 0: Photos & Camera Uploads */}
        {activeTab === 'photos' && (
          <div className="flex flex-col space-y-4 animate-in fade-in duration-150">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'mr' ? 'ओळखपत्राचे फोटो व्यवस्थापित करा' : language === 'hi' ? 'आईडी कार्ड फोटो प्रबंधित करें' : 'Manage Card Photos'}
            </span>

            {/* Front Card Photo Row */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-16 h-10 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  {frontImage ? (
                    <img src={frontImage} alt="Front" className="w-full h-full object-contain" />
                  ) : (
                    <i className="fas fa-address-card text-slate-300 dark:text-slate-600"></i>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    1. {language === 'mr' ? 'समोरची बाजू (Front)' : language === 'hi' ? 'सामने का भाग (Front)' : 'Front Side'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {frontImage ? 'Photo uploaded' : 'No photo yet'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => onOpenCamera('front')}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <i className="fas fa-camera"></i>
                  <span>Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPickImage('front')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <i className="fas fa-folder-open"></i>
                  <span>Upload</span>
                </button>
                {frontImage && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenCrop('front')}
                      className="px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-[11px] font-bold transition-all"
                      title="Crop"
                    >
                      <i className="fas fa-crop-simple"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveImage('front')}
                      className="px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-[11px] font-bold transition-all"
                      title="Remove"
                    >
                      <i className="fas fa-trash-can"></i>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Back Card Photo Row */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-16 h-10 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  {backImage ? (
                    <img src={backImage} alt="Back" className="w-full h-full object-contain" />
                  ) : (
                    <i className="fas fa-qrcode text-slate-300 dark:text-slate-600"></i>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    2. {language === 'mr' ? 'मागील बाजू (Back)' : language === 'hi' ? 'पीछे का भाग (Back)' : 'Back Side'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {backImage ? 'Photo uploaded' : 'No photo yet'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => onOpenCamera('back')}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <i className="fas fa-camera"></i>
                  <span>Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPickImage('back')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <i className="fas fa-folder-open"></i>
                  <span>Upload</span>
                </button>
                {backImage && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenCrop('back')}
                      className="px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-[11px] font-bold transition-all"
                      title="Crop"
                    >
                      <i className="fas fa-crop-simple"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveImage('back')}
                      className="px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-[11px] font-bold transition-all"
                      title="Remove"
                    >
                      <i className="fas fa-trash-can"></i>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Size Presets & Custom MM Inputs */}
        {activeTab === 'presets' && (
          <div className="flex flex-col space-y-3.5 animate-in fade-in duration-150">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'mr' ? 'कार्ड साईज निवडा' : language === 'hi' ? 'कार्ड आकार चुनें' : 'Choose Size Preset'}
            </span>

            {/* Preset Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onApplyPreset('standard')}
                className={`p-2.5 rounded-xl border text-left flex flex-col transition-all active:scale-95 ${
                  activePreset === 'standard'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Standard</span>
                  <i className="fas fa-id-card text-blue-500 text-[10px]"></i>
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">85.6 × 54 mm</span>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                  1:1 Official Wallet
                </span>
              </button>

              <button
                type="button"
                onClick={() => onApplyPreset('large')}
                className={`p-2.5 rounded-xl border text-left flex flex-col transition-all active:scale-95 ${
                  activePreset === 'large'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Large Print</span>
                  <i className="fas fa-expand text-blue-500 text-[10px]"></i>
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">110 × 69.4 mm</span>
                <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                  High Legibility
                </span>
              </button>

              <button
                type="button"
                onClick={() => onApplyPreset('fitWidth')}
                className={`p-2.5 rounded-xl border text-left flex flex-col transition-all active:scale-95 col-span-2 sm:col-span-1 ${
                  activePreset === 'fitWidth'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Fit Page Width</span>
                  <i className="fas fa-arrows-left-right text-blue-500 text-[10px]"></i>
                </span>
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">190 × 119.8 mm</span>
                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                  Full Page Width
                </span>
              </button>
            </div>

            {/* Live Custom Millimeter Inputs */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                  {language === 'mr' ? 'सानुकूल आकार (मि.मी.)' : language === 'hi' ? 'कस्टम आकार (mm)' : 'Custom Dimensions (mm)'}
                </span>
                <button
                  type="button"
                  onClick={() => onOptionsChange({ lockAspectRatio: !options.lockAspectRatio })}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                    options.lockAspectRatio
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                  title="Toggle locked aspect ratio (85.6:54)"
                >
                  <i className={options.lockAspectRatio ? 'fas fa-link' : 'fas fa-link-slash'}></i>
                  <span>{options.lockAspectRatio ? 'Locked 1.586' : 'Free Resize'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-black text-slate-400">W:</span>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    step="0.5"
                    value={activeCard.width}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">mm</span>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl">
                  <span className="text-[11px] font-black text-slate-400">H:</span>
                  <input
                    type="number"
                    min="20"
                    max="280"
                    step="0.5"
                    value={activeCard.height}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">mm</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Alignment Tools */}
        {activeTab === 'align' && (
          <div className="flex flex-col space-y-3 animate-in fade-in duration-150">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'mr' ? 'मांडणी व संरेखन' : language === 'hi' ? 'संरेखण और स्थिति' : 'Alignment & Stacking'}
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCenterH}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-arrows-left-right-to-line text-blue-500"></i>
                <span>Center Horiz</span>
              </button>

              <button
                type="button"
                onClick={handleCenterPage}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-bullseye text-blue-500"></i>
                <span>Center on Page</span>
              </button>

              <button
                type="button"
                onClick={handleStackVertically}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-table-columns rotate-90 text-blue-500"></i>
                <span>Stack 1-Over-1</span>
              </button>

              <button
                type="button"
                onClick={handleAlignCenters}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-align-center text-blue-500"></i>
                <span>Align Centers</span>
              </button>

              <button
                type="button"
                onClick={handleAlignLefts}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-align-left text-blue-500"></i>
                <span>Align Left</span>
              </button>

              <button
                type="button"
                onClick={handleSameSize}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-clone text-blue-500"></i>
                <span>Same Size</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Transform & Rotate Tools */}
        {activeTab === 'transform' && (
          <div className="flex flex-col space-y-3 animate-in fade-in duration-150">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'mr' ? 'रोटेशन आणि फ्लिप' : language === 'hi' ? 'रोटेशन और फ्लिप' : 'Rotation & Flip'}
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { rotation: (activeCard.rotation + 90) % 360 })}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-rotate-right text-blue-500"></i>
                <span>Rotate +90°</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { rotation: ((activeCard.rotation - 90) % 360 + 360) % 360 })}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                <i className="fas fa-rotate-left text-blue-500"></i>
                <span>Rotate -90°</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { flipHorizontal: !activeCard.flipHorizontal })}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  activeCard.flipHorizontal
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200'
                }`}
              >
                <i className="fas fa-arrows-left-right"></i>
                <span>Flip Horiz</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateCard(targetId, { flipVertical: !activeCard.flipVertical })}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  activeCard.flipVertical
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-200'
                }`}
              >
                <i className="fas fa-arrows-up-down"></i>
                <span>Flip Vert</span>
              </button>
            </div>

            {/* Layering Z-index */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {language === 'mr' ? 'लेयरिंग (पुढे/मागे)' : language === 'hi' ? 'लेयरिंग' : 'Layer Stacking'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateCard(targetId, { zIndex: Math.max(cards.front.zIndex, cards.back.zIndex) + 1 })}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1"
                >
                  <i className="fas fa-arrow-up text-blue-500"></i>
                  <span>Bring to Front</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateCard(targetId, { zIndex: Math.min(cards.front.zIndex, cards.back.zIndex) - 1 })}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1"
                >
                  <i className="fas fa-arrow-down text-blue-500"></i>
                  <span>Send to Back</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: View & Snap Guides Toggles */}
        {activeTab === 'view' && (
          <div className="flex flex-col space-y-3 animate-in fade-in duration-150">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'mr' ? 'व्ह्यू पर्याय आणि गाईड्स' : language === 'hi' ? 'दृश्य विकल्प और गाइड' : 'View & Snap Options'}
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.snapToGuides}
                  onChange={(e) => onOptionsChange({ snapToGuides: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'mr' ? 'मॅग्नेटिक स्नॅप गाईड्स' : language === 'hi' ? 'चुंबकीय स्नैप गाइड' : 'Magnetic Snap Guides'}
                </span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.showCutGuides}
                  onChange={(e) => onOptionsChange({ showCutGuides: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'mr' ? 'कापण्यासाठी डॅश्ड लाईन' : language === 'hi' ? 'कटिंग लाइन्स' : 'Dashed Cut Guides'}
                </span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.showLabels}
                  onChange={(e) => onOptionsChange({ showLabels: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'mr' ? 'Front / Back लेबल्स' : language === 'hi' ? 'Front / Back लेबल' : 'Card Labels'}
                </span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.showGrid}
                  onChange={(e) => onOptionsChange({ showGrid: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {language === 'mr' ? '१० मि.मी. ग्रिड व स्केल' : language === 'hi' ? '10mm ग्रिड और रूलर' : '10mm Grid & Crosshair'}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Big Generate & Download PDF Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onGeneratePdf}
            disabled={!hasBothImages || isGeneratingPdf}
            className={`w-full py-4 rounded-2xl font-black text-sm sm:text-base shadow-xl flex items-center justify-center gap-2.5 transition-all ${
              hasBothImages
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-98 cursor-pointer ring-4 ring-blue-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {isGeneratingPdf ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>Generating Print PDF (300 DPI)...</span>
              </>
            ) : (
              <>
                <i className="fas fa-file-arrow-down text-lg"></i>
                <span>
                  {language === 'mr'
                    ? 'A4 PDF डाऊनलोड करा (३०० DPI)'
                    : language === 'hi'
                    ? 'A4 PDF डाउनलोड करें (300 DPI)'
                    : 'Download A4 PDF (300 DPI)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;
