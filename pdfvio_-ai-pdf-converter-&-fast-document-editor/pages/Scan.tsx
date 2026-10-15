import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { ProcessingState } from '../types';
import {
  shareFileViaAndroidBridge,
  downloadFileWithAd,
  showBannerAd,
  hideBannerAd,
} from '../utils/shareHelper';
import BannerAdBar from '../components/BannerAdBar';
import DownloadSuccessAdArea from '../components/DownloadSuccessAdArea';
import QuickCompressModal from '../components/QuickCompressModal';

// Access external libraries from the window object
declare const jspdf: any;
declare const jscanify: any;
declare const JSZip: any;
declare const Tesseract: any;

type ScanFilter = 'none' | 'document' | 'magic_color' | 'bw' | 'grayscale';

interface CapturedPage {
  rawOriginal: string; // Unedited source for full reset
  original: string;    // Current base image (updated after crop/rotate)
  processed: string;   // Filtered output image
  filter: ScanFilter;
  id: string;
  name: string;
  date: string;
  width: number;
  height: number;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const generateId = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `${Math.random().toString(36).substring(2, 11)}-${Date.now().toString(36)}`;
};

// Fit an image into an A4 page while preserving its aspect ratio (centered)
const addImageFitted = (doc: any, page: CapturedPage) => {
  const imgW = page.width || A4_WIDTH_MM;
  const imgH = page.height || A4_HEIGHT_MM;
  const scale = Math.min(A4_WIDTH_MM / imgW, A4_HEIGHT_MM / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (A4_WIDTH_MM - w) / 2;
  const y = (A4_HEIGHT_MM - h) / 2;
  doc.addImage(page.processed, 'JPEG', x, y, w, h);
};

// Draw source image onto a fresh canvas sized to that image
const drawImageToFreshCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);
  }
  return canvas;
};

// Apply pixel filter to a canvas context
const applyPixelFilterToCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filter: ScanFilter
) => {
  if (filter === 'none') return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (filter === 'grayscale') {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    } else if (filter === 'bw') {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const val = lum > 128 ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    } else if (filter === 'magic_color') {
      data[i] = Math.min(255, Math.max(0, (r - 128) * 1.25 + 128 + 12));
      data[i + 1] = Math.min(255, Math.max(0, (g - 128) * 1.25 + 128 + 12));
      data[i + 2] = Math.min(255, Math.max(0, (b - 128) * 1.25 + 128 + 12));
    } else if (filter === 'document') {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const val = lum > 155 ? 255 : Math.max(0, lum * 0.5);
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

const Scan: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const pageCounterRef = useRef(0);
  const dragItemIndex = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [uiStep, setUiStep] = useState<'camera' | 'gallery' | 'preview'>('gallery');

  const [previewPage, setPreviewPage] = useState<CapturedPage | null>(null);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [activeTrack, setActiveTrack] = useState<MediaStreamTrack | null>(null);

  // Cropping State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Project & Export State
  const [folderName, setFolderName] = useState('Scan_Project_01');
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'JPG'>('PDF');

  // Menus & Modals
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [selectedMenuPage, setSelectedMenuPage] = useState<CapturedPage | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string>('');
  const [renameModalPage, setRenameModalPage] = useState<CapturedPage | null>(null);
  const [renameInputVal, setRenameInputVal] = useState<string>('');

  // Share Modal Toggles
  const [enablePassword, setEnablePassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [enableOCR, setEnableOCR] = useState(false);
  const [saveSeparately, setSaveSeparately] = useState(false);

  // Multi-select State
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing & Result State
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);
  const [quickCompressModalOpen, setQuickCompressModalOpen] = useState<boolean>(false);

  // Stop camera helper that safely cleans up tracks
  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore errors
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    setActiveTrack(null);
    setIsFlashOn(false);
  }, []);

  const stopCamera = useCallback(() => {
    stopCameraTracks();
    setUiStep('gallery');
  }, [stopCameraTracks]);

  // Process incoming image (from Camera, File Upload, or Android Bridge)
  const processImage = useCallback(
    (imageSrc: string) => {
      setState({ status: 'processing', progress: 40, message: 'Processing Document...' });
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let finalCanvas: HTMLCanvasElement | null = null;

        if (isAutoMode && scannerRef.current) {
          try {
            finalCanvas = scannerRef.current.extractPaper(img, img.width, img.height);
          } catch (e) {
            console.warn('Auto extraction failed, using raw capture', e);
          }
        }

        if (!finalCanvas) {
          finalCanvas = drawImageToFreshCanvas(img);
        }

        const processedData = finalCanvas.toDataURL('image/jpeg', 0.9);
        pageCounterRef.current += 1;
        const newPage: CapturedPage = {
          rawOriginal: imageSrc,
          original: processedData,
          processed: processedData,
          filter: 'none',
          id: generateId(),
          name: `Page ${pageCounterRef.current}`,
          date: new Date().toLocaleDateString('en-GB'),
          width: finalCanvas.width,
          height: finalCanvas.height,
        };

        setCapturedPages((prev) => [...prev, newPage]);
        setState({ status: 'idle', progress: 0 });

        if (!isAutoMode) {
          stopCamera();
        }
      };
      img.onerror = () => {
        setState({ status: 'error', progress: 0, message: 'Failed to load captured image.' });
      };
    },
    [isAutoMode, stopCamera]
  );

  // Keep a ref to processImage so window.onScanComplete never uses a stale closure
  const processImageRef = useRef(processImage);
  useEffect(() => {
    processImageRef.current = processImage;
  }, [processImage]);

  useEffect(() => {
    if (typeof jscanify !== 'undefined') {
      try {
        scannerRef.current = new jscanify();
      } catch (e) {
        console.warn('Failed to initialize jscanify:', e);
      }
    }

    (window as any).onScanComplete = (base64Image: string) => {
      if (!base64Image) return;
      const formatted = base64Image.startsWith('data:image')
        ? base64Image
        : `data:image/jpeg;base64,${base64Image}`;
      processImageRef.current(formatted);
      setUiStep('gallery');
    };

    return () => {
      stopCameraTracks();
      try {
        delete (window as any).onScanComplete;
      } catch {
        (window as any).onScanComplete = undefined;
      }
    };
  }, [stopCameraTracks]);

  // Attach stream to video element when in camera step
  useEffect(() => {
    if (uiStep === 'camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [uiStep, stream]);

  // Hide banner ad during fullscreen camera, show in gallery/preview
  useEffect(() => {
    if (uiStep === 'camera') {
      hideBannerAd();
    } else {
      showBannerAd('/scan');
    }
  }, [uiStep]);

  // Revoke object URL on replacement or unmount
  useEffect(() => {
    return () => {
      if (state.resultUrl) {
        try {
          URL.revokeObjectURL(state.resultUrl);
        } catch {
          // Ignore
        }
      }
    };
  }, [state.resultUrl]);

  // Reset crop state when switching preview pages
  useEffect(() => {
    if (previewPage) {
      setIsCropping(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [previewPage?.id]);

  // Torch / Flash effect
  useEffect(() => {
    if (!activeTrack) return;
    try {
      const caps = activeTrack.getCapabilities ? activeTrack.getCapabilities() : ({} as any);
      if ((caps as any).torch) {
        activeTrack
          .applyConstraints({
            advanced: [{ torch: isFlashOn }],
          } as any)
          .catch((err) => console.error('Flash error:', err));
      }
    } catch (err) {
      console.warn('Torch not supported on this device:', err);
    }
  }, [isFlashOn, activeTrack]);

  const setResult = (blob: Blob, filename: string) => {
    setState((prev) => {
      if (prev.resultUrl) {
        try {
          URL.revokeObjectURL(prev.resultUrl);
        } catch {
          // Ignore
        }
      }
      return {
        status: 'success',
        resultUrl: URL.createObjectURL(blob),
        resultFileName: filename,
        progress: 100,
      };
    });
  };

  const startCamera = async () => {
    if (
      (window as any).AndroidScanner &&
      typeof (window as any).AndroidScanner.startScan === 'function'
    ) {
      try {
        (window as any).AndroidScanner.startScan();
        return;
      } catch (e) {
        console.warn('Native AndroidScanner failed, falling back to Web Camera:', e);
      }
    }

    try {
      stopCameraTracks();
      setState({ status: 'loading', progress: 0, message: 'Waking up camera...' });

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setActiveTrack(mediaStream.getVideoTracks()[0] || null);
      setUiStep('camera');
      setState({ status: 'idle', progress: 0 });
    } catch (err) {
      console.error(err);
      setState({
        status: 'error',
        progress: 0,
        message: 'Camera access failed. Please allow camera permission or upload from gallery.',
      });
    }
  };

  const handleBack = () => {
    if (uiStep === 'preview') {
      setIsCropping(false);
      setUiStep('gallery');
    } else if (uiStep === 'camera') {
      stopCamera();
    } else {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
  };

  const handleRenamePage = (pageId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCapturedPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, name: trimmed } : p))
    );
    if (previewPage?.id === pageId) {
      setPreviewPage((prev) => (prev ? { ...prev, name: trimmed } : null));
    }
    if (selectedMenuPage?.id === pageId) {
      setSelectedMenuPage((prev) => (prev ? { ...prev, name: trimmed } : null));
    }
  };

  const handleMovePage = (pageId: string, direction: 'left' | 'right') => {
    setCapturedPages((prev) => {
      const idx = prev.findIndex((p) => p.id === pageId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
  };

  // Rotate both base original and processed image so active filters aren't lost
  const handleRotatePage = (pageId: string) => {
    const targetPage = capturedPages.find((p) => p.id === pageId);
    if (!targetPage) return;

    const rotateDataUrl = (src: string): Promise<{ url: string; w: number; h: number }> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.height;
          canvas.height = img.width;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve({ url: src, w: img.width, h: img.height });
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((90 * Math.PI) / 180);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          resolve({
            url: canvas.toDataURL('image/jpeg', 0.92),
            w: canvas.width,
            h: canvas.height,
          });
        };
        img.src = src;
      });

    Promise.all([
      rotateDataUrl(targetPage.original),
      rotateDataUrl(targetPage.processed),
    ]).then(([rotOrig, rotProc]) => {
      setCapturedPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                original: rotOrig.url,
                processed: rotProc.url,
                width: rotProc.w,
                height: rotProc.h,
              }
            : p
        )
      );
      if (previewPage?.id === pageId) {
        setPreviewPage((prev) =>
          prev
            ? {
                ...prev,
                original: rotOrig.url,
                processed: rotProc.url,
                width: rotProc.w,
                height: rotProc.h,
              }
            : null
        );
      }
      if (selectedMenuPage?.id === pageId) {
        setSelectedMenuPage((prev) =>
          prev ? { ...prev, original: rotOrig.url, processed: rotProc.url } : null
        );
      }
    });
  };

  const handleExportSinglePage = async (page: CapturedPage, format: 'PDF' | 'JPG') => {
    try {
      if (format === 'JPG') {
        await downloadFileWithAd(page.processed, `${page.name.replace(/\s+/g, '_')}.jpg`);
      } else {
        const jspdfLib = (window as any).jspdf;
        const jsPDF = jspdfLib?.jsPDF || jspdfLib;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        addImageFitted(doc, page);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        await downloadFileWithAd(url, `${page.name.replace(/\s+/g, '_')}.pdf`);
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      }
    } catch (err) {
      console.error('Export single page error:', err);
    }
  };

  // Supports selecting multiple images at once
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          processImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const rawData = canvas.toDataURL('image/jpeg', 0.95);
    processImage(rawData);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    dragItemIndex.current = index;
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (index: number) => {
    const from = dragItemIndex.current;
    dragItemIndex.current = null;
    if (from === null || from === index) return;
    setCapturedPages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // Apply filter and/or crop without losing previous crops
  const applyFilterAndCrop = async (
    pageId: string,
    filter: ScanFilter,
    doCrop: boolean = false
  ) => {
    const page = capturedPages.find((p) => p.id === pageId);
    if (!page) return;

    setState({ status: 'processing', progress: 50, message: 'Applying changes...' });

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = page.original;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setState({ status: 'idle', progress: 0 });
      return;
    }

    let nextBaseOriginal = page.original;

    if (doCrop && croppedAreaPixels) {
      canvas.width = Math.max(10, Math.round(croppedAreaPixels.width));
      canvas.height = Math.max(10, Math.round(croppedAreaPixels.height));
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
      // Save cropped base image so subsequent filter changes don't undo the crop
      nextBaseOriginal = canvas.toDataURL('image/jpeg', 0.92);
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    }

    applyPixelFilterToCanvas(ctx, canvas.width, canvas.height, filter);

    const processedData = canvas.toDataURL('image/jpeg', 0.9);
    const { width, height } = canvas;

    setCapturedPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              original: nextBaseOriginal,
              processed: processedData,
              filter,
              width,
              height,
            }
          : p
      )
    );

    if (previewPage?.id === pageId) {
      setPreviewPage((prev) =>
        prev
          ? {
              ...prev,
              original: nextBaseOriginal,
              processed: processedData,
              filter,
              width,
              height,
            }
          : null
      );
    }

    setState({ status: 'idle', progress: 0 });
    setIsCropping(false);
  };

  // Restore page back to uncropped, unfiltered original
  const handleResetPageToRaw = (pageId: string) => {
    const page = capturedPages.find((p) => p.id === pageId);
    if (!page) return;

    const img = new Image();
    img.onload = () => {
      setCapturedPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                original: p.rawOriginal,
                processed: p.rawOriginal,
                filter: 'none',
                width: img.width,
                height: img.height,
              }
            : p
        )
      );
      if (previewPage?.id === pageId) {
        setPreviewPage((prev) =>
          prev
            ? {
                ...prev,
                original: prev.rawOriginal,
                processed: prev.rawOriginal,
                filter: 'none',
                width: img.width,
                height: img.height,
              }
            : null
        );
      }
      setIsCropping(false);
    };
    img.src = page.rawOriginal;
  };

  const runOCR = async (targets: CapturedPage[]): Promise<string> => {
    let combinedText = '';
    for (let i = 0; i < targets.length; i++) {
      const page = targets[i];
      setState({
        status: 'processing',
        progress: Math.round(((i + 1) / targets.length) * 90),
        message: `Reading text (${i + 1}/${targets.length})...`,
      });
      try {
        const { data } = await Tesseract.recognize(page.processed, 'eng');
        combinedText += `--- ${page.name} ---\n${(data?.text || '').trim()}\n\n`;
      } catch (e) {
        console.error('OCR failed for', page.name, e);
        combinedText += `--- ${page.name} ---\n[OCR failed for this page]\n\n`;
      }
    }
    return combinedText;
  };

  const finalizeExport = async (
    mainBlob: Blob,
    mainFilename: string,
    targets: CapturedPage[]
  ) => {
    if (!enableOCR || typeof Tesseract === 'undefined') {
      setResult(mainBlob, mainFilename);
      return;
    }
    const text = await runOCR(targets);
    const zip = new JSZip();
    zip.file(mainFilename, mainBlob);
    zip.file(`${folderName}_OCR.txt`, text);
    setState({ status: 'processing', progress: 95, message: 'Packaging results...' });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    setResult(zipBlob, `${folderName}_with_OCR.zip`);
  };

  const handleExport = async () => {
    setHasDownloaded(false);
    const targets = isSelectMode
      ? capturedPages.filter((p) => selectedIds.has(p.id))
      : capturedPages;

    if (targets.length === 0) return;

    setState({
      status: 'processing',
      progress: 10,
      message: exportFormat === 'PDF' ? 'Building PDF...' : 'Preparing images...',
    });

    try {
      if (exportFormat === 'JPG') {
        if (targets.length === 1 && !saveSeparately) {
          const res = await fetch(targets[0].processed);
          const blob = await res.blob();
          await finalizeExport(
            blob,
            `${targets[0].name.replace(/\s+/g, '_')}.jpg`,
            targets
          );
        } else {
          const zip = new JSZip();
          for (let i = 0; i < targets.length; i++) {
            const page = targets[i];
            const res = await fetch(page.processed);
            const blob = await res.blob();
            zip.file(`${page.name.replace(/\s+/g, '_')}.jpg`, blob);
            setState({
              status: 'processing',
              progress: Math.round(((i + 1) / targets.length) * 90),
              message: `Adding ${page.name}...`,
            });
          }
          if (enableOCR && typeof Tesseract !== 'undefined') {
            const text = await runOCR(targets);
            zip.file(`${folderName}_OCR.txt`, text);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          setResult(zipBlob, `${folderName}.zip`);
        }
      } else {
        const jspdfLib = (window as any).jspdf;
        const jsPDF = jspdfLib.jsPDF || jspdfLib;

        const pdfOptions: any = { orientation: 'p', unit: 'mm', format: 'a4' };
        if (enablePassword && pdfPassword.trim()) {
          pdfOptions.encryption = {
            userPassword: pdfPassword.trim(),
            ownerPassword: pdfPassword.trim(),
            userPermissions: ['print', 'modify', 'copy', 'annot-forms'],
          };
        }

        if (saveSeparately) {
          const zip = new JSZip();
          for (let i = 0; i < targets.length; i++) {
            const page = targets[i];
            const doc = new jsPDF(pdfOptions);
            addImageFitted(doc, page);
            const pdfBlob = doc.output('blob');
            zip.file(`${page.name.replace(/\s+/g, '_')}.pdf`, pdfBlob);
            setState({
              status: 'processing',
              progress: 30 + Math.round(((i + 1) / targets.length) * 60),
              message: `Zipping ${page.name}...`,
            });
          }
          if (enableOCR && typeof Tesseract !== 'undefined') {
            const text = await runOCR(targets);
            zip.file(`${folderName}_OCR.txt`, text);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          setResult(zipBlob, `${folderName}.zip`);
        } else {
          const doc = new jsPDF(pdfOptions);
          for (let i = 0; i < targets.length; i++) {
            if (i > 0) doc.addPage();
            addImageFitted(doc, targets[i]);
            setState({
              status: 'processing',
              progress: Math.round(((i + 1) / targets.length) * 90),
              message: `Adding ${targets[i].name}...`,
            });
          }
          const blob = doc.output('blob');
          await finalizeExport(blob, `${folderName}.pdf`, targets);
        }
      }
      setShowShareModal(false);
    } catch (e) {
      console.error(e);
      setState({
        status: 'error',
        progress: 0,
        message: 'Export failed. Please try again.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020617] text-white flex flex-col overflow-hidden h-screen w-screen select-none font-sans">
      <canvas ref={canvasRef} className="hidden" />

      {/* 1. TOP NAVBAR (Gallery Mode) */}
      {uiStep === 'gallery' && (
        <div className="pt-10 pb-4 px-5 border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl shrink-0 z-[100]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="w-10 h-10 flex items-center justify-center text-white/70 hover:text-white text-xl active:scale-90 transition-transform cursor-pointer"
                title="Back"
              >
                <i className="fas fa-arrow-left"></i>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-[10px] font-black text-white/40 uppercase tracking-widest cursor-pointer hover:text-white/80 transition-colors flex items-center"
                  >
                    Home <i className="fas fa-chevron-right mx-1 text-[7px]"></i>
                  </button>
                  {isRenamingFolder ? (
                    <input
                      autoFocus
                      defaultValue={folderName}
                      onBlur={(e) => {
                        setFolderName(e.target.value.trim() || 'Scan_Project_01');
                        setIsRenamingFolder(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setFolderName(
                            (e.target as HTMLInputElement).value.trim() || 'Scan_Project_01'
                          );
                          setIsRenamingFolder(false);
                        }
                      }}
                      className="text-[10px] font-black text-teal-400 bg-teal-400/10 rounded px-2 py-0.5 outline-none border border-teal-400/30"
                    />
                  ) : (
                    <span
                      onClick={() => setIsRenamingFolder(true)}
                      className="text-[10px] font-black text-teal-400 uppercase tracking-widest cursor-pointer flex items-center gap-1.5 hover:text-teal-300"
                    >
                      {folderName} <i className="fas fa-pen text-[7px] opacity-40"></i>
                    </span>
                  )}
                </div>
                <h2 className="text-sm font-black text-white uppercase mt-1 tracking-tight">
                  {isSelectMode
                    ? `${selectedIds.size} Selected`
                    : `DOCUMENTS (${capturedPages.length})`}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  setSelectedIds(new Set());
                }}
                className={`w-10 h-10 flex items-center justify-center text-lg transition-all active:scale-90 ${
                  isSelectMode ? 'text-teal-400' : 'text-white/40'
                }`}
                title={isSelectMode ? 'Exit Select Mode' : 'Select Pages'}
              >
                <i className="fas fa-check-double"></i>
              </button>

              <button
                type="button"
                onClick={() => setShowTopMenu(!showTopMenu)}
                className={`w-10 h-10 flex items-center justify-center text-lg active:scale-90 transition-transform ${
                  showTopMenu ? 'text-teal-400' : 'text-white/40'
                }`}
                title="More Options"
              >
                <i className="fas fa-ellipsis-v"></i>
              </button>

              {showTopMenu && (
                <>
                  <div
                    className="fixed inset-0 z-[150]"
                    onClick={() => setShowTopMenu(false)}
                  />
                  <div className="absolute top-12 right-0 z-[160] w-56 bg-[#0f172a] border border-white/10 rounded-2xl p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col gap-1 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRenamingFolder(true);
                        setShowTopMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left text-xs font-bold text-white/80 hover:text-white"
                    >
                      <i className="fas fa-pen text-teal-400 w-4"></i>
                      <span>Rename Project</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSelectMode(true);
                        setSelectedIds(new Set(capturedPages.map((p) => p.id)));
                        setShowTopMenu(false);
                      }}
                      disabled={capturedPages.length === 0}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left text-xs font-bold text-white/80 hover:text-white disabled:opacity-30"
                    >
                      <i className="fas fa-check-double text-blue-400 w-4"></i>
                      <span>Select All Pages</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowShareModal(true);
                        setShowTopMenu(false);
                      }}
                      disabled={capturedPages.length === 0}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left text-xs font-bold text-white/80 hover:text-white disabled:opacity-30"
                    >
                      <i className="fas fa-arrow-down text-emerald-400 w-4"></i>
                      <span>Download &amp; Export PDF</span>
                    </button>

                    <div className="h-px bg-white/5 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete all scanned pages?')) {
                          setCapturedPages([]);
                          setSelectedIds(new Set());
                        }
                        setShowTopMenu(false);
                      }}
                      disabled={capturedPages.length === 0}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-left text-xs font-bold text-rose-400 disabled:opacity-30"
                    >
                      <i className="fas fa-trash-can w-4"></i>
                      <span>Clear All Pages</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowTopMenu(false);
                        navigate('/');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-left text-xs font-bold text-white/60 hover:text-white"
                    >
                      <i className="fas fa-house w-4"></i>
                      <span>Back to Home</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Multi-File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 2. MAIN GALLERY CONTENT */}
      {uiStep === 'gallery' && (
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar pb-36 bg-[#020617]">
          {!isSelectMode && capturedPages.length > 1 && (
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-3">
              Tap a page to edit &bull; Drag or use menu to reorder
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {!isSelectMode && (
              <div
                onClick={startCamera}
                className="aspect-[3/4] rounded-2xl border-2 border-dashed border-teal-500/40 bg-teal-500/5 flex flex-col items-center justify-center text-teal-400 active:scale-95 transition-all cursor-pointer hover:bg-teal-500/10 hover:border-teal-400"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-500/15 flex items-center justify-center mb-3 text-xl text-teal-400">
                  <i className="fas fa-camera"></i>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-center px-2">
                  Scan Page
                </span>
                <span className="text-[7px] text-teal-400/60 mt-0.5">Camera / Scanner</span>
              </div>
            )}

            {!isSelectMode && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-white/40 active:scale-95 transition-all cursor-pointer hover:bg-white/10 hover:border-white/20"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3 text-xl text-white/60">
                  <i className="fas fa-images"></i>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-center px-2">
                  Upload Images
                </span>
                <span className="text-[7px] text-white/30 mt-0.5">From Gallery</span>
              </div>
            )}

            {capturedPages.map((p, index) => (
              <div
                key={p.id}
                className="flex flex-col animate-in zoom-in duration-200"
                draggable={!isSelectMode}
                onDragStart={() => handleDragStart(index)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
              >
                <div
                  onClick={() =>
                    isSelectMode
                      ? toggleSelect(p.id)
                      : (setPreviewPage(p), setUiStep('preview'))
                  }
                  className={`relative aspect-[3/4] bg-white/5 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all cursor-pointer ${
                    selectedIds.has(p.id)
                      ? 'border-teal-500 ring-4 ring-teal-500/20'
                      : 'border-white/5'
                  }`}
                >
                  <img
                    src={p.processed}
                    className="w-full h-full object-cover"
                    alt={p.name}
                  />

                  {selectedIds.has(p.id) && (
                    <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center animate-in fade-in duration-150">
                      <div className="w-11 h-11 bg-teal-500 rounded-full flex items-center justify-center text-white text-base shadow-xl border-2 border-white">
                        <i className="fas fa-check"></i>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMenuPage(p);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-teal-500 hover:text-black backdrop-blur-md rounded-full flex items-center justify-center text-white text-[10px] shadow-md transition-all active:scale-90 z-10 cursor-pointer"
                    title="Page Options"
                  >
                    <i className="fas fa-ellipsis-h"></i>
                  </button>

                  <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded-md">
                    #{index + 1}
                  </div>
                </div>

                <div className="pt-2 px-1">
                  {editingPageId === p.id ? (
                    <div
                      className="flex items-center gap-1 w-full"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={editingPageName}
                        onChange={(e) => setEditingPageName(e.target.value)}
                        onBlur={() => {
                          handleRenamePage(p.id, editingPageName);
                          setEditingPageId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenamePage(p.id, editingPageName);
                            setEditingPageId(null);
                          } else if (e.key === 'Escape') {
                            setEditingPageId(null);
                          }
                        }}
                        className="w-full text-[10px] font-black text-teal-300 bg-teal-950/80 border border-teal-400/50 rounded px-1.5 py-0.5 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          handleRenamePage(p.id, editingPageName);
                          setEditingPageId(null);
                        }}
                        className="text-teal-400 text-xs px-1 hover:text-teal-200"
                      >
                        <i className="fas fa-check"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-0.5 w-full">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPageId(p.id);
                          setEditingPageName(p.name);
                        }}
                        className="flex items-center gap-1 cursor-pointer group/name truncate flex-1 mr-1"
                      >
                        <span className="text-[10px] font-black text-white/90 uppercase truncate group-hover/name:text-teal-300 transition-colors">
                          {p.name}
                        </span>
                        <i className="fas fa-pencil text-[7px] text-teal-400/40 group-hover/name:text-teal-400"></i>
                      </div>
                      <span className="text-[8px] font-bold text-white/25 uppercase">
                        {p.date}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. FLOATING CAMERA & EXPORT BUTTONS (Positioned safely above 60px Ad Banner) */}
      {uiStep === 'gallery' && !isSelectMode && (
        <div className="fixed bottom-20 right-6 flex flex-col items-end gap-4 z-[200]">
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            disabled={capturedPages.length === 0}
            title="Download & Export Documents"
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-2xl transition-all active:scale-90 ${
              capturedPages.length > 0
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 hover:bg-emerald-400'
                : 'bg-white/5 text-white/15 cursor-not-allowed border border-white/5'
            }`}
          >
            <i className="fas fa-download"></i>
          </button>
          <button
            type="button"
            onClick={startCamera}
            className="w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center text-slate-950 text-2xl shadow-[0_15px_40px_-10px_rgba(20,184,166,0.6)] active:scale-90 transition-all border-2 border-white/20 hover:brightness-110"
          >
            <i className="fas fa-camera"></i>
          </button>
        </div>
      )}

      {/* 4. MULTI-SELECT FOOTER */}
      {uiStep === 'gallery' && isSelectMode && (
        <div className="bg-[#0f172a] p-4 px-6 border-t border-white/10 flex gap-3 shadow-2xl z-[300] shrink-0">
          <button
            type="button"
            onClick={() => {
              setCapturedPages((prev) => prev.filter((p) => !selectedIds.has(p.id)));
              setSelectedIds(new Set());
              setIsSelectMode(false);
            }}
            disabled={selectedIds.size === 0}
            className="flex-1 bg-rose-500/15 text-rose-400 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-20 active:scale-95 transition-all border border-rose-500/30 flex items-center justify-center gap-2"
          >
            <i className="fas fa-trash-alt"></i> Delete ({selectedIds.size})
          </button>
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            disabled={selectedIds.size === 0}
            className="flex-1 bg-teal-500 text-slate-950 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-file-export"></i> Export ({selectedIds.size})
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSelectMode(false);
              setSelectedIds(new Set());
            }}
            className="px-5 bg-white/5 text-white/60 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 5. FULLSCREEN CAMERA INTERFACE */}
      {uiStep === 'camera' && (
        <div className="absolute inset-0 z-[500] flex flex-col bg-black animate-in fade-in duration-200 overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
          />

          <div className="absolute top-10 left-0 right-0 px-6 flex justify-between items-center z-[510]">
            <button
              type="button"
              onClick={stopCamera}
              className="w-11 h-11 bg-black/50 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform flex items-center justify-center border border-white/15"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
            <div className="bg-black/50 backdrop-blur-md p-1 rounded-2xl border border-white/15 flex">
              <button
                type="button"
                onClick={() => setIsAutoMode(true)}
                className={`px-5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  isAutoMode
                    ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/30'
                    : 'text-white/60'
                }`}
              >
                Auto Crop
              </button>
              <button
                type="button"
                onClick={() => setIsAutoMode(false)}
                className={`px-5 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                  !isAutoMode
                    ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/30'
                    : 'text-white/60'
                }`}
              >
                Manual
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsFlashOn(!isFlashOn)}
              className={`w-11 h-11 rounded-full backdrop-blur-md transition-all active:scale-90 flex items-center justify-center border border-white/15 ${
                isFlashOn
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-black/50 text-white'
              }`}
            >
              <i className={`fas ${isFlashOn ? 'fa-bolt' : 'fa-bolt-slash'}`}></i>
            </button>
          </div>

          {isAutoMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[82%] aspect-[3/4] border-2 border-teal-500/40 rounded-3xl relative">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-teal-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-teal-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-teal-400 rounded-br-xl" />
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 flex items-center justify-between px-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-[510]">
            <button
              type="button"
              onClick={stopCamera}
              className="w-14 h-14 rounded-2xl border-2 border-white/20 overflow-hidden bg-black/50 backdrop-blur-md cursor-pointer flex items-center justify-center active:scale-95"
            >
              {capturedPages.length > 0 ? (
                <img
                  src={capturedPages[capturedPages.length - 1].processed}
                  className="w-full h-full object-cover"
                  alt="Last scan"
                />
              ) : (
                <i className="fas fa-images text-white/30"></i>
              )}
            </button>

            <button
              type="button"
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-[6px] border-white/30 p-1.5 active:scale-90 transition-all shadow-2xl group relative"
            >
              <div className="w-full h-full bg-white rounded-full group-hover:scale-95 transition-transform" />
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="w-14 h-14 flex flex-col items-center justify-center text-white bg-teal-500/20 backdrop-blur-md rounded-2xl border border-teal-400/40 active:scale-95 transition-all"
            >
              <span className="text-lg font-black text-teal-300">
                {capturedPages.length}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-teal-200/70">
                Done
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 6. IMAGE PREVIEW & EDITOR STEP */}
      {uiStep === 'preview' && previewPage && (
        <div className="flex-1 flex flex-col bg-[#020617] overflow-hidden z-[400]">
          <div className="pt-10 pb-3 px-5 border-b border-white/5 flex items-center justify-between bg-[#0f172a] shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsCropping(false);
                setUiStep('gallery');
              }}
              className="w-10 h-10 flex items-center justify-center text-white/70 text-lg active:scale-90 transition-transform"
            >
              <i className="fas fa-arrow-left"></i>
            </button>

            <button
              type="button"
              onClick={() => {
                setRenameModalPage(previewPage);
                setRenameInputVal(previewPage.name);
              }}
              className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5 hover:text-teal-300"
            >
              <span className="truncate max-w-[160px]">{previewPage.name}</span>
              <i className="fas fa-pencil text-[8px] opacity-60"></i>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (isCropping) {
                  await applyFilterAndCrop(previewPage.id, previewPage.filter, true);
                }
                setUiStep('gallery');
              }}
              className="bg-teal-500 text-slate-950 px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
            >
              {isCropping ? 'Apply Crop' : 'Done'}
            </button>
          </div>

          <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center p-2">
            {isCropping ? (
              <div className="absolute inset-0">
                <Cropper
                  image={previewPage.original}
                  crop={crop}
                  zoom={zoom}
                  aspect={undefined}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
            ) : (
              <img
                src={previewPage.processed}
                className="max-w-full max-h-full object-contain shadow-2xl"
                alt={previewPage.name}
              />
            )}
          </div>

          <div className="bg-[#0f172a] p-4 border-t border-white/5 flex flex-col gap-4 shrink-0">
            {/* Filter Selector Bar */}
            {!isCropping && (
              <div className="flex items-center justify-center sm:justify-start gap-3 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'none', label: 'Original', icon: 'fa-image' },
                  { id: 'magic_color', label: 'Magic', icon: 'fa-wand-magic-sparkles' },
                  { id: 'document', label: 'Doc', icon: 'fa-file-lines' },
                  { id: 'bw', label: 'B&W', icon: 'fa-circle-half-stroke' },
                  { id: 'grayscale', label: 'Gray', icon: 'fa-palette' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      applyFilterAndCrop(previewPage.id, f.id as ScanFilter, false)
                    }
                    className={`flex flex-col items-center gap-1.5 min-w-[60px] transition-all active:scale-90 ${
                      previewPage.filter === f.id ? 'text-teal-400' : 'text-white/40'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-base border-2 transition-all ${
                        previewPage.filter === f.id
                          ? 'bg-teal-400/15 border-teal-400'
                          : 'bg-white/5 border-transparent'
                      }`}
                    >
                      <i className={`fas ${f.icon}`}></i>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (isCropping) {
                    applyFilterAndCrop(previewPage.id, previewPage.filter, true);
                  } else {
                    setIsCropping(true);
                  }
                }}
                className={`flex-1 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isCropping
                    ? 'bg-teal-500 text-slate-950'
                    : 'bg-white/5 text-white/80 border border-white/10'
                }`}
              >
                <i className={`fas ${isCropping ? 'fa-check' : 'fa-crop-simple'}`}></i>
                <span>{isCropping ? 'Save Crop' : 'Crop'}</span>
              </button>

              {isCropping ? (
                <button
                  type="button"
                  onClick={() => setIsCropping(false)}
                  className="flex-1 py-3.5 bg-white/5 text-white/70 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancel Crop
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleRotatePage(previewPage.id)}
                    className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <i className="fas fa-rotate-right"></i> Rotate
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResetPageToRaw(previewPage.id)}
                    className="py-3.5 px-4 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95"
                    title="Reset to Original"
                  >
                    <i className="fas fa-rotate-left"></i>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCapturedPages((prev) =>
                        prev.filter((p) => p.id !== previewPage.id)
                      );
                      setUiStep('gallery');
                    }}
                    className="py-3.5 px-4 bg-rose-500/15 text-rose-400 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-500/25 active:scale-95"
                    title="Delete Page"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. EXPORT / SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl animate-in fade-in flex items-end justify-center">
          <div className="w-full bg-white text-slate-900 rounded-t-[2.5rem] p-6 pb-20 max-w-xl mx-auto shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-600/20 shrink-0">
                <i className="fas fa-file-export"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black truncate">{folderName}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  {isSelectMode ? selectedIds.size : capturedPages.length} Page(s) Ready
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-bold text-slate-700">Output Format</span>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setExportFormat('PDF')}
                    className={`px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      exportFormat === 'PDF'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-400'
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('JPG')}
                    className={`px-5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      exportFormat === 'JPG'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-400'
                    }`}
                  >
                    JPG
                  </button>
                </div>
              </div>

              {[
                {
                  label: 'Save Pages Separately (.ZIP)',
                  value: saveSeparately,
                  setter: setSaveSeparately,
                },
                {
                  label: 'Enable PDF Password',
                  value: enablePassword,
                  setter: setEnablePassword,
                  disabled: exportFormat === 'JPG',
                },
                {
                  label: 'Extract OCR Text (.TXT)',
                  value: enableOCR,
                  setter: setEnableOCR,
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between py-2.5 border-b border-slate-100 ${
                    item.disabled ? 'opacity-40' : ''
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => item.setter(!item.value)}
                    className={`w-11 h-6 rounded-full transition-all relative ${
                      item.value ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
                        item.value ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              ))}

              {/* Inline Password Input (Replaces blocked window.prompt) */}
              {enablePassword && exportFormat === 'PDF' && (
                <div className="pt-1">
                  <input
                    type="password"
                    value={pdfPassword}
                    onChange={(e) => setPdfPassword(e.target.value)}
                    placeholder="Enter PDF password..."
                    className="w-full px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 text-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 uppercase tracking-widest text-xs active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-download"></i> Export Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7b. PAGE ACTIONS MODAL */}
      {selectedMenuPage && (
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0f172a] text-white border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl p-6 pb-20 sm:pb-6 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <img
                src={selectedMenuPage.processed}
                alt={selectedMenuPage.name}
                className="w-12 h-16 object-cover rounded-xl border border-white/10 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-white uppercase truncate">
                  {selectedMenuPage.name}
                </h3>
                <p className="text-[10px] text-white/40">{selectedMenuPage.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMenuPage(null)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 text-sm"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Mobile Reorder Controls */}
            {capturedPages.length > 1 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleMovePage(selectedMenuPage.id, 'left')}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <i className="fas fa-arrow-left text-teal-400"></i> Move Earlier
                </button>
                <button
                  type="button"
                  onClick={() => handleMovePage(selectedMenuPage.id, 'right')}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  Move Later <i className="fas fa-arrow-right text-teal-400"></i>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const page = selectedMenuPage;
                  setSelectedMenuPage(null);
                  setRenameModalPage(page);
                  setRenameInputVal(page.name);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
              >
                <i className="fas fa-pencil text-teal-400 w-5"></i>
                <span>Rename Page</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewPage(selectedMenuPage);
                  setUiStep('preview');
                  setSelectedMenuPage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
              >
                <i className="fas fa-crop-simple text-blue-400 w-5"></i>
                <span>Edit, Crop &amp; Filters</span>
              </button>

              <button
                type="button"
                onClick={() => handleRotatePage(selectedMenuPage.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
              >
                <i className="fas fa-rotate-right text-emerald-400 w-5"></i>
                <span>Rotate 90° Clockwise</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExportSinglePage(selectedMenuPage, 'PDF');
                  setSelectedMenuPage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
              >
                <i className="fas fa-file-pdf text-amber-400 w-5"></i>
                <span>Download Page as PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExportSinglePage(selectedMenuPage, 'JPG');
                  setSelectedMenuPage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
              >
                <i className="fas fa-file-image text-cyan-400 w-5"></i>
                <span>Download Page as JPG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const pageId = selectedMenuPage.id;
                  setCapturedPages((prev) => prev.filter((p) => p.id !== pageId));
                  setSelectedMenuPage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs border border-rose-500/20"
              >
                <i className="fas fa-trash-can w-5"></i>
                <span>Delete Page</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7c. DEDICATED RENAME MODAL */}
      {renameModalPage && (
        <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0f172a] text-white border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                <i className="fas fa-pencil text-teal-400"></i> Rename Page
              </h3>
              <button
                type="button"
                onClick={() => setRenameModalPage(null)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 text-sm"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <input
              autoFocus
              type="text"
              value={renameInputVal}
              onChange={(e) => setRenameInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenamePage(renameModalPage.id, renameInputVal);
                  setRenameModalPage(null);
                } else if (e.key === 'Escape') {
                  setRenameModalPage(null);
                }
              }}
              placeholder="e.g. ID Front, Bill Page 1..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-teal-400"
            />

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRenameModalPage(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 font-black text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRenamePage(renameModalPage.id, renameInputVal);
                  setRenameModalPage(null);
                }}
                className="flex-1 py-3 rounded-xl bg-teal-500 text-slate-950 font-black text-xs uppercase"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. LOADING / PROCESSING OVERLAY */}
      {(state.status === 'processing' || state.status === 'loading') && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center text-white">
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 border-[6px] border-white/10 rounded-full" />
            <div className="absolute inset-0 border-[6px] border-teal-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-teal-400 text-xl font-black">
              {state.progress}%
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">Working...</h2>
          <p className="text-white/40 font-black uppercase text-[10px] tracking-[0.3em]">
            {state.message}
          </p>
        </div>
      )}

      {/* 8b. ERROR OVERLAY */}
      {state.status === 'error' && (
        <div className="fixed inset-0 z-[2500] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center text-white">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-3xl mb-6">
            <i className="fas fa-triangle-exclamation"></i>
          </div>
          <h3 className="text-xl font-black uppercase mb-2">Something Went Wrong</h3>
          <p className="text-xs text-white/60 max-w-xs mb-6">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ status: 'idle', progress: 0 })}
            className="px-8 py-3.5 rounded-2xl bg-teal-500 text-slate-950 font-black text-xs uppercase tracking-widest"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 9. SUCCESS SCREEN */}
      {state.status === 'success' && (
        <div className="fixed inset-0 z-[3000] bg-[#020617] flex flex-col justify-between items-center text-center animate-in zoom-in duration-300 overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto my-auto">
            <div className="w-24 h-24 bg-teal-500 text-slate-950 text-4xl rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl border-4 border-white/20 shrink-0">
              <i className="fas fa-check-double"></i>
            </div>
            <h2 className="text-3xl font-black text-white mb-1 uppercase tracking-tight">
              DONE!
            </h2>
            <p className="text-white/40 mb-6 font-bold text-xs truncate max-w-full px-4">
              {state.resultFileName}
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => {
                  downloadFileWithAd(
                    state.resultUrl!,
                    state.resultFileName || `${folderName}.${exportFormat.toLowerCase()}`
                  );
                  setHasDownloaded(true);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white py-4 px-6 rounded-2xl font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase"
              >
                <i className="fas fa-file-download text-xl"></i> DOWNLOAD
              </button>

              {state.resultUrl && !state.resultFileName?.endsWith('.zip') && (
                <button
                  type="button"
                  onClick={() => setQuickCompressModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 py-4 px-6 rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase"
                >
                  <i className="fas fa-file-zipper text-xl"></i> COMPRESS FILE
                </button>
              )}

              {state.resultUrl && (
                <button
                  type="button"
                  onClick={() =>
                    shareFileViaAndroidBridge(
                      state.resultUrl!,
                      state.resultFileName || `${folderName}.${exportFormat.toLowerCase()}`
                    )
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-6 rounded-2xl font-black text-base shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase"
                >
                  <i className="fas fa-share-nodes text-lg"></i> SHARE FILE
                </button>
              )}

              {hasDownloaded && (
                <DownloadSuccessAdArea
                  downloadKey={state.resultFileName || folderName}
                  className="mt-2 pt-2"
                />
              )}

              <button
                type="button"
                onClick={() => {
                  setState({ status: 'idle', progress: 0 });
                  setHasDownloaded(false);
                  setUiStep('gallery');
                }}
                className="text-white/40 font-black text-[10px] uppercase tracking-[0.3em] py-3 hover:text-teal-400 transition-colors"
              >
                BACK TO FOLDER
              </button>
            </div>
          </div>

          {quickCompressModalOpen && state.resultUrl && (
            <QuickCompressModal
              isOpen={quickCompressModalOpen}
              onClose={() => setQuickCompressModalOpen(false)}
              sourceFile={state.resultUrl}
              sourceFileName={
                state.resultFileName || `${folderName}.${exportFormat.toLowerCase()}`
              }
              isPdf={Boolean(state.resultFileName?.toLowerCase().endsWith('.pdf'))}
            />
          )}

          <div className="w-full shrink-0">
            <BannerAdBar isOverlay={true} />
          </div>
        </div>
      )}

      {/* Global Bottom AdMob Reserved Slot (keeps Gallery & Preview buttons above the 60px native banner) */}
      {uiStep !== 'camera' && state.status !== 'success' && (
        <div className="w-full shrink-0 bg-[#020617]">
          <BannerAdBar isOverlay={true} />
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default Scan;