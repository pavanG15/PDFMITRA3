import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessingState } from '../types';
import { useLanguage } from '../i18n';
import {
  shareFileViaAndroidBridge,
  executeDownloadWithAd,
  saveFileViaWebViewOrBrowser,
  hideBannerAd,
} from '../utils/shareHelper';
import {
  IDCardFilterType,
  autoPrepareLandscapeCR80,
  applyIdCardFilter,
} from '../utils/idCardImageProcessor';
import DownloadSuccessAdArea from '../components/DownloadSuccessAdArea';
import QuickCompressModal from '../components/QuickCompressModal';
import A4CanvaEditor from '../components/A4CanvaEditor';
import SlimCardToolbar from '../components/SlimCardToolbar';
import MoreOptionsAccordion from '../components/MoreOptionsAccordion';
import CameraModal from '../components/CameraModal';
import CardCropModal from '../components/CardCropModal';
import {
  CardLayoutType,
  CardLayoutArrangement,
  EditableCardState,
  CanvasEditorViewOptions,
  getArrangedCardStates,
  loadSavedCardLayout,
  saveCardLayoutToStorage,
  DEFAULT_VIEW_OPTIONS,
  renderCardForPdf,
  renderA4PageToJpg,
  createBilingualLabelImage,
} from '../cardLayoutConfig';

const IDCardMerge: React.FC = () => {
  const { t, language } = useLanguage();

  // Load saved layout & options from localStorage (safe try/catch)
  const initialData = useRef(loadSavedCardLayout('fitWidth')).current;

  const [cards, setCards] = useState<Record<'front' | 'back', EditableCardState>>(() => {
    if (initialData.preset === 'fitWidth' && initialData.cards) {
      return initialData.cards;
    }
    return getArrangedCardStates('fitWidth', 'vertical');
  });
  const [activePreset, setActivePreset] = useState<CardLayoutType | 'custom' | 'fitWidth'>('fitWidth');
  const [layoutArrangement, setLayoutArrangement] = useState<CardLayoutArrangement>('vertical');
  const [options, setOptions] = useState<CanvasEditorViewOptions>(() => ({
    ...initialData.options,
    showCutGuides: false,
    showLabels: false,
  }));

  // Selected card for editing ('front' | 'back' | null)
  const [selectedCardId, setSelectedCardId] = useState<'front' | 'back' | null>(null);

  // Download Options: Format (PDF vs JPG) & Compression / Quality Level (default 300 DPI)
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'jpg'>('pdf');
  const [compressLevel, setCompressLevel] = useState<'high' | 'standard' | 'compressed' | 'ultra_compressed'>('high');
  const [quickCompressModalOpen, setQuickCompressModalOpen] = useState<boolean>(false);
  const [adState, setAdState] = useState<'idle' | 'downloading'>('idle');
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);
  const latestResultBlobRef = useRef<{ blob: Blob; mimeType: string; fileName: string } | null>(null);

  // History Stacks
  const [undoStack, setUndoStack] = useState<Array<Record<'front' | 'back', EditableCardState>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Record<'front' | 'back', EditableCardState>>>([]);

  // Source images (for non-destructive Re-crop / Edit), Raw cropped (before print filters), Display images & Active Filters
  const [sourceFrontImage, setSourceFrontImage] = useState<string | null>(null);
  const [sourceBackImage, setSourceBackImage] = useState<string | null>(null);
  const [rawFrontCropped, setRawFrontCropped] = useState<string | null>(null);
  const [rawBackCropped, setRawBackCropped] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontFilter, setFrontFilter] = useState<IDCardFilterType>('original');
  const [backFilter, setBackFilter] = useState<IDCardFilterType>('original');
  const [isApplyingFilter, setIsApplyingFilter] = useState<'front' | 'back' | null>(null);

  const frontFilterRef = useRef<IDCardFilterType>('original');
  const backFilterRef = useRef<IDCardFilterType>('original');
  const layoutArrangementRef = useRef<CardLayoutArrangement>('vertical');
  const activePresetRef = useRef<CardLayoutType | 'custom' | 'fitWidth'>('fitWidth');

  useEffect(() => {
    frontFilterRef.current = frontFilter;
  }, [frontFilter]);

  useEffect(() => {
    backFilterRef.current = backFilter;
  }, [backFilter]);

  useEffect(() => {
    layoutArrangementRef.current = layoutArrangement;
  }, [layoutArrangement]);

  useEffect(() => {
    activePresetRef.current = activePreset;
  }, [activePreset]);

  // Track if user manually adjusted layout
  const userHasCustomizedRef = useRef<boolean>(false);

  // Clear any existing bottom screen banner ad on entering ID Card Merge
  useEffect(() => {
    hideBannerAd();
  }, []);

  // Camera modal state
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [cameraTargetSide, setCameraTargetSide] = useState<'front' | 'back'>('front');

  // Manual 4-corner crop fine-tuning modal state
  const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTargetSide, setCropTargetSide] = useState<'front' | 'back'>('front');

  // Global callback for native Android ID card camera bridge:
  // window.onIdCardPhotoCaptured(side, dataUrl, isAutoCropped = false)
  // - If isAutoCropped === true: bypasses crop modal, auto-rotates to landscape, prepares CR80 (85.6x54mm), places on A4.
  // - If isAutoCropped === false (or omitted): opens 4-Corner Perspective Cropper without changing tabs.
  useEffect(() => {
    const handleIdCardPhoto = async (
      side: 'front' | 'back' | string,
      dataUrl: string,
      isAutoCropped: boolean = false
    ) => {
      console.log('[IDCardMerge] onIdCardPhotoCaptured received:', { side, isAutoCropped });
      if (!dataUrl) return;
      const targetSide: 'front' | 'back' = side === 'back' ? 'back' : 'front';
      const formattedDataUrl = dataUrl.startsWith('data:')
        ? dataUrl
        : `data:image/jpeg;base64,${dataUrl}`;

      setCameraModalOpen(false);

      if (targetSide === 'front') {
        setSourceFrontImage(formattedDataUrl);
      } else {
        setSourceBackImage(formattedDataUrl);
      }

      if (isAutoCropped === true) {
        try {
          const preparedCR80 = await autoPrepareLandscapeCR80(formattedDataUrl);
          const sideFilter = targetSide === 'front' ? frontFilterRef.current : backFilterRef.current;
          const displayImg = await applyIdCardFilter(preparedCR80, sideFilter);

          if (targetSide === 'front') {
            setRawFrontCropped(preparedCR80);
            setFrontImage(displayImg);
            setSelectedCardId('front');
          } else {
            setRawBackCropped(preparedCR80);
            setBackImage(displayImg);
            setSelectedCardId('back');
          }

          setCropModalOpen(false);
          setImageToCrop(null);

          if (!userHasCustomizedRef.current) {
            const presetArg: CardLayoutType | 'fitWidth' =
              activePresetRef.current === 'large'
                ? 'large'
                : activePresetRef.current === 'fitWidth'
                ? 'fitWidth'
                : 'standard';
            const arranged = getArrangedCardStates(presetArg, layoutArrangementRef.current);
            setCards(arranged);
          }
        } catch (err) {
          console.error('[IDCardMerge] Auto-placement failed, falling back to manual crop:', err);
          setCropTargetSide(targetSide);
          setImageToCrop(formattedDataUrl);
          setCropModalOpen(true);
        }
        return;
      }

      setCropTargetSide(targetSide);
      setImageToCrop(formattedDataUrl);
      setCropModalOpen(true);
    };

    (window as any).onIdCardPhotoCaptured = handleIdCardPhoto;

    return () => {
      if ((window as any).onIdCardPhotoCaptured === handleIdCardPhoto) {
        delete (window as any).onIdCardPhotoCaptured;
      }
    };
  }, []);

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
    saveCardLayoutToStorage(cards, options, activePreset);
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

  // Reset to default layout (Fit Width, Cut Border OFF, Labels OFF)
  const handleResetLayout = () => {
    pushToUndo(cards);
    userHasCustomizedRef.current = false;
    const defaults = getArrangedCardStates('fitWidth', layoutArrangement);
    setCards(defaults);
    setActivePreset('fitWidth');
    setSelectedCardId(null);
    setOptions(DEFAULT_VIEW_OPTIONS);
    saveCardLayoutToStorage(defaults, DEFAULT_VIEW_OPTIONS, 'fitWidth');
  };

  // Switch between Vertical Stacked and Side-by-Side centered A4 arrangement
  const handleSetLayoutArrangement = (nextArrangement: CardLayoutArrangement) => {
    pushToUndo(cards);
    setLayoutArrangement(nextArrangement);
    const presetArg: CardLayoutType | 'fitWidth' =
      activePreset === 'large'
        ? 'large'
        : activePreset === 'fitWidth'
        ? 'fitWidth'
        : 'standard';
    const arranged = getArrangedCardStates(presetArg, nextArrangement);
    setCards(arranged);
  };

  // Apply Presets
  const handleApplyPreset = (preset: CardLayoutType | 'fitWidth') => {
    pushToUndo(cards);
    setActivePreset(preset);
    const arranged = getArrangedCardStates(preset, layoutArrangement);
    setCards(arranged);
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
        setSourceFrontImage(p1);
        setSourceBackImage(p2);
        setRawFrontCropped(p1);
        setRawBackCropped(p2);
        setFrontImage(await applyIdCardFilter(p1, frontFilter));
        setBackImage(await applyIdCardFilter(p2, backFilter));
        setSelectedCardId('front');
        const presetArg: CardLayoutType | 'fitWidth' =
          activePreset === 'large' ? 'large' : activePreset === 'fitWidth' ? 'fitWidth' : 'standard';
        setCards(getArrangedCardStates(presetArg, layoutArrangement));
      } else if (pdf.numPages === 1) {
        const p1 = await renderPage(1);
        setSourceFrontImage(p1);
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

  // File Upload Handlers (supports Images & PDFs) -> always opens 4-Corner Perspective Cropper
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
            if (side === 'front') setSourceFrontImage(dataUrl);
            else setSourceBackImage(dataUrl);
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
      if (side === 'front') setSourceFrontImage(raw);
      else setSourceBackImage(raw);
      setCropTargetSide(side);
      setImageToCrop(raw);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
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

    // 1. First check if dedicated Android native ID camera bridge exists:
    // Support window.Android?.openIdCardCamera, window.AndroidBridge?.openIdCardCamera, window.AndroidScanner?.openIdCardCamera
    const win = window as any;
    const hasNativeIdBridge =
      (win.Android && typeof win.Android.openIdCardCamera === 'function') ||
      (win.AndroidBridge && typeof win.AndroidBridge.openIdCardCamera === 'function') ||
      (win.AndroidScanner && typeof win.AndroidScanner.openIdCardCamera === 'function');

    if (hasNativeIdBridge) {
      try {
        console.log(`[IDCardMerge] Invoking dedicated native ID card camera bridge for ${side}`);
        if (win.Android && typeof win.Android.openIdCardCamera === 'function') {
          win.Android.openIdCardCamera(side);
        } else if (win.AndroidBridge && typeof win.AndroidBridge.openIdCardCamera === 'function') {
          win.AndroidBridge.openIdCardCamera(side);
        } else if (win.AndroidScanner && typeof win.AndroidScanner.openIdCardCamera === 'function') {
          win.AndroidScanner.openIdCardCamera(side);
        }
        // CRITICAL: DO NOT open CameraModal and DO NOT start navigator.mediaDevices.getUserMedia
        // to prevent camera lock conflicts with the native camera activity.
        return;
      } catch (err) {
        console.warn('Native ID camera bridge call failed, falling back to in-app camera:', err);
      }
    }

    // 2. Normal browser (no native bridge): open in-app CameraModal with green ID-1 frame
    setCameraModalOpen(true);
  };

  const handleCameraCapture = (dataUrl: string) => {
    if (cameraTargetSide === 'front') setSourceFrontImage(dataUrl);
    else setSourceBackImage(dataUrl);
    setCropTargetSide(cameraTargetSide);
    setImageToCrop(dataUrl);
    setCropModalOpen(true);
  };

  const handleCropDone = async (croppedDataUrl: string) => {
    const activeFilter = cropTargetSide === 'front' ? frontFilter : backFilter;
    const filteredDataUrl = await applyIdCardFilter(croppedDataUrl, activeFilter);

    let nextFront = frontImage;
    let nextBack = backImage;

    if (cropTargetSide === 'front') {
      nextFront = filteredDataUrl;
      setRawFrontCropped(croppedDataUrl);
      setFrontImage(filteredDataUrl);
      setSelectedCardId('front');
    } else {
      nextBack = filteredDataUrl;
      setRawBackCropped(croppedDataUrl);
      setBackImage(filteredDataUrl);
      setSelectedCardId('back');
    }
    setCropModalOpen(false);
    setImageToCrop(null);

    // Auto-place cleanly in CR80 85.6 x 54 mm (or selected preset + arrangement)
    if (nextFront && nextBack && !userHasCustomizedRef.current) {
      const presetArg: CardLayoutType | 'fitWidth' =
        activePreset === 'large'
          ? 'large'
          : activePreset === 'fitWidth'
          ? 'fitWidth'
          : 'standard';
      const arranged = getArrangedCardStates(presetArg, layoutArrangement);
      setCards(arranged);
    }
  };

  // Non-destructive One-Tap Print Filter switcher (always recomputes from rawFrontCropped / rawBackCropped)
  const handleApplyFilter = async (side: 'front' | 'back', nextFilter: IDCardFilterType) => {
    const raw = side === 'front' ? rawFrontCropped || frontImage : rawBackCropped || backImage;
    if (side === 'front') {
      setFrontFilter(nextFilter);
    } else {
      setBackFilter(nextFilter);
    }
    if (!raw) return;

    setIsApplyingFilter(side);
    try {
      const filtered = await applyIdCardFilter(raw, nextFilter);
      if (side === 'front') setFrontImage(filtered);
      else setBackImage(filtered);
    } finally {
      setIsApplyingFilter(null);
    }
  };

  const handleOpenRecrop = (side: 'front' | 'back') => {
    const rawSrc =
      side === 'front'
        ? sourceFrontImage || rawFrontCropped || frontImage
        : sourceBackImage || rawBackCropped || backImage;
    if (!rawSrc) return;
    setCropTargetSide(side);
    setImageToCrop(rawSrc);
    setCropModalOpen(true);
  };

  const handleRemoveImage = (side: 'front' | 'back') => {
    if (side === 'front') {
      setFrontImage(null);
      setRawFrontCropped(null);
      setSourceFrontImage(null);
      setFrontFilter('original');
    } else {
      setBackImage(null);
      setRawBackCropped(null);
      setSourceBackImage(null);
      setBackFilter('original');
    }
    if (selectedCardId === side) setSelectedCardId(null);
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

        // Thin 0.5px Light Gray Cut Border + Corner Cut Marks
        if (options.showCutGuides) {
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.18);

          if (renderResult.corners && renderResult.corners.length === 4) {
            const [p1, p2, p3, p4] = renderResult.corners;
            doc.line(p1.x, p1.y, p2.x, p2.y);
            doc.line(p2.x, p2.y, p3.x, p3.y);
            doc.line(p3.x, p3.y, p4.x, p4.y);
            doc.line(p4.x, p4.y, p1.x, p1.y);

            // L-shaped corner cut tick marks (3mm arm length) along rotated edges
            const drawCornerTicks = (origin: { x: number; y: number }, adjA: { x: number; y: number }, adjB: { x: number; y: number }) => {
              const arm = 3.0;
              const lenA = Math.hypot(adjA.x - origin.x, adjA.y - origin.y) || 1;
              const lenB = Math.hypot(adjB.x - origin.x, adjB.y - origin.y) || 1;
              doc.line(origin.x, origin.y, origin.x + ((adjA.x - origin.x) / lenA) * arm, origin.y + ((adjA.y - origin.y) / lenA) * arm);
              doc.line(origin.x, origin.y, origin.x + ((adjB.x - origin.x) / lenB) * arm, origin.y + ((adjB.y - origin.y) / lenB) * arm);
            };
            doc.setDrawColor(100, 116, 139);
            doc.setLineWidth(0.28);
            drawCornerTicks(p1, p2, p4);
            drawCornerTicks(p2, p1, p3);
            drawCornerTicks(p3, p2, p4);
            drawCornerTicks(p4, p3, p1);
          } else {
            doc.rect(card.x, card.y, card.width, card.height);
          }
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

      // Output PDF as blob URL (compatible with Android WebViews via Base64 bridge + browser fallback)
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

      latestResultBlobRef.current = { blob, mimeType: 'application/pdf', fileName };

      setState({
        status: 'success',
        progress: 100,
        resultUrl: url,
        resultFileName: fileName,
      });

      await saveFileViaWebViewOrBrowser(url, fileName, {
        blob,
        mimeType: 'application/pdf',
      });
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

  // High-Quality A4 JPG Image Generator (300 DPI for High preset)
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
          : '_300DPI';
      const fileName = `Aadhaar_A4_${
        activePreset === 'standard'
          ? 'Standard_85x54mm'
          : activePreset === 'large'
          ? 'Large_110x69mm'
          : 'Custom'
      }${sizeSuffix}.jpg`;

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      latestResultBlobRef.current = { blob, mimeType: 'image/jpeg', fileName };

      setState({
        status: 'success',
        progress: 100,
        resultUrl: dataUrl,
        resultFileName: fileName,
      });

      await saveFileViaWebViewOrBrowser(dataUrl, fileName, {
        blob,
        mimeType: 'image/jpeg',
      });
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

  // Helper to render Download & Export card (both directly below Choose Print Size and at the bottom)
  const renderDownloadActionCard = (isElevated: boolean = false) => (
    <div
      className={`w-full ${isElevated ? 'mb-5' : 'my-4'} bg-white dark:bg-slate-900 border ${
        isElevated
          ? 'border-blue-500/40 dark:border-blue-500/40 shadow-sm ring-1 ring-blue-500/20'
          : 'border-slate-200/90 dark:border-slate-800/90 shadow-xs'
      } rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5 transition-all`}
    >
      {/* Top Header on Elevated Card */}
      {isElevated && (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">
              <i className="fas fa-download text-[9px]"></i>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {language === 'mr' ? 'डाऊनलोड पर्याय' : language === 'hi' ? 'डाउनलोड विकल्प' : 'Download & Export'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <i className="fas fa-circle-check text-[9px]"></i>
            <span>{language === 'mr' ? '३०० DPI प्रिंट रेडी' : language === 'hi' ? '३०० DPI प्रिंट रेडी' : '300 DPI Ready'}</span>
          </span>
        </div>
      )}

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
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
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
              <span>
                {adState === 'downloading'
                  ? 'Saving...'
                  : state.message || 'Saving...'}
              </span>
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
          onClick={(e) => {
            e.stopPropagation();
            handleOpenCompressModal();
          }}
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
          onClick={(e) => {
            e.stopPropagation();
            handleDownload(downloadFormat === 'pdf' ? 'jpg' : 'pdf');
          }}
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
            onClick={(e) => {
              e.stopPropagation();
              shareFileViaAndroidBridge(
                state.resultUrl!,
                state.resultFileName || 'Aadhaar_A4.pdf'
              );
            }}
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

      {hasDownloaded && (
        <DownloadSuccessAdArea
          downloadKey={state.resultFileName || 'Aadhaar_A4'}
          className="mt-1"
        />
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-28 transition-colors duration-300">
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

      {/* Manual 4-Corner Perspective Crop Modal */}
      <CardCropModal
        isOpen={cropModalOpen}
        imageSrc={imageToCrop}
        onClose={() => {
          setCameraModalOpen(false);
          setCropModalOpen(false);
          setImageToCrop(null);
        }}
        onCropDone={handleCropDone}
        sideTitle={cropTargetSide === 'front' ? t('frontSide') : t('backSide')}
        onEnsureCameraStopped={() => setCameraModalOpen(false)}
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
              /* Uploaded State: Thumbnail, Re-crop / Edit, Print Filter Controls */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full aspect-[85.6/54] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-xs group relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenRecrop('front');
                  }}
                  title="Tap to Re-crop / Edit corners"
                >
                  <img src={frontImage} alt="Front" className="w-full h-full object-contain" />
                  {isApplyingFilter === 'front' && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white text-xs">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  )}
                </div>

                {/* One-Tap Print Enhancement Filter Segmented Bar */}
                <div className="w-full grid grid-cols-3 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyFilter('front', 'original');
                    }}
                    className={`min-h-[28px] px-1 rounded-md text-[10px] font-bold transition-all ${
                      frontFilter === 'original'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'mr' ? 'मूळ' : language === 'hi' ? 'मूल' : 'Original'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyFilter('front', 'magic_color');
                    }}
                    className={`min-h-[28px] px-1 rounded-md text-[10px] font-bold transition-all ${
                      frontFilter === 'magic_color'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'mr' ? 'मॅजिक' : language === 'hi' ? 'मैजिक' : 'Magic'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyFilter('front', 'xerox_bw');
                    }}
                    className={`min-h-[28px] px-1 rounded-md text-[10px] font-bold transition-all ${
                      frontFilter === 'xerox_bw'
                        ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'mr' ? 'झेरॉक्स B&W' : language === 'hi' ? 'ज़ेरॉक्स B&W' : 'Xerox B&W'}
                  </button>
                </div>

                {/* Actions Row: Re-crop / Edit, 90°, Change, Remove */}
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 w-full pt-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRecrop('front');
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0 py-1 px-1"
                    title="Re-crop or adjust 4 corners"
                  >
                    <i className="fas fa-crop-simple text-[10px]"></i>
                    <span>{language === 'mr' ? 'री-क्रॉप' : language === 'hi' ? 'री-क्रॉप' : 'Re-crop / Edit'}</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickRotate('front');
                    }}
                    className="text-slate-600 dark:text-slate-300 hover:text-blue-600 font-bold flex items-center gap-0.5 shrink-0 py-1"
                    title="Rotate 90°"
                  >
                    <i className="fas fa-rotate-right text-[10px]"></i>
                    <span>90°</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      frontFileInputRef.current?.click();
                    }}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 py-1"
                  >
                    {language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage('front');
                    }}
                    className="text-rose-500 hover:text-rose-600 shrink-0 py-1 px-1"
                    title="Remove"
                  >
                    <i className="fas fa-trash-can text-[10px]"></i>
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State: Large Touch Buttons (Camera & Gallery) */
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCameraForSide('front');
                  }}
                  className="w-full min-h-[44px] py-3 sm:py-3.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-camera text-sm"></i>
                  <span>{language === 'mr' ? 'कॅमेरा' : language === 'hi' ? 'कैमरा' : 'Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    frontFileInputRef.current?.click();
                  }}
                  className="w-full min-h-[44px] py-2.5 sm:py-3 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-folder-open text-xs text-slate-500"></i>
                  <span>{language === 'mr' ? 'गॅलरी / फाईल' : language === 'hi' ? 'गैलरी / फ़ाइल' : 'Gallery'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Back Side */}
          <div className={`bg-white dark:bg-slate-900 border rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col justify-between transition-all ${
            frontImage && !backImage
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 dark:border-indigo-400'
              : 'border-slate-200 dark:border-slate-800'
          }`}>
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
              /* Uploaded State: Thumbnail, Re-crop / Edit, Print Filter Controls */
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-full aspect-[85.6/54] bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer shadow-xs group relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenRecrop('back');
                  }}
                  title="Tap to Re-crop / Edit corners"
                >
                  <img src={backImage} alt="Back" className="w-full h-full object-contain" />
                  {isApplyingFilter === 'back' && (
                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white text-xs">
                      <i className="fas fa-spinner fa-spin"></i>
                    </div>
                  )}
                </div>

                {/* One-Tap Print Enhancement Filter Segmented Bar */}
                <div className="w-full grid grid-cols-3 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyFilter('back', 'original');
                    }}
                    className={`min-h-[28px] px-1 rounded-md text-[10px] font-bold transition-all ${
                      backFilter === 'original'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'mr' ? 'मूळ' : language === 'hi' ? 'मूल' : 'Original'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyFilter('back', 'magic_color');
                    }}
                    className={`min-h-[28px] px-1 rounded-md text-[10px] font-bold transition-all ${
                      backFilter === 'magic_color'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'mr' ? 'मॅजिक' : language === 'hi' ? 'मैजिक' : 'Magic'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyFilter('back', 'xerox_bw');
                    }}
                    className={`min-h-[28px] px-1 rounded-md text-[10px] font-bold transition-all ${
                      backFilter === 'xerox_bw'
                        ? 'bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {language === 'mr' ? 'झेरॉक्स B&W' : language === 'hi' ? 'ज़ेरॉक्स B&W' : 'Xerox B&W'}
                  </button>
                </div>

                {/* Actions Row: Re-crop / Edit, 90°, Change, Remove */}
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 w-full pt-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRecrop('back');
                    }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0 py-1 px-1"
                    title="Re-crop or adjust 4 corners"
                  >
                    <i className="fas fa-crop-simple text-[10px]"></i>
                    <span>{language === 'mr' ? 'री-क्रॉप' : language === 'hi' ? 'री-क्रॉप' : 'Re-crop / Edit'}</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickRotate('back');
                    }}
                    className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 font-bold flex items-center gap-0.5 shrink-0 py-1"
                    title="Rotate 90°"
                  >
                    <i className="fas fa-rotate-right text-[10px]"></i>
                    <span>90°</span>
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      backFileInputRef.current?.click();
                    }}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 py-1"
                  >
                    {language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 select-none">•</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage('back');
                    }}
                    className="text-rose-500 hover:text-rose-600 shrink-0 py-1 px-1"
                    title="Remove"
                  >
                    <i className="fas fa-trash-can text-[10px]"></i>
                  </button>
                </div>
              </div>
            ) : (
              /* Empty State: Seamless Front -> Back CTA + Gallery */
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCameraForSide('back');
                  }}
                  className={`w-full min-h-[44px] py-3 sm:py-3.5 px-2 rounded-xl text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                    frontImage
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  }`}
                >
                  <i className="fas fa-camera text-sm shrink-0"></i>
                  <span className="truncate">
                    {frontImage
                      ? (language === 'mr' ? 'मागील बाजू स्कॅन करा →' : language === 'hi' ? 'पीछे स्कैन करें →' : 'Scan Back Side →')
                      : (language === 'mr' ? 'कॅमेरा' : language === 'hi' ? 'कैमरा' : 'Camera')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    backFileInputRef.current?.click();
                  }}
                  className="w-full min-h-[44px] py-2.5 sm:py-3 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-folder-open text-xs text-slate-500"></i>
                  <span>{language === 'mr' ? 'गॅलरी / फाईल' : language === 'hi' ? 'गैलरी / फ़ाइल' : 'Gallery'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Seamless Front -> Back Banner Prompt when Front is placed & Back is empty */}
        {frontImage && !backImage && (
          <div className="mt-2.5 bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-800/70 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                <i className="fas fa-check"></i>
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {language === 'mr'
                  ? 'समोरची बाजू तयार! आता मागील बाजू स्कॅन करा'
                  : language === 'hi'
                  ? 'आगे का भाग तैयार! अब पीछे का भाग स्कैन करें'
                  : 'Front Side placed! Ready for Back Side'}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openCameraForSide('back');
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shrink-0 shadow-xs active:scale-95 transition-all"
            >
              {language === 'mr' ? 'Scan Back Side →' : language === 'hi' ? 'Scan Back Side →' : 'Scan Back Side →'}
            </button>
          </div>
        )}
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

      {/* ELEVATED QUICK DOWNLOAD & EXPORT SECTION (Directly below Choose Print Size for Best Mobile UX) */}
      {renderDownloadActionCard(true)}

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

        {/* QUICK ACTION BAR: Layout Orientation (Vertical vs Side-by-Side) + Thin Cut Border + Rotate + Labels */}
        <div className="mb-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 sm:p-2 flex flex-wrap items-center gap-1.5 sm:gap-2 shadow-2xs w-full">
          {/* 1. Segmented Layout Arrangement Toggle: Vertical Stacked vs Side-by-Side */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSetLayoutArrangement('vertical');
              }}
              className={`min-h-[34px] py-1 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                layoutArrangement === 'vertical'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="Arrange Front on top, Back below centered on A4"
            >
              <i className="fas fa-table-columns rotate-90 text-[10px]"></i>
              <span>{language === 'mr' ? 'एकाखाली एक' : language === 'hi' ? 'वर्टिकल' : 'Vertical'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSetLayoutArrangement('side-by-side');
              }}
              className={`min-h-[34px] py-1 px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                layoutArrangement === 'side-by-side'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
              title="Arrange Front and Back Side-by-Side centered on A4"
            >
              <i className="fas fa-table-columns text-[10px]"></i>
              <span>{language === 'mr' ? 'शेजारी-शेजारी' : language === 'hi' ? 'साइड-बाय-साइड' : 'Side-by-Side'}</span>
            </button>
          </div>

          {/* 2. Rotate 90 degrees */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickRotate();
            }}
            className="min-h-[36px] py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
            title="Rotate photo 90 degrees"
          >
            <i className="fas fa-rotate-right text-indigo-500 text-[10px] shrink-0"></i>
            <span className="truncate">{language === 'mr' ? '९०° फिरवा' : language === 'hi' ? '९०° घुमाएं' : 'Rotate 90°'}</span>
          </button>

          {/* 3. Thin Cut Border (0.5px + Corner Cut Marks) Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCutGuides();
            }}
            className={`min-h-[36px] py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
              options.showCutGuides
                ? 'bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
            title="Toggle 0.5px thin cut border with corner cut marks"
          >
            <i className="fas fa-scissors text-[10px] shrink-0"></i>
            <span className="truncate">{language === 'mr' ? 'कटिंग बॉर्डर' : language === 'hi' ? 'कटिंग बॉर्डर' : 'Cut Border'}: {options.showCutGuides ? 'ON' : 'OFF'}</span>
          </button>

          {/* 4. Labels Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleLabels();
            }}
            className={`min-h-[36px] py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
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
        <div className="w-full bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-2 sm:p-4 shadow-sm flex flex-col items-center">
          <A4CanvaEditor
            cards={cards}
            frontImage={frontImage}
            backImage={backImage}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
            onUpdateCard={handleUpdateCard}
            options={options}
            onOpenCrop={(side) => handleOpenRecrop(side)}
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
            onOpenCrop={() => handleOpenRecrop(selectedCardId)}
            onRemoveImage={() => handleRemoveImage(selectedCardId)}
            onDeselect={() => setSelectedCardId(null)}
          />
        </div>
      )}

      {/* BOTTOM SYNCHRONIZED DOWNLOAD BAR (Immediate access without scrolling back to top) */}
      {renderDownloadActionCard(false)}

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
              onClick={(e) => {
                e.stopPropagation();
                saveFileViaWebViewOrBrowser(
                  state.resultUrl!,
                  state.resultFileName || 'Aadhaar_A4.pdf',
                  latestResultBlobRef.current
                    ? {
                        blob: latestResultBlobRef.current.blob,
                        mimeType: latestResultBlobRef.current.mimeType,
                      }
                    : undefined
                );
              }}
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
