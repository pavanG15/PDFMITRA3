import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  sideTitle: string;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture, sideTitle }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideBoxRef = useRef<HTMLDivElement | null>(null);
  const fileInputFallbackRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Prevent background scrolling while camera modal is open
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

  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;
    setIsInitializing(true);
    setErrorMsg(null);

    const startCamera = async () => {
      try {
        let newStream: MediaStream | null = null;

        // 1. Try rear camera at highest available resolution (4K / 1080p sharp for 300 DPI)
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 3840, min: 1280 },
              height: { ideal: 2160, min: 720 },
            },
            audio: false,
          });
        } catch {
          // 2. Fallback to standard 1080p if min constraints not met
          newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        }

        activeStream = newStream;
        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch(() => {});
        }
        setIsInitializing(false);
      } catch (err: any) {
        console.error('Camera access error:', err);
        setErrorMsg('कॅमेरा परमिशन मिळालेली नाही किंवा कॅमेरा सुरू करता आला नाही. खालील गॅलरी बटण वापरून थेट फोटो अपलोड करू शकता.');
        setIsInitializing(false);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) return;

    let sx = 0;
    let sy = 0;
    let sw = videoWidth;
    let sh = videoHeight;

    // Map the guide box's on-screen rect to video's intrinsic pixel coordinates
    // accounting for object-fit: cover scale and centering offset
    if (guideBoxRef.current) {
      const videoRect = video.getBoundingClientRect();
      const guideRect = guideBoxRef.current.getBoundingClientRect();

      const renderedWidth = videoRect.width;
      const renderedHeight = videoRect.height;

      if (renderedWidth > 0 && renderedHeight > 0) {
        // Under object-fit: cover, the video fills the container by scaling up to whichever ratio is larger
        const scale = Math.max(renderedWidth / videoWidth, renderedHeight / videoHeight);

        // Displayed video dimensions before overflow clipping
        const displayedVideoWidth = videoWidth * scale;
        const displayedVideoHeight = videoHeight * scale;

        // Centering offset introduced by object-fit: cover
        const offsetX = (displayedVideoWidth - renderedWidth) / 2;
        const offsetY = (displayedVideoHeight - renderedHeight) / 2;

        // Guide box position relative to the visible video element
        const guideLeftInRendered = guideRect.left - videoRect.left;
        const guideTopInRendered = guideRect.top - videoRect.top;
        const guideWidthInRendered = guideRect.width;
        const guideHeightInRendered = guideRect.height;

        // Unclipped displayed coordinates
        const xInDisplayed = guideLeftInRendered + offsetX;
        const yInDisplayed = guideTopInRendered + offsetY;

        // Map to intrinsic video coordinates
        sx = xInDisplayed / scale;
        sy = yInDisplayed / scale;
        sw = guideWidthInRendered / scale;
        sh = guideHeightInRendered / scale;

        // Safety clamp within video boundaries
        sx = Math.max(0, Math.min(videoWidth, sx));
        sy = Math.max(0, Math.min(videoHeight, sy));
        sw = Math.max(10, Math.min(videoWidth - sx, sw));
        sh = Math.max(10, Math.min(videoHeight - sy, sh));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw ONLY the exact cropped region inside the guide box
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Stop stream and callback
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    onCapture(dataUrl);
    onClose();
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
        onCapture(event.target?.result as string);
        onClose();
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[96vh] sm:max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col my-auto">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-black text-sm sm:text-base">{sideTitle}</span>
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

        {/* Video Viewfinder with ID Card Guide Outline */}
        <div className="relative flex-1 min-h-[220px] max-h-[58vh] aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center">
              <i className="fas fa-camera-slash text-3xl text-rose-500 mb-3 block"></i>
              <p className="text-xs sm:text-sm mb-4 max-w-xs">{errorMsg}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputFallbackRef.current?.click()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <i className="fas fa-folder-open"></i>
                  <span>गॅलरीतून निवडा</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                >
                  {t('closeCamera')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* ID Card Target Frame Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-4">
                <div
                  ref={guideBoxRef}
                  className="w-[88%] max-w-[420px] aspect-[85.6/54] border-2 border-dashed border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative flex items-center justify-center"
                >
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600/90 px-2.5 py-0.5 rounded-full shadow">
                    {t('capturePhotoModal')}
                  </span>
                  {/* Corner notches */}
                  <span className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-400"></span>
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-400"></span>
                  <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-400"></span>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-400"></span>
                </div>
              </div>

              {isInitializing && (
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center text-white text-xs gap-2">
                  <i className="fas fa-spinner fa-spin text-emerald-400 text-lg"></i>
                  <span>Starting Camera...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden File Input for fallback gallery pick */}
        <input
          type="file"
          ref={fileInputFallbackRef}
          accept="image/*"
          className="hidden"
          onChange={handleFallbackFile}
        />

        {/* Footer Controls */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <button
            type="button"
            onClick={toggleFacingMode}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
            title={t('switchCameraBtn')}
          >
            <i className="fas fa-camera-rotate text-sm"></i>
            <span className="hidden sm:inline">{t('switchCameraBtn')}</span>
          </button>

          <button
            type="button"
            onClick={handleCapture}
            disabled={isInitializing || !!errorMsg}
            className="flex-1 max-w-[220px] mx-auto py-3 px-4 sm:px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-camera text-base"></i>
            <span>{t('capturePhotoBtn')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
          >
            {t('closeCamera')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
