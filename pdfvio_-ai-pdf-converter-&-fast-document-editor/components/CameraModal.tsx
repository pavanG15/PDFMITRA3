import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../i18n';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  sideTitle: string;
}

const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  sideTitle,
}) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const guideBoxRef = useRef<HTMLDivElement | null>(null);
  const fileInputFallbackRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  // Helper to safely stop all active camera tracks
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsVideoReady(false);
    setHasTorch(false);
    setIsTorchOn(false);
  }, []);

  // Prevent background scrolling and support Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Start / Restart camera when modal opens or facingMode changes
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      return;
    }

    let isCancelled = false;
    setIsInitializing(true);
    setIsVideoReady(false);
    setErrorMsg(null);

    const startCamera = async () => {
      stopCameraStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!isCancelled) {
          setErrorMsg(
            'तुमच्या ब्राउझरमध्ये कॅमेरा सपोर्ट उपलब्ध नाही. खालील गॅलरी बटण वापरून थेट फोटो अपलोड करा.'
          );
          setIsInitializing(false);
        }
        return;
      }

      try {
        let newStream: MediaStream | null = null;

        // Tier 1: High-res 4K/1080p for sharp 300 DPI ID card text
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
          // Tier 2: Standard 1080p without strict minimum
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: facingMode },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          } catch {
            // Tier 3: Basic fallback for older Android WebViews
            newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode },
              audio: false,
            });
          }
        }

        // If modal closed while awaiting permission, immediately release camera
        if (isCancelled) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = newStream;

        // Enable continuous autofocus and check for Torch (Flashlight) support
        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            const capabilities = videoTrack.getCapabilities?.() as any;
            if (capabilities?.torch) {
              setHasTorch(true);
            }
            if (capabilities?.focusMode?.includes('continuous')) {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: 'continuous' } as any],
              });
            }
          } catch {
            // Ignore unsupported advanced constraints
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Camera access error:', err);
        if (!isCancelled) {
          setErrorMsg(
            'कॅमेरा परमिशन मिळालेली नाही किंवा कॅमेरा सुरू करता आला नाही. खालील गॅलरी बटण वापरून थेट फोटो अपलोड करू शकता.'
          );
          setIsInitializing(false);
        }
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      stopCameraStream();
    };
  }, [isOpen, facingMode, stopCameraStream]);

  const handleVideoLoaded = () => {
    setIsInitializing(false);
    setIsVideoReady(true);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const nextTorchState = !isTorchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchState } as any],
      });
      setIsTorchOn(nextTorchState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) return;

    let sx = 0;
    let sy = 0;
    let sw = videoWidth;
    let sh = videoHeight;

    // Map guide box coordinates to intrinsic video pixel coordinates
    if (guideBoxRef.current) {
      const videoRect = video.getBoundingClientRect();
      const guideRect = guideBoxRef.current.getBoundingClientRect();

      const renderedWidth = videoRect.width;
      const renderedHeight = videoRect.height;

      if (renderedWidth > 0 && renderedHeight > 0) {
        const scale = Math.max(
          renderedWidth / videoWidth,
          renderedHeight / videoHeight
        );

        const displayedVideoWidth = videoWidth * scale;
        const displayedVideoHeight = videoHeight * scale;

        const offsetX = (displayedVideoWidth - renderedWidth) / 2;
        const offsetY = (displayedVideoHeight - renderedHeight) / 2;

        const guideLeftInRendered = guideRect.left - videoRect.left;
        const guideTopInRendered = guideRect.top - videoRect.top;

        sx = (guideLeftInRendered + offsetX) / scale;
        sy = (guideTopInRendered + offsetY) / scale;
        sw = guideRect.width / scale;
        sh = guideRect.height / scale;

        // Clamp within intrinsic video boundaries
        sx = Math.max(0, Math.min(videoWidth - 10, sx));
        sy = Math.max(0, Math.min(videoHeight - 10, sy));
        sw = Math.max(10, Math.min(videoWidth - sx, sw));
        sh = Math.max(10, Math.min(videoHeight - sy, sh));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Mirror horizontally if captured using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    stopCameraStream();
    onCapture(dataUrl);
    onClose();
  };

  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        stopCameraStream();
        onCapture(result);
        onClose();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset so selecting the same file again triggers onChange
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 pb-[68px] sm:pb-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[88vh] sm:max-h-[92vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col my-auto">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="font-black text-sm sm:text-base truncate">
              {sideTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && !errorMsg && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label="Toggle Flashlight"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                  isTorchOn
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Flashlight"
              >
                <i className="fas fa-bolt text-xs"></i>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              aria-label="Close"
              className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            >
              <i className="fas fa-times text-sm"></i>
            </button>
          </div>
        </div>

        {/* Video Viewfinder with ID Card Guide Outline */}
        <div className="relative flex-1 min-h-[240px] max-h-[56vh] aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-slate-300 flex flex-col items-center">
              <i className="fas fa-camera-slash text-3xl text-rose-500 mb-3 block"></i>
              <p className="text-xs sm:text-sm mb-4 max-w-xs leading-relaxed">
                {errorMsg}
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputFallbackRef.current?.click()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow active:scale-95 transition-all"
                >
                  <i className="fas fa-folder-open"></i>
                  <span>गॅलरीतून निवडा</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    onClose();
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
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
                onLoadedMetadata={handleVideoLoaded}
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* ID Card Target Frame Overlay (ISO ID-1 Aspect Ratio 85.6:54) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-4">
                <div
                  ref={guideBoxRef}
                  className="w-[88%] max-w-[420px] aspect-[85.6/54] border-2 border-dashed border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative flex items-center justify-center"
                >
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600/90 px-2.5 py-0.5 rounded-full shadow">
                    {t('capturePhotoModal')}
                  </span>
                  {/* Corner notches */}
                  <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-md"></span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-md"></span>
                  <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-md"></span>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-md"></span>
                </div>
              </div>

              {isInitializing && (
                <div className="absolute inset-0 bg-slate-900/85 flex items-center justify-center text-white text-xs font-bold gap-2">
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
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleFacingMode}
              disabled={isInitializing || !!errorMsg}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
              title={t('switchCameraBtn')}
            >
              <i className="fas fa-camera-rotate text-sm"></i>
              <span className="hidden sm:inline">{t('switchCameraBtn')}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputFallbackRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
              title="Upload from Gallery"
            >
              <i className="fas fa-image text-sm"></i>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCapture}
            disabled={isInitializing || !isVideoReady || !!errorMsg}
            className="flex-1 max-w-[200px] mx-auto py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-camera text-base"></i>
            <span>{t('capturePhotoBtn')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
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