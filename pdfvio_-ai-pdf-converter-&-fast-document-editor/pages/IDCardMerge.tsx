import React, { useState, useEffect, useRef } from 'react';
import { ProcessingState } from '../types';
import { useLanguage } from '../i18n';
import LiveA4Preview from '../components/LiveA4Preview';
import CameraModal from '../components/CameraModal';

declare const jspdf: any;

const IDCardMerge: React.FC = () => {
  const { t, language } = useLanguage();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [cardLayout, setCardLayout] = useState<'standard' | 'large'>('standard');
  const [addCutGuides, setAddCutGuides] = useState<boolean>(true);
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });

  // Camera modal state
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [cameraTargetSide, setCameraTargetSide] = useState<'front' | 'back'>('front');

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
        if (side === 'front') setFrontImage(event.target?.result as string);
        else setBackImage(event.target?.result as string);
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
    if (cameraTargetSide === 'front') {
      setFrontImage(dataUrl);
    } else {
      setBackImage(dataUrl);
    }
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
      
      const pageWidth = 210;
      const pageHeight = 297;

      // Standard ID card aspect ratio 85.6mm / 53.98mm = ~1.586
      const aspectRatio = 1.586;
      let cardWidth = cardLayout === 'standard' ? 100 : 160;
      let cardHeight = cardWidth / aspectRatio;

      // Calculate vertical centering
      const gap = 16;
      const totalHeight = (cardHeight * 2) + gap;
      const startX = (pageWidth - cardWidth) / 2;
      const startY = Math.max(25, (pageHeight - totalHeight) / 2);

      // Helper to draw cut border
      const drawCutGuide = (x: number, y: number, w: number, h: number) => {
        if (!addCutGuides) return;
        doc.setDrawColor(180, 180, 180);
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(x - 0.5, y - 0.5, w + 1, h + 1);
        doc.setLineDashPattern([], 0);
      };

      // Front card label
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("FRONT SIDE (समोरची बाजू)", startX, startY - 3);

      // Add Front Image
      doc.addImage(frontImage, 'JPEG', startX, startY, cardWidth, cardHeight);
      drawCutGuide(startX, startY, cardWidth, cardHeight);

      // Back card label
      const backY = startY + cardHeight + gap;
      doc.text("BACK SIDE (मागील बाजू)", startX, backY - 3);

      // Add Back Image
      doc.addImage(backImage, 'JPEG', startX, backY, cardWidth, cardHeight);
      drawCutGuide(startX, backY, cardWidth, cardHeight);

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      
      setState({ 
        status: 'success', 
        progress: 100, 
        resultUrl: url, 
        resultFileName: 'Aadhaar_in_One_Page.pdf' 
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
            {t('standardId')}
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
            {t('fullWidth')}
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
                <div className="relative w-full sm:w-44 aspect-[1.586/1] bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <img src={frontImage} alt="Front Aadhaar" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap sm:flex-col gap-2 w-full">
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
                <div className="relative w-full sm:w-44 aspect-[1.586/1] bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <img src={backImage} alt="Back Aadhaar" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap sm:flex-col gap-2 w-full">
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
            <button
              onClick={mergeToPDF}
              disabled={!frontImage || !backImage || state.status === 'processing'}
              className={`w-full py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                frontImage && backImage
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98 shadow-blue-500/25 cursor-pointer'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
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
