import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessingState } from '../types';
import { useLanguage } from '../i18n';
import A4CanvaEditor from '../components/A4CanvaEditor';
import EditorToolbar from '../components/EditorToolbar';
import CameraModal from '../components/CameraModal';
import CardCropModal from '../components/CardCropModal';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  CardLayoutType,
  CARD_SIZES,
  EditableCardState,
  CanvasEditorViewOptions,
  DEFAULT_VIEW_OPTIONS,
  getDefaultCardStates,
  loadSavedCardLayout,
  saveCardLayoutToStorage,
  renderCardForPdf,
  createBilingualLabelImage,
} from '../cardLayoutConfig';

const IDCardMerge: React.FC = () => {
  const { t, language } = useLanguage();

  // 1. Initial State from localStorage (Wrapped in try/catch)
  const initialData = useRef(loadSavedCardLayout('standard')).current;

  const [cards, setCards] = useState<Record<'front' | 'back', EditableCardState>>(initialData.cards);
  const [activePreset, setActivePreset] = useState<CardLayoutType | 'custom' | 'fitWidth'>(initialData.preset);
  const [options, setOptions] = useState<CanvasEditorViewOptions>(initialData.options);

  // Selected Card for editing ('front' | 'back' | null)
  const [selectedCardId, setSelectedCardId] = useState<'front' | 'back' | null>('front');

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<Array<Record<'front' | 'back', EditableCardState>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Record<'front' | 'back', EditableCardState>>>([]);

  // Front & Back Image Data URLs
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // Camera modal state
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [cameraTargetSide, setCameraTargetSide] = useState<'front' | 'back'>('front');

  // Manual crop fine-tuning modal state
  const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTargetSide, setCropTargetSide] = useState<'front' | 'back'>('front');

  // Processing / PDF State
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });

  // Native File Inputs
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${t('brandName')} - ${t('aadhaarTitle')}`;
  }, [language, t]);

  // Persist layout to localStorage
  useEffect(() => {
    const presetToSave = activePreset === 'large' ? 'large' : 'standard';
    saveCardLayoutToStorage(cards, options, presetToSave);
  }, [cards, options, activePreset]);

  // Push to Undo Stack before modifying state
  const pushToUndo = useCallback((prevCards: Record<'front' | 'back', EditableCardState>) => {
    setUndoStack((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(prevCards))]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Update a card's millimeter coordinates, size, or rotation
  const handleUpdateCard = (id: 'front' | 'back', updates: Partial<EditableCardState>) => {
    setCards((prev) => {
      pushToUndo(prev);
      return {
        ...prev,
        [id]: {
          ...prev[id],
          ...updates,
        },
      };
    });
    if (updates.width !== undefined || updates.height !== undefined) {
      setActivePreset('custom');
    }
  };

  // Undo Handler
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(cards))]);
    setCards(previous);
  };

  // Redo Handler
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(cards))]);
    setCards(next);
  };

  // Restore Default Layout Handler
  const handleResetLayout = () => {
    pushToUndo(cards);
    const defaults = getDefaultCardStates('standard');
    setCards(defaults);
    setActivePreset('standard');
    setSelectedCardId('front');
    saveCardLayoutToStorage(defaults, options, 'standard');
  };

  // Apply Size Preset (Standard, Large, Fit Page Width)
  const handleApplyPreset = (preset: CardLayoutType | 'fitWidth') => {
    pushToUndo(cards);
    setActivePreset(preset);

    if (preset === 'standard' || preset === 'large') {
      const defaults = getDefaultCardStates(preset);
      setCards(defaults);
    } else if (preset === 'fitWidth') {
      // 190mm width (210mm page with 10mm margins on both sides)
      const fitW = 190.0;
      const fitH = Math.round((fitW / CARD_SIZES.standard.aspectRatio) * 10) / 10; // ~119.9 mm
      const gap = 12.0;
      const totalH = fitH * 2 + gap;
      const startY = Math.max(15, (A4_PAGE_HEIGHT_MM - totalH) / 2);

      setCards({
        front: {
          ...cards.front,
          x: 10,
          y: Math.round(startY * 10) / 10,
          width: fitW,
          height: fitH,
          rotation: 0,
        },
        back: {
          ...cards.back,
          x: 10,
          y: Math.round((startY + fitH + gap) * 10) / 10,
          width: fitW,
          height: fitH,
          rotation: 0,
        },
      });
    }
  };

  // Update Options (Toggles)
  const handleOptionsChange = (newOptions: Partial<CanvasEditorViewOptions>) => {
    setOptions((prev) => ({ ...prev, ...newOptions }));
  };

  // File Upload Handlers
  const handleImageFile = (file: File | undefined, side: 'front' | 'back') => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const raw = event.target?.result as string;
        // Open manual crop modal so user can adjust edges before adding
        setCropTargetSide(side);
        setImageToCrop(raw);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCameraForSide = (side: 'front' | 'back') => {
    setCameraTargetSide(side);
    setCameraModalOpen(true);
  };

  const handleCameraCapture = (dataUrl: string) => {
    setCropTargetSide(cameraTargetSide);
    setImageToCrop(dataUrl);
    setCropModalOpen(true);
  };

  const handleCropDone = (croppedDataUrl: string) => {
    if (cropTargetSide === 'front') {
      setFrontImage(croppedDataUrl);
    } else {
      setBackImage(croppedDataUrl);
    }
    setCropModalOpen(false);
    setImageToCrop(null);
  };

  const handleRemoveImage = (side: 'front' | 'back') => {
    if (side === 'front') setFrontImage(null);
    else setBackImage(null);
  };

  // High-DPI 300 DPI jsPDF Generator reading from EXACT same card state
  const mergeToPDF = async () => {
    if (!frontImage && !backImage) return;

    setState({
      status: 'processing',
      progress: 30,
      message: t('generatingPdfHighDpi') || 'Generating Print PDF (300 DPI)...',
    });

    try {
      const jspdfLib = (window as any).jspdf;
      const jsPDF = jspdfLib?.jsPDF || jspdfLib;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      // Sort cards by zIndex so lower cards are drawn first, higher cards on top
      const sortedCardIds: Array<'front' | 'back'> = ['front', 'back'].sort(
        (a, b) => cards[a as 'front' | 'back'].zIndex - cards[b as 'front' | 'back'].zIndex
      ) as Array<'front' | 'back'>;

      for (let i = 0; i < sortedCardIds.length; i++) {
        const side = sortedCardIds[i];
        const card = cards[side];
        const imgData = side === 'front' ? frontImage : backImage;
        if (!imgData) continue;

        setState({
          status: 'processing',
          progress: 40 + i * 25,
          message: `Rendering ${side === 'front' ? 'Front' : 'Back'} card at 300 DPI...`,
        });

        // Render card with containment, flips, and canvas rotation to ensure 100% PDF fidelity
        const renderResult = await renderCardForPdf(card, imgData, 2400);

        doc.addImage(
          renderResult.dataUrl,
          renderResult.format,
          renderResult.x,
          renderResult.y,
          renderResult.width,
          renderResult.height
        );

        // Dashed Cut Guides
        if (options.showCutGuides) {
          doc.setDrawColor(160, 174, 192); // Clean slate cut guide line
          doc.setLineWidth(0.35); // Sharp cut line
          doc.setLineDashPattern([2, 2], 0);

          if (renderResult.corners && renderResult.corners.length === 4) {
            const [p1, p2, p3, p4] = renderResult.corners;
            doc.line(p1.x, p1.y, p2.x, p2.y);
            doc.line(p2.x, p2.y, p3.x, p3.y);
            doc.line(p3.x, p3.y, p4.x, p4.y);
            doc.line(p4.x, p4.y, p1.x, p1.y);
          } else {
            doc.rect(card.x, card.y, card.width, card.height);
          }

          doc.setLineDashPattern([], 0);
        }

        // Bilingual FRONT / BACK Labels (Avoids jsPDF Devanagari garbling by rendering via canvas image)
        if (options.showLabels) {
          const normRot = ((card.rotation % 360) + 360) % 360;
          if (normRot === 0) {
            const labelImg = createBilingualLabelImage(
              card.title,
              language === 'mr' ? card.marathiTitle : language === 'hi' ? card.hindiTitle : '',
              card.width,
              4.5
            );
            if (labelImg) {
              const labelY = Math.max(2, card.y - 5.0);
              doc.addImage(labelImg, 'PNG', card.x, labelY, card.width, 4.5);
            }
          }
        }
      }

      // Output PDF as blob URL (works inside Android WebViews and mobile browsers)
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);

      const fileName = `Aadhaar_A4_${
        activePreset === 'standard'
          ? 'Standard_85x54mm'
          : activePreset === 'large'
          ? 'Large_110x69mm'
          : 'Canva_Custom'
      }_PrintReady.pdf`;

      setState({
        status: 'success',
        progress: 100,
        resultUrl: url,
        resultFileName: fileName,
      });
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setState({
        status: 'error',
        progress: 0,
        message: 'Failed to create PDF. Please retry.',
      });
    }
  };

  const hasBothImages = !!(frontImage && backImage);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 transition-colors duration-300 pb-28 md:pb-16">
      {/* Hidden Native File Inputs */}
      <input
        type="file"
        ref={frontFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile(e.target.files?.[0], 'front')}
      />
      <input
        type="file"
        ref={backFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile(e.target.files?.[0], 'back')}
      />

      {/* Interactive Camera Modal with Green ID Guide Box */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        sideTitle={cameraTargetSide === 'front' ? t('frontSide') : t('backSide')}
      />

      {/* Manual Fine-Tune Crop Modal (drag handles, zoom, rotate 90°) */}
      <CardCropModal
        isOpen={cropModalOpen}
        imageSrc={imageToCrop}
        onClose={() => {
          setCropModalOpen(false);
          setImageToCrop(null);
        }}
        onCropDone={handleCropDone}
        sideTitle={cropTargetSide === 'front' ? t('frontSide') : t('backSide')}
      />

      {/* Page Header */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 mb-2">
          <i className="fas fa-wand-magic-sparkles"></i>
          <span>{t('editorTitle') || 'Canva-style A4 Layout Editor'}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-[900] text-slate-900 dark:text-white tracking-tight mb-1.5">
          {t('aadhaarTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 font-medium max-w-xl mx-auto text-xs sm:text-sm mb-3">
          {t('editorSubtitle') || 'Drag, resize from corners, rotate cards freely, or use one-click alignments'}
        </p>

        {/* Supported Cards Quick Tags */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-2xl mx-auto text-[11px] font-bold">
          <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <i className="fas fa-id-card"></i> Aadhaar Card (आधार)
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <i className="fas fa-credit-card"></i> PAN Card (पॅन)
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <i className="fas fa-check-to-slot"></i> Voter ID (मतदान)
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <i className="fas fa-id-badge"></i> Driving License (लायसन्स)
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <i className="fas fa-graduation-cap"></i> Student & Office ID
          </span>
        </div>
      </div>

      {/* Main Two-Column Canva Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live A4 Canva Sheet Editor */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-5 shadow-sm flex flex-col items-center">
            {/* Canvas Header Pill */}
            <div className="flex items-center justify-between w-full max-w-[430px] mb-2 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  A4 CANVA EDITOR • 210 × 297 MM
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full shadow-xs">
                {activePreset === 'standard'
                  ? '85.6 × 54 mm'
                  : activePreset === 'large'
                  ? '110 × 69.4 mm'
                  : activePreset === 'fitWidth'
                  ? '190 × 119.8 mm'
                  : 'Custom Size'}
              </span>
            </div>

            {/* A4 Canva Interactive Sheet */}
            <A4CanvaEditor
              cards={cards}
              frontImage={frontImage}
              backImage={backImage}
              selectedCardId={selectedCardId}
              onSelectCard={setSelectedCardId}
              onUpdateCard={handleUpdateCard}
              options={options}
              onOpenCrop={(side) => {
                setCropTargetSide(side);
                setImageToCrop(side === 'front' ? frontImage : backImage);
                setCropModalOpen(true);
              }}
              onOpenPickImage={(side) => {
                if (side === 'front') frontFileInputRef.current?.click();
                else backFileInputRef.current?.click();
              }}
              onRemoveImage={handleRemoveImage}
            />
          </div>
        </div>

        {/* Right Column: Editor Toolbar Controls */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <EditorToolbar
            cards={cards}
            frontImage={frontImage}
            backImage={backImage}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onUpdateCard={handleUpdateCard}
            onApplyPreset={handleApplyPreset}
            activePreset={activePreset}
            options={options}
            onOptionsChange={handleOptionsChange}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onResetLayout={handleResetLayout}
            onOpenCrop={(side) => {
              setCropTargetSide(side);
              setImageToCrop(side === 'front' ? frontImage : backImage);
              setCropModalOpen(true);
            }}
            onOpenCamera={openCameraForSide}
            onOpenPickImage={(side) => {
              if (side === 'front') frontFileInputRef.current?.click();
              else backFileInputRef.current?.click();
            }}
            onRemoveImage={handleRemoveImage}
            hasBothImages={hasBothImages}
            onGeneratePdf={mergeToPDF}
            isGeneratingPdf={state.status === 'processing'}
          />

          {/* Missing Photos Status Guidance */}
          {!hasBothImages && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <i className="fas fa-circle-info text-amber-500 shrink-0"></i>
              <span>
                {!frontImage && !backImage
                  ? language === 'mr'
                    ? 'कृपया PDF डाऊनलोड करण्यासाठी Front आणि Back दोन्ही फोटो जोडा'
                    : language === 'hi'
                    ? 'कृपया PDF डाउनलोड करने के लिए Front और Back दोनों फोटो जोड़ें'
                    : 'Please add both Front and Back photos to generate A4 PDF'
                  : !frontImage
                  ? language === 'mr'
                    ? 'कृपया समोरची बाजू (Front Side) फोटो जोडा'
                    : language === 'hi'
                    ? 'कृपया सामने की फोटो (Front Side) जोड़ें'
                    : 'Please add Front Side photo'
                  : language === 'mr'
                  ? 'कृपया मागील बाजू (Back Side) फोटो जोडा'
                  : language === 'hi'
                  ? 'कृपया पीछे की फोटो (Back Side) जोड़ें'
                  : 'Please add Back Side photo'}
              </span>
            </div>
          )}

          {/* Privacy Assurance */}
          <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-500 dark:text-slate-400 px-2 py-1">
            <i className="fas fa-lock text-emerald-500"></i>
            <span>{t('privacyNotice')}</span>
          </div>

          {/* Success Download Banner */}
          {state.status === 'success' && state.resultUrl && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border-2 border-emerald-500 text-center shadow-xl animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-emerald-500 text-white text-xl rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-md shadow-emerald-500/30">
                <i className="fas fa-check"></i>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">
                {t('successTitle')}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                {t('successDesc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                <a
                  href={state.resultUrl}
                  download={state.resultFileName}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <i className="fas fa-download"></i> {t('downloadPdf')}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setState({ status: 'idle', progress: 0 });
                  }}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 px-4 py-3 rounded-xl font-black text-xs sm:text-sm transition-all"
                >
                  {t('mergeAnother')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IDCardMerge;
