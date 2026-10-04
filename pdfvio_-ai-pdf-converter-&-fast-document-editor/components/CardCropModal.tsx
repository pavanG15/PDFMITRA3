import React, { useState, useEffect, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { useLanguage } from '../i18n';

interface CardCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropDone: (croppedDataUrl: string) => void;
  sideTitle: string;
}

const AADHAAR_ASPECT = 85.6 / 54; // ~1.585185 landscape card ratio

export const CardCropModal: React.FC<CardCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropDone,
  sideTitle,
}) => {
  const { language } = useLanguage();
  const [currentImage, setCurrentImage] = useState<string | null>(imageSrc);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isAspectLocked, setIsAspectLocked] = useState<boolean>(true);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    setCurrentImage(imageSrc);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setIsAspectLocked(true);
    setCroppedAreaPixels(null);
  }, [imageSrc, isOpen]);

  // Lock background scroll when crop modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const onCropComplete = useCallback((_croppedArea: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleRotate90 = () => {
    if (!currentImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      const rotatedData = canvas.toDataURL('image/jpeg', 0.95);
      setCurrentImage(rotatedData);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = currentImage;
  };

  const handleApplyCrop = async () => {
    if (!currentImage) return;
    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for cropping'));
        img.src = currentImage;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onCropDone(currentImage);
        onClose();
        return;
      }

      if (croppedAreaPixels && croppedAreaPixels.width > 0 && croppedAreaPixels.height > 0) {
        canvas.width = Math.round(croppedAreaPixels.width);
        canvas.height = Math.round(croppedAreaPixels.height);

        ctx.drawImage(
          img,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      }

      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      onCropDone(croppedDataUrl);
      onClose();
    } catch (err) {
      console.error('Crop error:', err);
      // Fallback to current image
      onCropDone(currentImage);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseAsIs = () => {
    if (currentImage) {
      onCropDone(currentImage);
    }
    onClose();
  };

  if (!isOpen || !currentImage) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[96vh] sm:max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col my-auto text-white">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {language === 'mr' ? 'फोटो क्रॉप करा' : language === 'hi' ? 'फोटो क्रॉप करें' : 'Crop & Fine-Tune Card'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {sideTitle} • {isAspectLocked ? '85.6 : 54 (Aadhaar)' : 'Free'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {/* Interactive Cropper Area */}
        <div className="relative flex-1 min-h-[260px] max-h-[55vh] bg-black overflow-hidden flex items-center justify-center">
          <Cropper
            image={currentImage}
            crop={crop}
            zoom={zoom}
            aspect={isAspectLocked ? AADHAAR_ASPECT : undefined}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            showGrid={true}
          />
        </div>

        {/* Controls Toolbar: Zoom, Rotate, Aspect Ratio */}
        <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Zoom Slider */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs active:scale-90"
              title="Zoom out"
            >
              <i className="fas fa-minus"></i>
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs active:scale-90"
              title="Zoom in"
            >
              <i className="fas fa-plus"></i>
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-400 w-8 text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Rotate 90 & Aspect Ratio Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRotate90}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95"
              title="Rotate 90 degrees"
            >
              <i className="fas fa-rotate-right text-blue-400"></i>
              <span>90°</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAspectLocked(!isAspectLocked)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                isAspectLocked
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <i className={isAspectLocked ? 'fas fa-lock' : 'fas fa-unlock'}></i>
              <span>{isAspectLocked ? '85.6:54' : 'Free'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleUseAsIs}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
          >
            {language === 'mr' ? 'मूळ वापरा' : language === 'hi' ? 'यथावत रखें' : 'Use As Is'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all active:scale-95"
            >
              {language === 'mr' ? 'रद्द करा' : language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-black shadow-lg shadow-emerald-500/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-check"></i>
              )}
              <span>{language === 'mr' ? 'क्रॉप पूर्ण करा' : language === 'hi' ? 'क्रॉप लागू करें' : 'Done & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardCropModal;
