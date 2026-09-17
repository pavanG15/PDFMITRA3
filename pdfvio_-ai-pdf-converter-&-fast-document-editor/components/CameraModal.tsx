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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

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
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        };

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = newStream;
        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch(() => {});
        }
        setIsInitializing(false);
      } catch (err: any) {
        console.error('Camera access error:', err);
        setErrorMsg('Camera permission not granted or camera not accessible.');
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
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Stop stream and callback
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    onCapture(dataUrl);
    onClose();
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-black text-sm">{sideTitle}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>

        {/* Video Viewfinder with ID Card Guide Outline */}
        <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-slate-300">
              <i className="fas fa-camera-slash text-3xl text-rose-500 mb-3 block"></i>
              <p className="text-xs mb-4">{errorMsg}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
              >
                {t('closeCamera')}
              </button>
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="w-[85%] aspect-[1.586/1] border-2 border-dashed border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative flex items-center justify-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600/80 px-2 py-0.5 rounded-full">
                    {t('capturePhotoModal')}
                  </span>
                  {/* Corner notches */}
                  <span className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400"></span>
                  <span className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400"></span>
                  <span className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400"></span>
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400"></span>
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

        {/* Footer Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={toggleFacingMode}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all"
            title={t('switchCameraBtn')}
          >
            <i className="fas fa-camera-rotate"></i>
            <span className="hidden sm:inline">{t('switchCameraBtn')}</span>
          </button>

          <button
            type="button"
            onClick={handleCapture}
            disabled={isInitializing || !!errorMsg}
            className="flex-1 max-w-[200px] mx-auto py-3 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-camera text-base"></i>
            <span>{t('capturePhotoBtn')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all"
          >
            {t('closeCamera')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
