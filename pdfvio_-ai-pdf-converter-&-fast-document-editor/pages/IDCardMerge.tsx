import React, { useState, useEffect, useRef } from 'react';
import { ProcessingState } from '../types';
import { useLanguage } from '../i18n';
import LiveA4Preview from '../components/LiveA4Preview';
import CameraModal from '../components/CameraModal';
import CardCropModal from '../components/CardCropModal';
import {
  CardLayoutType,
  CARD_SIZES,
  getA4CardLayout,
  createBilingualLabelImage,
} from '../cardLayoutConfig';

declare const jspdf: any;

const IDCardMerge: React.FC = () => {
  const { t, language } = useLanguage();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [cardLayout, setCardLayout] = useState<CardLayoutType>('standard');
  const [addCutGuides, setAddCutGuides] = useState<boolean>(true);
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });

  // Camera modal state
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [cameraTargetSide, setCameraTargetSide] = useState<'front' | 'back'>('front');

  // Manual crop fine-tuning modal state
  const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTargetSide, setCropTargetSide] = useState<'front' | 'back'>('front');

  // Hidden native file/camera inputs
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const frontCameraInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const backCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${t('brandName')} - ${t('aadhaarTitle')}`;
  }, [language, t]);

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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, side: 'front' | 'back') => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file, side);
    }
  };

  const openCameraForSide = (side: 'front' | 'back') => {
    // If MediaDevices is supported, open the interactive camera modal with guide frame
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setCameraTargetSide(side);
      setCameraModalOpen(true);
    } else {
      // Fallback directly to native camera capture input
      if (side === 'front') {
        frontCameraInputRef.current?.click();
      } else {
        backCameraInputRef.current?.click();
      }
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    // Open fine-tune crop modal with the captured guide-box cropped image
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

  const rotateImage = (side: 'front' | 'back') => {
    const currentImg = side === 'front' ? frontImage : backImage;
    if (!currentImg) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotated = canvas.toDataURL('image/jpeg', 0.95);
        if (side === 'front') setFrontImage(rotated);
        else setBackImage(rotated);
      }
    };
    img.src = currentImg;
  };

  const swapSides = () => {
    const temp = frontImage;
    setFrontImage(backImage);
    setBackImage(temp);
  };

  const mergeToPDF = async () => {
    if (!frontImage || !backImage) return;
    setState({ status: 'processing', progress: 40, message: t('generatingPdf') });

    try {
      const jspdfLib = (window as any).jspdf;
      const jsPDF = jspdfLib?.jsPDF || jspdfLib;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      // Exact shared layout config (ensures PDF and Live Preview never differ)
      const layout = getA4CardLayout(cardLayout);

      // Helper to draw dashed cut border around exact card slot
      const drawCutGuide = (x: number, y: number, w: number, h: number) => {
        if (!addCutGuides) return;
        doc.setDrawColor(160, 174, 192); // light slate gray
        doc.setLineWidth(0.35); // crisp thin cut guide line
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(x, y, w, h);
        doc.setLineDashPattern([], 0);
      };

      // Helper to render image with object-fit: contain inside the designated slot
      const addContainedImage = async (
        imgData: string,
        slotX: number,
        slotY: number,
        slotW: number,
        slotH: number
      ) => {
        const { w, h } = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: slotW, h: slotH });
          img.src = imgData;
        });

        const imgAspect = w / h;
        const slotAspect = slotW / slotH;

        let renderW = slotW;
        let renderH = slotH;

        if (imgAspect > slotAspect) {
          // Wider than slot: constrain width
          renderW = slotW;
          renderH = slotW / imgAspect;
        } else {
          // Taller than slot: constrain height
          renderH = slotH;
          renderW = slotH * imgAspect;
        }

        const posX = slotX + (slotW - renderW) / 2;
        const posY = slotY + (slotH - renderH) / 2;

        doc.addImage(imgData, 'JPEG', posX, posY, renderW, renderH);
      };

      // 1. FRONT SIDE LABEL (Rendered via high-DPI canvas to guarantee 100% Devanagari glyph accuracy)
      const frontLabelImg = createBilingualLabelImage(
        "FRONT SIDE",
        language === 'mr' ? "समोरची बाजू" : language === 'hi' ? "सामने की फोटो" : "FRONT",
        layout.slotWidthMm,
        layout.labelHeightMm
      );
      if (frontLabelImg) {
        doc.addImage(frontLabelImg, 'PNG', layout.startX, layout.frontLabelY, layout.slotWidthMm, layout.labelHeightMm);
      } else {
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("FRONT SIDE", layout.startX, layout.frontLabelY + 3.5);
      }

      // 2. FRONT CARD IMAGE & CUT GUIDE
      await addContainedImage(
        frontImage,
        layout.startX,
        layout.frontSlotY,
        layout.slotWidthMm,
        layout.slotHeightMm
      );
      drawCutGuide(layout.startX, layout.frontSlotY, layout.slotWidthMm, layout.slotHeightMm);

      // 3. BACK SIDE LABEL (Rendered via high-DPI canvas to guarantee 100% Devanagari glyph accuracy)
      const backLabelImg = createBilingualLabelImage(
        "BACK SIDE",
        language === 'mr' ? "मागील बाजू" : language === 'hi' ? "पीछे की फोटो" : "BACK",
        layout.slotWidthMm,
        layout.labelHeightMm
      );
      if (backLabelImg) {
        doc.addImage(backLabelImg, 'PNG', layout.startX, layout.backLabelY, layout.slotWidthMm, layout.labelHeightMm);
      } else {
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text("BACK SIDE", layout.startX, layout.backLabelY + 3.5);
      }

      // 4. BACK CARD IMAGE & CUT GUIDE
      await addContainedImage(
        backImage,
        layout.startX,
        layout.backSlotY,
        layout.slotWidthMm,
        layout.slotHeightMm
      );
      drawCutGuide(layout.startX, layout.backSlotY, layout.slotWidthMm, layout.slotHeightMm);

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      
      setState({ 
        status: 'success', 
        progress: 100, 
        resultUrl: url, 
        resultFileName: `Aadhaar_${cardLayout === 'standard' ? 'Standard_85x54mm' : 'Large_110x69mm'}_in_One_Page.pdf` 
      });
    } catch (err) {
      console.error(err);
      setState({ status: 'error', progress: 0, message: 'Failed to create PDF. Please retry.' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 transition-colors duration-300">
      {/* Hidden Native File and Camera Inputs */}
      <input
        type="file"
        ref={frontFileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile(e.target.files?.[0], 'front')}
      />
      <input
        type="file"
        ref={frontCameraInputRef}
        accept="image/*"
        capture="environment"
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
      <input
        type="file"
        ref={backCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleImageFile(e.target.files?.[0], 'back')}
      />

      {/* Interactive Camera Modal */}
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

      {/* Header - Clean, Focused, Minimal Text */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 mb-2.5">
          <i className="fas fa-id-card"></i>
          <span>{t('aadhaarBadge')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-[900] text-slate-900 dark:text-white tracking-tight mb-2">
          {t('aadhaarTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-300 font-medium max-w-xl mx-auto text-xs sm:text-sm mb-3">
          {t('aadhaarSubtitle')}
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

      {/* Control Presets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('printSize')}
          </span>
          <button
            type="button"
            onClick={() => setCardLayout('standard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              cardLayout === 'standard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('standardId')} (85.6 × 54 mm)
          </button>
          <button
            type="button"
            onClick={() => setCardLayout('large')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              cardLayout === 'large'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('fullWidth')} (110 × 69.4 mm)
          </button>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 select-none">
            <input
              type="checkbox"
              checked={addCutGuides}
              onChange={(e) => setAddCutGuides(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span>{t('dashedCuttingLines')}</span>
          </label>

          {(frontImage || backImage) && (
            <button
              type="button"
              onClick={swapSides}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              title={t('swapSides')}
            >
              <i className="fas fa-arrows-rotate text-blue-500"></i>
              <span>{t('swapSides')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout: Left Controls & Uploads, Right Live A4 Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (Uploads & Action) */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          {/* Card 1: Front Side */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fas fa-address-card"></i> 1. {t('frontSide')}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                {t('frontFormatHint')}
              </span>
            </div>

            {frontImage ? (
              /* Image Uploaded State */
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="relative w-full sm:w-44 aspect-[85.6/54] bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <img src={frontImage} alt="Front Aadhaar" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap sm:flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setCropTargetSide('front');
                      setImageToCrop(frontImage);
                      setCropModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                    title="Crop & Fine-Tune"
                  >
                    <i className="fas fa-crop-simple"></i>
                    <span>{language === 'mr' ? 'क्रॉप करा' : language === 'hi' ? 'क्रॉप करें' : 'Crop'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCameraForSide('front')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                  >
                    <i className="fas fa-camera"></i>
                    <span>{t('cameraBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => frontFileInputRef.current?.click()}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                  >
                    <i className="fas fa-folder-open"></i>
                    <span>{t('uploadBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateImage('front')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                    title={t('rotatePhoto')}
                  >
                    <i className="fas fa-rotate-right"></i>
                    <span>{t('rotatePhoto')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrontImage(null)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                  >
                    <i className="fas fa-trash-alt"></i>
                    <span>{t('removePhoto')}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Not Uploaded: Direct Camera & Upload Buttons */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'front')}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-center bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-400 transition-all flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl mb-3 shadow-sm">
                  <i className="fas fa-address-card"></i>
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-4">
                  {t('frontCardSummary')}
                </p>

                {/* Direct Action Buttons: Camera + Gallery */}
                <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() => openCameraForSide('front')}
                    className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    <i className="fas fa-camera text-sm"></i>
                    <span>{t('cameraBtn')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => frontFileInputRef.current?.click()}
                    className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black text-xs shadow-md active:scale-95 transition-all"
                  >
                    <i className="fas fa-folder-open text-sm"></i>
                    <span>{t('uploadBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Back Side */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <i className="fas fa-qrcode"></i> 2. {t('backSide')}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                {t('backFormatHint')}
              </span>
            </div>

            {backImage ? (
              /* Image Uploaded State */
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="relative w-full sm:w-44 aspect-[85.6/54] bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <img src={backImage} alt="Back Aadhaar" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap sm:flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setCropTargetSide('back');
                      setImageToCrop(backImage);
                      setCropModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                    title="Crop & Fine-Tune"
                  >
                    <i className="fas fa-crop-simple"></i>
                    <span>{language === 'mr' ? 'क्रॉप करा' : language === 'hi' ? 'क्रॉप करें' : 'Crop'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCameraForSide('back')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                  >
                    <i className="fas fa-camera"></i>
                    <span>{t('cameraBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => backFileInputRef.current?.click()}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                  >
                    <i className="fas fa-folder-open"></i>
                    <span>{t('uploadBtn')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateImage('back')}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                    title={t('rotatePhoto')}
                  >
                    <i className="fas fa-rotate-right"></i>
                    <span>{t('rotatePhoto')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackImage(null)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                  >
                    <i className="fas fa-trash-alt"></i>
                    <span>{t('removePhoto')}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Not Uploaded: Direct Camera & Upload Buttons */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, 'back')}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-center bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-400 transition-all flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl mb-3 shadow-sm">
                  <i className="fas fa-qrcode"></i>
                </div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-4">
                  {t('backCardSummary')}
                </p>

                {/* Direct Action Buttons: Camera + Gallery */}
                <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-sm">
                  <button
                    type="button"
                    onClick={() => openCameraForSide('back')}
                    className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                  >
                    <i className="fas fa-camera text-sm"></i>
                    <span>{t('cameraBtn')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => backFileInputRef.current?.click()}
                    className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black text-xs shadow-md active:scale-95 transition-all"
                  >
                    <i className="fas fa-folder-open text-sm"></i>
                    <span>{t('uploadBtn')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Merge Action Button */}
          {state.status !== 'success' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={mergeToPDF}
                disabled={!frontImage || !backImage || state.status === 'processing'}
                className={`w-full py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                  frontImage && backImage
                    ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98 shadow-blue-500/25 cursor-pointer ring-4 ring-blue-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                {state.status === 'processing' ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>{state.message || t('generatingPdf')}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-pdf"></i>
                    <span>{t('mergeActionBtn')}</span>
                  </>
                )}
              </button>

              {(!frontImage || !backImage) && (
                <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <i className="fas fa-info-circle text-blue-500 mr-1.5"></i>
                  {!frontImage && !backImage
                    ? (language === 'mr' ? 'A4 PDF बनवण्यासाठी दोन्ही बाजू (Front आणि Back) फोटो निवडा किंवा कॅमेऱ्याने काढा' : language === 'hi' ? 'A4 PDF बनाने के लिए दोनों तरफ (Front और Back) की फोटो जोड़ें' : 'Please upload or capture both Front and Back sides to merge into A4 PDF')
                    : !frontImage
                    ? (language === 'mr' ? 'कृपया समोरची बाजू (Front Side) फोटो जोडा' : language === 'hi' ? 'कृपया सामने की फोटो (Front Side) जोड़ें' : 'Please add Front Side photo')
                    : (language === 'mr' ? 'कृपया मागील बाजू (Back Side) फोटो जोडा' : language === 'hi' ? 'कृपया पीछे की फोटो (Back Side) जोड़ें' : 'Please add Back Side photo')}
                </p>
              )}
            </div>
          )}

          {/* Clean 1-Line Privacy Assurance */}
          <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-600 dark:text-slate-300 px-2 py-1">
            <i className="fas fa-lock text-emerald-500"></i>
            <span>{t('privacyNotice')}</span>
          </div>

          {/* Success State Notification & Download */}
          {state.status === 'success' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-emerald-500 text-center shadow-xl animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-emerald-500 text-white text-xl rounded-full flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/30">
                <i className="fas fa-check"></i>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">
                {t('successTitle')}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-5">
                {t('successDesc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={state.resultUrl}
                  download={state.resultFileName}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-black text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <i className="fas fa-download"></i> {t('downloadPdf')}
                </a>
                <button
                  onClick={() => {
                    setFrontImage(null);
                    setBackImage(null);
                    setState({ status: 'idle', progress: 0 });
                  }}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 px-6 py-3.5 rounded-xl font-black text-sm transition-all"
                >
                  {t('mergeAnother')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live A4 PDF Print Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 flex flex-col items-center">
          <div className="w-full bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <LiveA4Preview
              frontImage={frontImage}
              backImage={backImage}
              cardLayout={cardLayout}
              addCutGuides={addCutGuides}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDCardMerge;
