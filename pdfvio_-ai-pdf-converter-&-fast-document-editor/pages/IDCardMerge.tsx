import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessingState } from '../types';
import { useLanguage } from '../i18n';
import A4CanvaEditor from '../components/A4CanvaEditor';
import SlimCardToolbar from '../components/SlimCardToolbar';
import MoreOptionsAccordion from '../components/MoreOptionsAccordion';
import CameraModal from '../components/CameraModal';
import CardCropModal from '../components/CardCropModal';
import {
  A4_PAGE_WIDTH_MM,
  A4_PAGE_HEIGHT_MM,
  CardLayoutType,
  CARD_SIZES,
  EditableCardState,
  CanvasEditorViewOptions,
  getDefaultCardStates,
  loadSavedCardLayout,
  saveCardLayoutToStorage,
  renderCardForPdf,
  createBilingualLabelImage,
} from '../cardLayoutConfig';

const IDCardMerge: React.FC = () => {
  const { t, language } = useLanguage();

  // Load saved layout & options from localStorage (safe try/catch)
  const initialData = useRef(loadSavedCardLayout('standard')).current;

  const [cards, setCards] = useState<Record<'front' | 'back', EditableCardState>>(initialData.cards);
  const [activePreset, setActivePreset] = useState<CardLayoutType | 'custom' | 'fitWidth'>(initialData.preset);
  const [options, setOptions] = useState<CanvasEditorViewOptions>(initialData.options);

  // Selected card for editing ('front' | 'back' | null)
  const [selectedCardId, setSelectedCardId] = useState<'front' | 'back' | null>(null);

  // History Stacks
  const [undoStack, setUndoStack] = useState<Array<Record<'front' | 'back', EditableCardState>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Record<'front' | 'back', EditableCardState>>>([]);

  // Front & Back Image Data URLs
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // Track if user manually adjusted layout
  const userHasCustomizedRef = useRef<boolean>(false);

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

  // Push to Undo Stack
  const pushToUndo = useCallback((prevCards: Record<'front' | 'back', EditableCardState>) => {
    setUndoStack((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(prevCards))]);
    setRedoStack([]);
  }, []);

  // Update a card
  const handleUpdateCard = (id: 'front' | 'back', updates: Partial<EditableCardState>) => {
    userHasCustomizedRef.current = true;
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

  // Reset to default layout
  const handleResetLayout = () => {
    pushToUndo(cards);
    const defaults = getDefaultCardStates('standard');
    setCards(defaults);
    setActivePreset('standard');
    setSelectedCardId(null);
    saveCardLayoutToStorage(defaults, options, 'standard');
  };

  // Apply Presets
  const handleApplyPreset = (preset: CardLayoutType | 'fitWidth') => {
    pushToUndo(cards);
    setActivePreset(preset);

    if (preset === 'standard' || preset === 'large') {
      const defaults = getDefaultCardStates(preset);
      setCards(defaults);
    } else if (preset === 'fitWidth') {
      const fitW = 190.0;
      const fitH = Math.round((fitW / CARD_SIZES.standard.aspectRatio) * 10) / 10;
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

  // File Upload Handlers
  const handleImageFile = (file: File | undefined, side: 'front' | 'back') => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const raw = event.target?.result as string;
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
    let nextFront = frontImage;
    let nextBack = backImage;

    if (cropTargetSide === 'front') {
      nextFront = croppedDataUrl;
      setFrontImage(croppedDataUrl);
      setSelectedCardId('front');
    } else {
      nextBack = croppedDataUrl;
      setBackImage(croppedDataUrl);
      setSelectedCardId('back');
    }
    setCropModalOpen(false);
    setImageToCrop(null);

    // STEP 2 - Page ready (automatic):
    // As soon as both photos exist, auto-place them on the A4 page: front on top,
    // back below, both centered horizontally, same size (default Standard 85.6 x 54 mm), with sensible gap.
    if (nextFront && nextBack && !userHasCustomizedRef.current) {
      const defaults = getDefaultCardStates('standard');
      setCards(defaults);
      setActivePreset('standard');
    }
  };

  const handleRemoveImage = (side: 'front' | 'back') => {
    if (side === 'front') setFrontImage(null);
    else setBackImage(null);
  };

  // High-DPI 300 DPI jsPDF Generator reading from exact same card state
  const mergeToPDF = async () => {
    if (!frontImage || !backImage) return;

    setState({
      status: 'processing',
      progress: 30,
      message: language === 'mr' ? 'A4 PDF तयार होत आहे...' : language === 'hi' ? 'A4 PDF बन रही है...' : 'Generating Print PDF...',
    });

    try {
      const jspdfLib = (window as any).jspdf;
      const jsPDF = jspdfLib?.jsPDF || jspdfLib;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      // Sort cards by zIndex
      const sortedCardIds: Array<'front' | 'back'> = ['front', 'back'].sort(
        (a, b) => cards[a as 'front' | 'back'].zIndex - cards[b as 'front' | 'back'].zIndex
      ) as Array<'front' | 'back'>;

      for (let i = 0; i < sortedCardIds.length; i++) {
        const side = sortedCardIds[i];
        const card = cards[side];
        const imgData = side === 'front' ? frontImage : backImage;
        if (!imgData) continue;

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
          doc.setDrawColor(160, 174, 192);
          doc.setLineWidth(0.35);
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

      // Output PDF as blob URL (compatible with Android WebViews and mobile browsers)
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);

      const fileName = `Aadhaar_A4_${
        activePreset === 'standard'
          ? 'Standard_85x54mm'
          : activePreset === 'large'
          ? 'Large_110x69mm'
          : 'Custom'
      }_XeroxReady.pdf`;

      setState({
        status: 'success',
        progress: 100,
        resultUrl: url,
        resultFileName: fileName,
      });

      // Auto trigger download for seamless 1-tap UX
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

  // Missing photo hint text
  const missingPhotoHint = !frontImage && !backImage
    ? (language === 'mr'
        ? 'समोरची व मागील दोन्ही बाजूंचे फोटो जोडा'
        : language === 'hi'
        ? 'आगे और पीछे दोनों फोटो जोड़ें'
        : 'Add both front and back photos to download')
    : !frontImage
    ? (language === 'mr'
        ? 'समोरची बाजू (Front side) फोटो जोडा'
        : language === 'hi'
        ? 'सामने का फोटो (Front photo) जोड़ें'
        : 'Add the front photo')
    : !backImage
    ? (language === 'mr'
        ? 'मागील बाजू (Back side) फोटो जोडा'
        : language === 'hi'
        ? 'पीछे का फोटो (Back photo) जोड़ें'
        : 'Add the back photo')
    : null;

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-64 transition-colors duration-300">
      {/* Hidden Native File Inputs */}
      <input
        type="file"
        ref={frontFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleImageFile(e.target.files?.[0], 'front');
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={backFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleImageFile(e.target.files?.[0], 'back');
          e.target.value = '';
        }}
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

      {/* Header - Simple & Clean */}
      <div className="text-center mb-4 sm:mb-5">
        <h1 className="text-xl sm:text-2xl font-[900] text-slate-900 dark:text-white tracking-tight mb-1">
          {t('aadhaarTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
          {language === 'mr'
            ? '२ फोटो जोडा आणि एका क्लिकमध्ये A4 झेरॉक्स पेज मिळवा'
            : language === 'hi'
            ? '२ फोटो जोड़ें और एक क्लिक में A4 ज़ेरॉक्स पेज प्राप्त करें'
            : 'Add 2 photos and get a clean A4 xerox page in 1 tap'}
        </p>
      </div>

      {/* STEP 1: ADD PHOTOS - Two Big Cards Side by Side */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
            1
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {language === 'mr' ? 'फोटो जोडा' : language === 'hi' ? 'फोटो जोड़ें' : 'Add Photos'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {/* Card 1: Front Side */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white flex items-center gap-1 truncate">
                <i className="fas fa-address-card text-blue-500"></i>
                <span>{language === 'mr' ? 'समोरची बाजू' : language === 'hi' ? 'सामने का भाग' : 'Front Side'}</span>
              </span>
              {frontImage && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                  <i className="fas fa-check-circle"></i>
                </span>
              )}
            </div>

            {frontImage ? (
              /* Uploaded State: Thumbnail with Change / Crop / Remove */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full aspect-[85.6/54] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-xs group"
                  onClick={() => frontFileInputRef.current?.click()}
                  title="Click to replace"
                >
                  <img src={frontImage} alt="Front" className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center justify-center gap-2 w-full pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => frontFileInputRef.current?.click()}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => openCameraForSide('front')}
                    className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Camera"
                  >
                    <i className="fas fa-camera text-[10px]"></i>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCropTargetSide('front');
                      setImageToCrop(frontImage);
                      setCropModalOpen(true);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Crop
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => setFrontImage(null)}
                    className="font-bold text-rose-500 hover:underline"
                    title="Remove"
                  >
                    <i className="fas fa-trash-can"></i>
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State: Two Large Touch Buttons (Camera & Gallery) */
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openCameraForSide('front')}
                  className="w-full py-3 sm:py-3.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-camera text-sm"></i>
                  <span>{language === 'mr' ? 'कॅमेरा' : language === 'hi' ? 'कैमरा' : 'Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => frontFileInputRef.current?.click()}
                  className="w-full py-2.5 sm:py-3 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-folder-open text-xs text-slate-500"></i>
                  <span>{language === 'mr' ? 'गॅलरी' : language === 'hi' ? 'गैलरी' : 'Gallery'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Back Side */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white flex items-center gap-1 truncate">
                <i className="fas fa-qrcode text-indigo-500"></i>
                <span>{language === 'mr' ? 'मागील बाजू' : language === 'hi' ? 'पीछे का भाग' : 'Back Side'}</span>
              </span>
              {backImage && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                  <i className="fas fa-check-circle"></i>
                </span>
              )}
            </div>

            {backImage ? (
              /* Uploaded State: Thumbnail with Change / Crop / Remove */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full aspect-[85.6/54] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-xs group"
                  onClick={() => backFileInputRef.current?.click()}
                  title="Click to replace"
                >
                  <img src={backImage} alt="Back" className="w-full h-full object-contain" />
                </div>
                <div className="flex items-center justify-center gap-2 w-full pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => backFileInputRef.current?.click()}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => openCameraForSide('back')}
                    className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Camera"
                  >
                    <i className="fas fa-camera text-[10px]"></i>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCropTargetSide('back');
                      setImageToCrop(backImage);
                      setCropModalOpen(true);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Crop
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <button
                    type="button"
                    onClick={() => setBackImage(null)}
                    className="font-bold text-rose-500 hover:underline"
                    title="Remove"
                  >
                    <i className="fas fa-trash-can"></i>
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State: Two Large Touch Buttons (Camera & Gallery) */
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => openCameraForSide('back')}
                  className="w-full py-3 sm:py-3.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-camera text-sm"></i>
                  <span>{language === 'mr' ? 'कॅमेरा' : language === 'hi' ? 'कैमरा' : 'Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => backFileInputRef.current?.click()}
                  className="w-full py-2.5 sm:py-3 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-folder-open text-xs text-slate-500"></i>
                  <span>{language === 'mr' ? 'गॅलरी' : language === 'hi' ? 'गैलरी' : 'Gallery'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 2: LIVE A4 PAGE PREVIEW (AUTOMATIC) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
              2
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {language === 'mr' ? 'A4 प्रिंट पूर्वावलोकन' : language === 'hi' ? 'A4 प्रिंट पूर्वावलोकन' : 'A4 Page Preview'}
            </span>
          </div>

          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            Standard 85.6 × 54 mm
          </span>
        </div>

        {/* Interactive A4 Sheet Canvas */}
        <div className="w-full bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col items-center">
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

      {/* STEP 3: SLIM ACTION BAR UNDER PAGE (WHEN CARD IS SELECTED) */}
      {selectedCardId && (
        <div className="mb-4 flex justify-center">
          <SlimCardToolbar
            card={cards[selectedCardId]}
            hasImage={!!(selectedCardId === 'front' ? frontImage : backImage)}
            onUpdateCard={(updates) => handleUpdateCard(selectedCardId, updates)}
            onOpenCrop={() => {
              const currentImg = selectedCardId === 'front' ? frontImage : backImage;
              if (currentImg) {
                setCropTargetSide(selectedCardId);
                setImageToCrop(currentImg);
                setCropModalOpen(true);
              }
            }}
            onRemoveImage={() => handleRemoveImage(selectedCardId)}
            onDeselect={() => setSelectedCardId(null)}
          />
        </div>
      )}

      {/* COLLAPSED "MORE OPTIONS" ACCORDION (CLOSED BY DEFAULT) */}
      <div className="mb-6 flex justify-center">
        <MoreOptionsAccordion
          cards={cards}
          selectedCardId={selectedCardId}
          onSelectCard={setSelectedCardId}
          options={options}
          activePreset={activePreset}
          onUpdateCard={handleUpdateCard}
          onApplyPreset={handleApplyPreset}
          onOptionsChange={(newOpts) => setOptions((prev) => ({ ...prev, ...newOpts }))}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onResetLayout={handleResetLayout}
        />
      </div>

      {/* Privacy Assurance */}
      <div className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400 mb-4 px-2">
        <i className="fas fa-shield-halved text-emerald-500"></i>
        <span>{t('privacyNotice')}</span>
      </div>

      {/* FIXED BOTTOM DOWNLOAD BAR (Always Visible & Above Mobile Nav Bar) */}
      <div className="fixed bottom-[88px] sm:bottom-6 left-0 right-0 z-50 px-3 sm:px-4 pointer-events-none">
        <div className="max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-2.5 shadow-2xl shadow-slate-900/15 pointer-events-auto flex flex-col gap-1.5">
          {/* Missing photo hint line above button */}
          {missingPhotoHint && (
            <div className="text-center text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
              <i className="fas fa-circle-info text-[10px]"></i>
              <span>{missingPhotoHint}</span>
            </div>
          )}

          {/* Big Download Button */}
          <button
            type="button"
            onClick={mergeToPDF}
            disabled={!hasBothImages || state.status === 'processing'}
            className={`w-full py-3.5 sm:py-4 px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 cursor-pointer ${
              hasBothImages
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 ring-2 ring-blue-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
            }`}
          >
            {state.status === 'processing' ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>{state.message || 'Creating A4 PDF...'}</span>
              </>
            ) : (
              <>
                <i className="fas fa-file-arrow-down text-base"></i>
                <span>
                  {language === 'mr'
                    ? 'A4 PDF डाऊनलोड करा'
                    : language === 'hi'
                    ? 'A4 PDF डाउनलोड करें'
                    : 'Download A4 PDF'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IDCardMerge;
