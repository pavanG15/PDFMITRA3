import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessingState } from '../types';
import { useLanguage } from '../i18n';
import {
  shareFileViaAndroidBridge,
  executeDownloadWithAd,
  triggerBrowserDownload,
} from '../utils/shareHelper';
import DownloadSuccessAdArea from '../components/DownloadSuccessAdArea';
import QuickCompressModal from '../components/QuickCompressModal';
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
  renderA4PageToJpg,
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

  // Download Options: Format (PDF vs JPG) & Compression / Quality Level
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [compressLevel, setCompressLevel] = useState<'high' | 'standard' | 'compressed' | 'ultra_compressed'>('compressed');
  const [quickCompressModalOpen, setQuickCompressModalOpen] = useState<boolean>(false);
  const [adState, setAdState] = useState<'idle' | 'downloading'>('idle');
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);

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

  // Aadhaar size info modal state
  const [sizeInfoModalOpen, setSizeInfoModalOpen] = useState<boolean>(false);

  // Processing / PDF State
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });

  // Native File Inputs
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const bothPdfInputRef = useRef<HTMLInputElement>(null);

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

  // PDF Extraction Helper
  const handlePdfUpload = async (file: File) => {
    try {
      const pdfjs = (window as any).pdfjsLib;
      if (!pdfjs) {
        alert(language === 'mr' ? 'PDF लायब्ररी लोड होत आहे... कृपया पुन्हा प्रयत्न करा.' : 'PDF reader is loading, please retry in a second.');
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const renderPage = async (pageNum: number): Promise<string> => {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context error');
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.95);
      };

      if (pdf.numPages >= 2) {
        const p1 = await renderPage(1);
        const p2 = await renderPage(2);
        setFrontImage(p1);
        setBackImage(p2);
        setSelectedCardId('front');
        const defaults = getDefaultCardStates(activePreset === 'large' ? 'large' : 'standard');
        setCards(defaults);
      } else if (pdf.numPages === 1) {
        const p1 = await renderPage(1);
        setFrontImage(p1);
        setSelectedCardId('front');
        setCropTargetSide('front');
        setImageToCrop(p1);
        setCropModalOpen(true);
      }
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      if (err?.name === 'PasswordException') {
        alert(language === 'mr' ? 'हा PDF पासवर्डने लॉक केलेला आहे. कृपया अनलॉक केलेला PDF वापरा.' : 'This PDF is password protected. Please unlock it first.');
      } else {
        alert(language === 'mr' ? 'PDF वाचण्यात त्रुटी आली. कृपया फोटो किंवा इमेज अपलोड करा.' : 'Error opening PDF. Please upload photos instead.');
      }
    }
  };

  // File Upload Handlers (supports Images & PDFs)
  const handleImageFile = async (file: File | undefined, side: 'front' | 'back') => {
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            setCropTargetSide(side);
            setImageToCrop(dataUrl);
            setCropModalOpen(true);
            return;
          }
        }
      } catch (err) {
        console.warn('Single PDF page load error:', err);
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target?.result as string;
      setCropTargetSide(side);
      setImageToCrop(raw);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Quick 1-tap Stack 1-Over-1 Xerox Alignment (Pulled out of More Options)
  const handleStackVertically = () => {
    pushToUndo(cards);
    userHasCustomizedRef.current = true;
    const frontW = cards.front.width;
    const frontH = cards.front.height;
    const backW = cards.back.width;
    const backH = cards.back.height;

    const gap = 16.0;
    const totalHeight = frontH + backH + gap;
    const startY = Math.max(20, (A4_PAGE_HEIGHT_MM - totalHeight) / 2);

    setCards({
      front: {
        ...cards.front,
        x: Math.round(((A4_PAGE_WIDTH_MM - frontW) / 2) * 10) / 10,
        y: Math.round(startY * 10) / 10,
        rotation: 0,
      },
      back: {
        ...cards.back,
        x: Math.round(((A4_PAGE_WIDTH_MM - backW) / 2) * 10) / 10,
        y: Math.round((startY + frontH + gap) * 10) / 10,
        rotation: 0,
      },
    });
  };

  // Quick 1-tap Rotate 90 degrees
  const handleQuickRotate = (targetSide?: 'front' | 'back') => {
    const side = targetSide || selectedCardId || 'front';
    handleUpdateCard(side, {
      rotation: (cards[side].rotation + 90) % 360,
    });
  };

  // Quick View Toggles (Pulled out of More Options)
  const handleToggleCutGuides = () => {
    setOptions((prev) => ({ ...prev, showCutGuides: !prev.showCutGuides }));
  };

  const handleToggleLabels = () => {
    setOptions((prev) => ({ ...prev, showLabels: !prev.showLabels }));
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

  // High-DPI jsPDF Generator with compression options
  const mergeToPDF = async (qualityLevel: 'high' | 'standard' | 'compressed' | 'ultra_compressed' = compressLevel) => {
    if (!frontImage || !backImage) return;

    setState({
      status: 'processing',
      progress: 30,
      message: language === 'mr' ? 'A4 PDF तयार होत आहे...' : language === 'hi' ? 'A4 PDF बन रही है...' : 'Generating Print PDF...',
    });

    try {
      const jspdfLib = (window as any).jspdf;
      const jsPDF = jspdfLib?.jsPDF || jspdfLib;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

      let maxPixel = 2400;
      let jpegQ = 0.92;
      if (qualityLevel === 'ultra_compressed') {
        maxPixel = 650;
        jpegQ = 0.48;
      } else if (qualityLevel === 'compressed') {
        maxPixel = 950;
        jpegQ = 0.65;
      } else if (qualityLevel === 'standard') {
        maxPixel = 1400;
        jpegQ = 0.80;
      }

      // Sort cards by zIndex
      const sortedCardIds: Array<'front' | 'back'> = ['front', 'back'].sort(
        (a, b) => cards[a as 'front' | 'back'].zIndex - cards[b as 'front' | 'back'].zIndex
      ) as Array<'front' | 'back'>;

      for (let i = 0; i < sortedCardIds.length; i++) {
        const side = sortedCardIds[i];
        const card = cards[side];
        const imgData = side === 'front' ? frontImage : backImage;
        if (!imgData) continue;

        const renderResult = await renderCardForPdf(card, imgData, maxPixel, jpegQ);

        doc.addImage(
          renderResult.dataUrl,
          renderResult.format,
          renderResult.x,
          renderResult.y,
          renderResult.width,
          renderResult.height,
          undefined,
          'FAST'
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

      const sizeSuffix =
        qualityLevel === 'ultra_compressed'
          ? '_Under100KB'
          : qualityLevel === 'compressed'
          ? '_Under200KB'
          : qualityLevel === 'standard'
          ? '_Standard'
          : '_300DPI';
      const fileName = `Aadhaar_A4_${
        activePreset === 'standard'
          ? 'Standard_85x54mm'
          : activePreset === 'large'
          ? 'Large_110x69mm'
          : 'Custom'
      }${sizeSuffix}.pdf`;

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
      throw err;
    }
  };

  // High-Quality A4 JPG Image Generator
  const downloadAsJPG = async (qualityLevel: 'high' | 'standard' | 'compressed' | 'ultra_compressed' = compressLevel) => {
    if (!frontImage || !backImage) return;

    setState({
      status: 'processing',
      progress: 40,
      message: language === 'mr' ? 'A4 JPG तयार होत आहे...' : language === 'hi' ? 'A4 JPG बन रही है...' : 'Generating A4 JPG...',
    });

    try {
      const dataUrl = await renderA4PageToJpg(
        cards,
        frontImage,
        backImage,
        options,
        qualityLevel,
        language
      );

      const sizeSuffix =
        qualityLevel === 'ultra_compressed'
          ? '_Under100KB'
          : qualityLevel === 'compressed'
          ? '_Under200KB'
          : qualityLevel === 'standard'
          ? '_Standard'
          : '_High';
      const fileName = `Aadhaar_A4_${
        activePreset === 'standard'
          ? 'Standard_85x54mm'
          : activePreset === 'large'
          ? 'Large_110x69mm'
          : 'Custom'
      }${sizeSuffix}.jpg`;

      setState({
        status: 'success',
        progress: 100,
        resultUrl: dataUrl,
        resultFileName: fileName,
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('JPG Generation Error:', err);
      setState({
        status: 'error',
        progress: 0,
        message: 'Failed to create JPG. Please retry.',
      });
      throw err;
    }
  };

  // Universal download dispatcher
  const handleDownload = async (
    formatOverride?: 'pdf' | 'jpg',
    qualityOverride?: 'high' | 'standard' | 'compressed' | 'ultra_compressed'
  ) => {
    if (!frontImage || !backImage) return;

    const fmt = formatOverride || downloadFormat;
    const q = qualityOverride || compressLevel;
    const downloadKey = `Aadhaar_A4_${fmt}_${q}`;

    try {
      await executeDownloadWithAd(
        async () => {
          if (fmt === 'pdf') {
            await mergeToPDF(q);
          } else {
            await downloadAsJPG(q);
          }
          setHasDownloaded(true);
        },
        {
          downloadKey,
          onStateChange: (state) => setAdState(state),
        }
      );
    } catch (err) {
      console.error('Download execution error:', err);
    }
  };

  // Open dedicated compress modal for the document/image
  const handleOpenCompressModal = async () => {
    if (!frontImage || !backImage) return;
    if (state.status === 'success' && state.resultUrl) {
      setQuickCompressModalOpen(true);
    } else {
      // If not yet generated, generate it first then open compress modal
      if (downloadFormat === 'pdf') {
        await mergeToPDF(compressLevel);
      } else {
        await downloadAsJPG(compressLevel);
      }
      setQuickCompressModalOpen(true);
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-6 sm:pb-8 transition-colors duration-300">
      {/* Hidden Native File Inputs */}
      <input
        type="file"
        ref={frontFileInputRef}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleImageFile(e.target.files?.[0], 'front');
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={backFileInputRef}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleImageFile(e.target.files?.[0], 'back');
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={bothPdfInputRef}
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePdfUpload(file);
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

      {/* Size Verification & Print Guide Modal */}
      {sizeInfoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
                  <i className="fas fa-ruler-combined"></i>
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {language === 'mr' ? '१००% अचूक आधार साईज माहिती' : language === 'hi' ? '१००% सटीक आधार साइज जानकारी' : '100% Accurate Aadhaar Dimensions'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSizeInfoModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs"
              >
                <i className="fas fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                <div className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                  <i className="fas fa-circle-check text-emerald-600"></i>
                  <span>Standard 85.6 × 54.0 mm (ISO/IEC 7810 ID-1)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                  {language === 'mr'
                    ? 'हे UIDAI अधिकृत आधार कार्ड / PVC स्मार्ट कार्डचे आंतरराष्ट्रीय अचूक माप आहे. या मापाने प्रिंट केल्यावर कार्ड पाकीटात (Wallet) तंतोतंत बसते व लॅमिनेशनसाठी योग्य राहते.'
                    : language === 'hi'
                    ? 'यह UIDAI आधार कार्ड और स्मार्ट कार्ड का अंतरराष्ट्रीय आधिकारिक माप है। यह आपके पर्स में बिल्कुल सही फिट बैठता है।'
                    : 'Official UIDAI & Smart Card standard (ISO 7810 ID-1). Matches your physical pocket wallet card 1:1.'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                <div className="font-black text-blue-800 dark:text-blue-300 flex items-center gap-1.5 mb-1">
                  <i className="fas fa-magnifying-glass-plus text-blue-600"></i>
                  <span>Large Xerox 110.0 × 69.4 mm (+28%)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-900/80 dark:text-blue-200/80">
                  {language === 'mr'
                    ? 'झेरॉक्स दुकानांमध्ये मागील बाजूचा पत्ता व QR कोड ज्येष्ठ नागरिक आणि अधिकाऱ्यांना स्पष्ट वाचता यावा म्हणून वापरली जाणारी लोकप्रिय साईज.'
                    : language === 'hi'
                    ? 'ज़ेरॉक्स दुकानों में पता व क्यूआर कोड आसानी से पढ़ने योग्य बनाने के लिए लोकप्रिय 28% बड़ा आकार।'
                    : 'Popular Xerox photocopy size (+28% bigger text) for effortless readability of address & QR code.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
                <i className="fas fa-print text-amber-600 mt-0.5"></i>
                <div className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 font-medium">
                  {language === 'mr'
                    ? 'प्रिंटर टीप: प्रिंट काढताना "Fit to Page" ऐवजी "Actual Size" किंवा "100%" निवडा, ज्यामुळे कार्ड अचूक मापाचे प्रिंट होईल.'
                    : language === 'hi'
                    ? 'प्रिंटर टिप: प्रिंट करते समय "Fit to Page" के बजाय "Actual Size / 100%" चुनें।'
                    : 'Printer Tip: Select "Actual Size" or "100%" scale in your print settings for 100% exact card dimensions.'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSizeInfoModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-md active:scale-98"
            >
              {language === 'mr' ? 'समजले (Close)' : language === 'hi' ? 'समझ गया (Close)' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* Header - Simple, Clear & Trustworthy */}
      <div className="text-center mb-4 sm:mb-5">
        <h1 className="text-xl sm:text-2xl font-[900] text-slate-900 dark:text-white tracking-tight mb-1">
          {t('aadhaarTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mb-2.5">
          {language === 'mr'
            ? '२ फोटो जोडा आणि एका क्लिकमध्ये १००% अचूक मापाचे A4 झेरॉक्स पेज मिळवा'
            : language === 'hi'
            ? '२ फोटो जोड़ें और एक क्लिक में १००% सटीक साइज का A4 ज़ेरॉक्स पेज प्राप्त करें'
            : 'Add 2 photos and get a clean, 100% accurate A4 xerox page in 1 tap'}
        </p>

        {/* 100% Perfect Size Reassurance Badge */}
        <button
          type="button"
          onClick={() => setSizeInfoModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-black hover:bg-emerald-100 transition-colors shadow-2xs max-w-full"
          title="Click to see measurement details"
        >
          <i className="fas fa-circle-check text-emerald-500 shrink-0"></i>
          <span className="truncate">
            {language === 'mr'
              ? '१००% अचूक आधार साईज (85.6 × 54 mm) · माहिती पहा'
              : language === 'hi'
              ? '१००% सटीक आधार साइज (85.6 × 54 mm) · जानकारी देखें'
              : '100% Exact Aadhaar Size (85.6 × 54 mm) · Verify'}
          </span>
          <i className="fas fa-circle-info text-[10px] text-emerald-600/70 shrink-0"></i>
        </button>
      </div>

      {/* STEP 1: ADD PHOTOS OR PDF */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
              1
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {language === 'mr' ? 'फोटो जोडा (Front & Back)' : language === 'hi' ? 'फोटो जोड़ें (Front & Back)' : 'Add Photos'}
            </span>
          </div>

          {/* Quick PDF Import shortcut */}
          <button
            type="button"
            onClick={() => bothPdfInputRef.current?.click()}
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            title="Upload e-Aadhaar PDF file"
          >
            <i className="fas fa-file-pdf text-rose-500"></i>
            <span>{language === 'mr' ? 'किंवा PDF अपलोड करा' : language === 'hi' ? 'या PDF अपलोड करें' : 'Upload Aadhaar PDF'}</span>
          </button>
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
              /* Uploaded State: Thumbnail with Change / Rotate / Crop / Remove */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full aspect-[85.6/54] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-xs group"
                  onClick={() => frontFileInputRef.current?.click()}
                  title="Click to replace"
                >
                  <img src={frontImage} alt="Front" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 w-full pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCropTargetSide('front');
                      setImageToCrop(frontImage);
                      setCropModalOpen(true);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0 py-0.5"
                    title="Crop card edges"
                  >
                    <i className="fas fa-crop-simple text-[10px]"></i>
                    <span>Crop</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => handleQuickRotate('front')}
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 font-bold flex items-center gap-0.5 shrink-0 py-0.5"
                    title="Rotate 90°"
                  >
                    <i className="fas fa-rotate-right text-[10px]"></i>
                    <span>90°</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => frontFileInputRef.current?.click()}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 py-0.5"
                  >
                    {language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => setFrontImage(null)}
                    className="text-rose-500 hover:text-rose-600 shrink-0 py-0.5"
                    title="Remove"
                  >
                    <i className="fas fa-trash-can text-[10px]"></i>
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
                  <span>{language === 'mr' ? 'गॅलरी / फाईल' : language === 'hi' ? 'गैलरी / फ़ाइल' : 'Gallery'}</span>
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
              /* Uploaded State: Thumbnail with Change / Rotate / Crop / Remove */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full aspect-[85.6/54] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-xs group"
                  onClick={() => backFileInputRef.current?.click()}
                  title="Click to replace"
                >
                  <img src={backImage} alt="Back" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 w-full pt-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCropTargetSide('back');
                      setImageToCrop(backImage);
                      setCropModalOpen(true);
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0 py-0.5"
                    title="Crop card edges"
                  >
                    <i className="fas fa-crop-simple text-[10px]"></i>
                    <span>Crop</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => handleQuickRotate('back')}
                    className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 font-bold flex items-center gap-0.5 shrink-0 py-0.5"
                    title="Rotate 90°"
                  >
                    <i className="fas fa-rotate-right text-[10px]"></i>
                    <span>90°</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => backFileInputRef.current?.click()}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 py-0.5"
                  >
                    {language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={() => setBackImage(null)}
                    className="text-rose-500 hover:text-rose-600 shrink-0 py-0.5"
                    title="Remove"
                  >
                    <i className="fas fa-trash-can text-[10px]"></i>
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
                  <span>{language === 'mr' ? 'गॅलरी / फाईल' : language === 'hi' ? 'गैलरी / फ़ाइल' : 'Gallery'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STEP 2: CHOOSE PRINT SIZE (PULLED OUT OF MORE OPTIONS FOR NORMAL USERS) */}
      <div className="mb-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
              2
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {language === 'mr' ? 'प्रिंट साईज निवडा' : language === 'hi' ? 'प्रिंट साइज चुनें' : 'Choose Print Size'}
            </span>
          </div>

          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <i className="fas fa-shield-check"></i>
            <span>{language === 'mr' ? '१००% अचूक माप' : language === 'hi' ? '१००% सटीक माप' : 'Accurate Scale'}</span>
          </span>
        </div>

        {/* 3 Prominent Size Cards */}
        <div className="grid grid-cols-3 gap-2">
          {/* Preset 1: Standard Aadhaar (Recommended) */}
          <button
            type="button"
            onClick={() => handleApplyPreset('standard')}
            className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative ${
              activePreset === 'standard'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] sm:text-xs font-black flex items-center gap-1 ${
                activePreset === 'standard' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'
              }`}>
                <i className="fas fa-id-card text-blue-500 text-[10px]"></i>
                <span className="truncate">{language === 'mr' ? 'मूळ आधार' : language === 'hi' ? 'मूल आधार' : 'Standard'}</span>
              </span>
              {activePreset === 'standard' && (
                <i className="fas fa-check-circle text-blue-600 text-xs shrink-0"></i>
              )}
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
              85.6 × 54 mm
            </div>
            <div className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">
              {language === 'mr' ? 'पाकीट / लॅमिनेशन' : language === 'hi' ? 'वॉलेट / लेमिनेशन' : 'Wallet / PVC'}
            </div>
          </button>

          {/* Preset 2: Large Xerox */}
          <button
            type="button"
            onClick={() => handleApplyPreset('large')}
            className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative ${
              activePreset === 'large'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] sm:text-xs font-black flex items-center gap-1 ${
                activePreset === 'large' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'
              }`}>
                <i className="fas fa-expand text-indigo-500 text-[10px]"></i>
                <span className="truncate">{language === 'mr' ? 'मोठी झेरॉक्स' : language === 'hi' ? 'बड़ी ज़ेरॉक्स' : 'Large Xerox'}</span>
              </span>
              {activePreset === 'large' && (
                <i className="fas fa-check-circle text-blue-600 text-xs shrink-0"></i>
              )}
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
              110 × 69.4 mm
            </div>
            <div className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">
              {language === 'mr' ? 'स्पष्ट वाचण्यासाठी' : language === 'hi' ? 'स्पष्ट पढ़ने के लिए' : 'Easy to read'}
            </div>
          </button>

          {/* Preset 3: Fit Width */}
          <button
            type="button"
            onClick={() => handleApplyPreset('fitWidth')}
            className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all relative ${
              activePreset === 'fitWidth'
                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] sm:text-xs font-black flex items-center gap-1 ${
                activePreset === 'fitWidth' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'
              }`}>
                <i className="fas fa-arrows-left-right text-emerald-500 text-[10px]"></i>
                <span className="truncate">{language === 'mr' ? 'मोठे पान' : language === 'hi' ? 'बड़ा पेज' : 'Fit Width'}</span>
              </span>
              {activePreset === 'fitWidth' && (
                <i className="fas fa-check-circle text-blue-600 text-xs shrink-0"></i>
              )}
            </div>
            <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400">
              190 mm
            </div>
            <div className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">
              {language === 'mr' ? 'पूर्ण A4 रुंदी' : language === 'hi' ? 'पूरी A4 चौड़ाई' : 'Full Page Width'}
            </div>
          </button>
        </div>
      </div>

      {/* STEP 3: QUICK LAYOUT ACTIONS & LIVE A4 PREVIEW */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2 px-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
              3
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
              {language === 'mr' ? 'A4 प्रिंट मांडणी व पूर्वावलोकन' : language === 'hi' ? 'A4 प्रिंट लेआउट व पूर्वावलोकन' : 'A4 Layout & Preview'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs disabled:opacity-30"
              title="Undo"
            >
              <i className="fas fa-rotate-left"></i>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs disabled:opacity-30"
              title="Redo"
            >
              <i className="fas fa-rotate-right"></i>
            </button>
            <button
              type="button"
              onClick={handleResetLayout}
              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[10px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1"
              title="Reset layout to standard"
            >
              <i className="fas fa-arrow-rotate-left text-blue-500"></i>
              <span>{language === 'mr' ? 'पूर्ववत' : language === 'hi' ? 'रीसेट' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* QUICK ACTION BAR (PULLED OUT OF MORE OPTIONS!) */}
        <div className="mb-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 sm:p-2 flex flex-wrap items-center gap-1.5 sm:gap-2 shadow-2xs w-full">
          {/* 1. Stack 1-over-1 Xerox Arrangement */}
          <button
            type="button"
            onClick={handleStackVertically}
            className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 text-[11px] font-bold flex items-center gap-1.5 flex-1 min-w-[125px] sm:min-w-0 sm:flex-initial justify-center transition-colors shrink-0"
            title="Arrange Front top and Back bottom"
          >
            <i className="fas fa-table-columns rotate-90 text-blue-500 text-[10px] shrink-0"></i>
            <span className="truncate">{language === 'mr' ? 'एकाखाली एक मांडणी' : language === 'hi' ? 'एक के ऊपर एक' : 'Stack 1-Over-1'}</span>
          </button>

          {/* 2. Rotate 90 degrees */}
          <button
            type="button"
            onClick={() => handleQuickRotate()}
            className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 text-[11px] font-bold flex items-center gap-1.5 flex-1 min-w-[105px] sm:min-w-0 sm:flex-initial justify-center transition-colors shrink-0"
            title="Rotate photo 90 degrees"
          >
            <i className="fas fa-rotate-right text-indigo-500 text-[10px] shrink-0"></i>
            <span className="truncate">{language === 'mr' ? '९०° फिरवा' : language === 'hi' ? '९०° घुमाएं' : 'Rotate 90°'}</span>
          </button>

          {/* 3. Dashed Cut Guides Toggle */}
          <button
            type="button"
            onClick={handleToggleCutGuides}
            className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 flex-1 min-w-[125px] sm:min-w-0 sm:flex-initial justify-center transition-colors shrink-0 ${
              options.showCutGuides
                ? 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            title="Toggle dashed scissor lines for cutting"
          >
            <i className="fas fa-scissors text-[10px] shrink-0"></i>
            <span className="truncate">{language === 'mr' ? 'कटिंग बॉर्डर' : language === 'hi' ? 'कटिंग बॉर्डर' : 'Cut Border'}: {options.showCutGuides ? 'ON' : 'OFF'}</span>
          </button>

          {/* 4. Labels Toggle */}
          <button
            type="button"
            onClick={handleToggleLabels}
            className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 flex-1 min-w-[105px] sm:min-w-0 sm:flex-initial justify-center transition-colors shrink-0 ${
              options.showLabels
                ? 'bg-indigo-100/70 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            title="Toggle card names"
          >
            <i className="fas fa-tag text-[10px] shrink-0"></i>
            <span className="truncate">{language === 'mr' ? 'नावे' : language === 'hi' ? 'नाम' : 'Labels'}: {options.showLabels ? 'ON' : 'OFF'}</span>
          </button>
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

        {/* Warning Banner: In normal document flow below preview box, never overlapping */}
        {missingPhotoHint && (
          <div className="mt-3.5 w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-3 text-center text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2 shadow-xs transition-all">
            <i className="fas fa-circle-exclamation text-amber-600 dark:text-amber-400 text-sm shrink-0"></i>
            <span>{missingPhotoHint}</span>
          </div>
        )}
      </div>

      {/* SLIM ACTION BAR UNDER PAGE (WHEN CARD IS SELECTED) */}
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

      {/* DOWNLOAD & EXPORT SECTION (In normal document flow with clean spacing, full-width button, and high-contrast disabled state) */}
      <div className="w-full my-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col gap-3">
        {/* Download Options: Format (PDF vs JPG) & Compress Quality Level */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {/* Format Toggle (PDF vs JPG) */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setDownloadFormat('pdf')}
              className={`py-1.5 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                downloadFormat === 'pdf'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-file-pdf"></i>
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setDownloadFormat('jpg')}
              className={`py-1.5 px-3 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                downloadFormat === 'jpg'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              <i className="fas fa-file-image"></i>
              <span>JPG</span>
            </button>
          </div>

          {/* Quality & Compress Selector */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase hidden xs:inline">
              {language === 'mr' ? 'साईज:' : language === 'hi' ? 'साइज:' : 'Size:'}
            </span>
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px]">
              <button
                type="button"
                onClick={() => setCompressLevel('ultra_compressed')}
                className={`py-1 px-2 rounded-lg font-black flex items-center gap-1 transition-all ${
                  compressLevel === 'ultra_compressed'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Under 100 KB - For MahaDBT, SSC & Online Portals"
              >
                <i className="fas fa-bolt text-[9px] text-amber-600"></i>
                <span>&lt;100 KB</span>
              </button>

              <button
                type="button"
                onClick={() => setCompressLevel('compressed')}
                className={`py-1 px-2.5 rounded-lg font-black flex items-center gap-1 transition-all ${
                  compressLevel === 'compressed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Under 200 KB - For Online Forms / Job Applications"
              >
                <i className="fas fa-compress text-[9px]"></i>
                <span>&lt;200 KB</span>
              </button>

              <button
                type="button"
                onClick={() => setCompressLevel('standard')}
                className={`py-1 px-2.5 rounded-lg font-black transition-all ${
                  compressLevel === 'standard'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="Standard ~400 KB"
              >
                <span>Medium</span>
              </button>

              <button
                type="button"
                onClick={() => setCompressLevel('high')}
                className={`py-1 px-2.5 rounded-lg font-black transition-all ${
                  compressLevel === 'high'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title="300 DPI High Resolution - Best for Xerox / Print"
              >
                <span>300 DPI</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Download Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownload()}
            disabled={!hasBothImages || adState !== 'idle' || state.status === 'processing'}
            className={`flex-1 min-w-[200px] py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 ${
              hasBothImages && adState === 'idle' && state.status !== 'processing'
                ? downloadFormat === 'pdf'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 ring-2 ring-blue-500/20 cursor-pointer'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30 ring-2 ring-emerald-500/20 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed shadow-none'
            }`}
          >
            {adState === 'downloading' || state.status === 'processing' ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                <span>{state.message || 'Downloading...'}</span>
              </>
            ) : (
              <>
                <i className={`fas ${downloadFormat === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'} text-sm`}></i>
                <span>
                  {downloadFormat === 'pdf'
                    ? language === 'mr'
                      ? 'A4 PDF डाऊनलोड करा'
                      : language === 'hi'
                      ? 'A4 PDF डाउनलोड करें'
                      : 'Download A4 PDF'
                    : language === 'mr'
                    ? 'A4 JPG डाऊनलोड करा'
                    : language === 'hi'
                    ? 'A4 JPG डाउनलोड करें'
                    : 'Download A4 JPG'}
                </span>
                <span className="text-[10px] font-mono opacity-85 bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                  {compressLevel === 'ultra_compressed'
                    ? '<100 KB'
                    : compressLevel === 'compressed'
                    ? '<200 KB'
                    : compressLevel === 'standard'
                    ? '~400 KB'
                    : '300 DPI'}
                </span>
              </>
            )}
          </button>

          {/* Dedicated Compress Button right next to Download */}
          <button
            type="button"
            onClick={handleOpenCompressModal}
            disabled={!hasBothImages || adState !== 'idle' || state.status === 'processing'}
            className="py-3.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30 shrink-0 cursor-pointer"
            title={
              language === 'mr'
                ? 'फाईल कंप्रेस करा (<100KB, <50KB)'
                : language === 'hi'
                ? 'फाइल कंप्रेस करें (<100KB, <50KB)'
                : 'Compress File (<100KB, <50KB)'
            }
          >
            <i className="fas fa-file-zipper text-sm text-slate-950"></i>
            <span className="font-black hidden xs:inline">
              {language === 'mr' ? 'कंप्रेस' : language === 'hi' ? 'कंप्रेस' : 'Compress'}
            </span>
          </button>

          {/* Quick 1-tap Alternate format button (Download other format instantly) */}
          <button
            type="button"
            onClick={() => handleDownload(downloadFormat === 'pdf' ? 'jpg' : 'pdf')}
            disabled={!hasBothImages || adState !== 'idle' || state.status === 'processing'}
            className="py-3.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs shrink-0"
            title={
              downloadFormat === 'pdf'
                ? 'Download as JPG image instead'
                : 'Download as PDF document instead'
            }
          >
            <i className={`fas ${downloadFormat === 'pdf' ? 'fa-file-image text-emerald-500' : 'fa-file-pdf text-blue-500'}`}></i>
            <span className="hidden xs:inline font-mono">
              {downloadFormat === 'pdf' ? 'JPG' : 'PDF'}
            </span>
          </button>

          {/* Share Button: appears once file is downloaded/ready */}
          {state.status === 'success' && state.resultUrl && (
            <button
              type="button"
              onClick={() =>
                shareFileViaAndroidBridge(
                  state.resultUrl!,
                  state.resultFileName || 'Aadhaar_A4.pdf'
                )
              }
              className="py-3.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30 animate-in zoom-in duration-300 cursor-pointer shrink-0"
              title="Share file via Android Bridge"
            >
              <i className="fas fa-share-nodes text-sm"></i>
              <span className="font-bold">
                {language === 'mr' ? 'शेअर करा' : language === 'hi' ? 'शेयर करें' : 'Share'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* DEDICATED DOWNLOAD SUCCESS / COMPLETED AREA WITH SEPARATED AD */}
      {hasDownloaded && state.status === 'success' && state.resultUrl && (
        <div className="w-full bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 shadow-sm mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              <i className="fas fa-check"></i>
            </div>
            <div className="min-w-0">
              <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {language === 'mr' ? 'डाऊनलोड पूर्ण झाले!' : language === 'hi' ? 'डाउनलोड पूरा हुआ!' : 'Download Complete!'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono truncate max-w-[240px] sm:max-w-md">
                {state.resultFileName || 'Aadhaar_A4.pdf'}
              </p>
            </div>
          </div>

          {/* Action buttons (Share, Save Again, & Compress File) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                shareFileViaAndroidBridge(
                  state.resultUrl!,
                  state.resultFileName || 'Aadhaar_A4.pdf'
                )
              }
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <i className="fas fa-share-nodes"></i>
              <span>{language === 'mr' ? 'शेअर करा' : language === 'hi' ? 'शेयर करें' : 'Share File'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                triggerBrowserDownload(
                  state.resultUrl!,
                  state.resultFileName || 'Aadhaar_A4.pdf'
                )
              }
              className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-black text-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <i className="fas fa-download"></i>
              <span>{language === 'mr' ? 'पुन्हा सेव्ह करा' : language === 'hi' ? 'पुनः सेव करें' : 'Save Again'}</span>
            </button>

            {/* Quick Compress Button right inside Download Complete */}
            <button
              type="button"
              onClick={() => setQuickCompressModalOpen(true)}
              className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 transition-all active:scale-95 shadow-xs ring-1 ring-amber-400 cursor-pointer"
            >
              <i className="fas fa-file-zipper"></i>
              <span>{language === 'mr' ? 'कंप्रेस करा (<100KB)' : language === 'hi' ? 'कंप्रेस करें (<100KB)' : 'Compress File (<100KB)'}</span>
            </button>
          </div>

          {/* Clearly Separated Advertisement Area */}
          <DownloadSuccessAdArea downloadKey={state.resultFileName} />
        </div>
      )}

      {/* Quick Compress Modal */}
      {quickCompressModalOpen && (
        <QuickCompressModal
          isOpen={quickCompressModalOpen}
          onClose={() => setQuickCompressModalOpen(false)}
          sourceFile={state.resultUrl || frontImage}
          sourceFileName={state.resultFileName || (downloadFormat === 'pdf' ? 'Aadhaar_A4.pdf' : 'Aadhaar_A4.jpg')}
          isPdf={downloadFormat === 'pdf'}
        />
      )}

      {/* COLLAPSED "ADVANCED FINE-TUNING" ACCORDION */}
      <div className="mb-4 flex justify-center">
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
    </div>
  );
};

export default IDCardMerge;
