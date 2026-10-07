import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { ProcessingState } from '../types';
import { shareFileViaAndroidBridge, triggerInterstitialAd, downloadFileWithAd, showBannerAd, hideBannerAd } from '../utils/shareHelper';
import BannerAdBar from '../components/BannerAdBar';

// Access external libraries from the window object
declare const jspdf: any;
declare const jscanify: any;
declare const JSZip: any;
declare const Tesseract: any; // NEW: for OCR text extraction

type ScanFilter = 'none' | 'document' | 'magic_color' | 'bw' | 'grayscale';

interface CapturedPage {
  original: string;
  processed: string;
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
  return `${Math.random().toString(36).substr(2, 9)}-${Date.now().toString(36)}`;
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

// FIX: helper that always draws the source image onto a *fresh* canvas sized
// to that image, instead of relying on a possibly-stale shared canvas ref.
const drawImageToFreshCanvas = (img: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(img, 0, 0);
  return canvas;
};

const Scan: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<any>(null);
  const pageCounterRef = useRef(0);
  const dragItemIndex = useRef<number | null>(null); // NEW: for drag-to-reorder

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);

  // UI Steps: 'camera' | 'gallery' | 'preview'
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

  const [folderName, setFolderName] = useState("Scan_Project_01");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'JPG'>('PDF');

  // Top Bar 3-Dots Menu
  const [showTopMenu, setShowTopMenu] = useState(false);

  // Page Actions Bottom Sheet / Menu
  const [selectedMenuPage, setSelectedMenuPage] = useState<CapturedPage | null>(null);

  // Inline Page Rename State
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string>('');

  // Page Rename Modal State
  const [renameModalPage, setRenameModalPage] = useState<CapturedPage | null>(null);
  const [renameInputVal, setRenameInputVal] = useState<string>('');

  // Share Modal Toggles
  const [enablePassword, setEnablePassword] = useState(false);
  const [enableOCR, setEnableOCR] = useState(false);
  const [saveSeparately, setSaveSeparately] = useState(false);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Processing State
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);

  useEffect(() => {
    if (typeof jscanify !== 'undefined') {
      scannerRef.current = new jscanify();
    }

    // Support Android Native WebView callback: window.onScanComplete(base64Image)
    (window as any).onScanComplete = (base64Image: string) => {
      if (!base64Image) return;
      console.log('[Scan.tsx] Received scan from native bridge.');
      const formatted = base64Image.startsWith('data:image')
        ? base64Image
        : `data:image/jpeg;base64,${base64Image}`;
      processImage(formatted);
      setUiStep('gallery');
    };

    return () => {
      try {
        delete (window as any).onScanComplete;
      } catch {
        (window as any).onScanComplete = undefined;
      }
    };
  }, []);

  // Ensure video stream is attached to the video element whenever uiStep is 'camera'
  useEffect(() => {
    if (uiStep === 'camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [uiStep, stream]);

  // Hide banner ad when fullscreen camera viewfinder is open, restore when in gallery or preview
  useEffect(() => {
    if (uiStep === 'camera') {
      hideBannerAd();
    } else {
      showBannerAd('/scan');
    }
  }, [uiStep]);

  // FIX: release the camera if the component unmounts while it's still running
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  // FIX: revoke the last exported object URL when it's replaced or on unmount, to avoid leaking memory
  useEffect(() => {
    return () => {
      if (state.resultUrl) {
        try { URL.revokeObjectURL(state.resultUrl); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.resultUrl]);

  // FIX: reset crop/zoom/filter-editing state whenever a different page is opened,
  // so leftover crop state from a previous page can't leak into the next one
  useEffect(() => {
    if (previewPage) {
      setIsCropping(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPage?.id]);

  const setResult = (blob: Blob, filename: string) => {
    setState(prev => {
      if (prev.resultUrl) {
        try { URL.revokeObjectURL(prev.resultUrl); } catch { /* noop */ }
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
    // 1. Check if native Android Scanner bridge is available
    if ((window as any).AndroidScanner && typeof (window as any).AndroidScanner.startScan === 'function') {
      try {
        console.log('[Native Scanner] Triggering window.AndroidScanner.startScan()...');
        (window as any).AndroidScanner.startScan();
        return;
      } catch (e) {
        console.warn('Native AndroidScanner call failed, falling back to Web Camera:', e);
      }
    }

    // 2. Standard Web Camera fallback
    try {
      setState({ status: 'loading', progress: 0, message: 'Waking up camera...' });
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 1.7777777778 }
        },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setActiveTrack(mediaStream.getVideoTracks()[0]);
      setUiStep('camera');
      setState({ status: 'idle', progress: 0 });
    } catch (err) {
      console.error(err);
      alert("Camera access failed. Please check site permissions.");
      setState({ status: 'idle', progress: 0 });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setActiveTrack(null);
    }
    setUiStep('gallery');
  };

  // Back button handler: returns to previous UI step or navigates back to Home
  const handleBack = () => {
    if (uiStep === 'preview') {
      setUiStep('gallery');
    } else if (uiStep === 'camera') {
      stopCamera();
      setUiStep('gallery');
    } else {
      // In gallery mode: navigate back to Home / previous page
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }
  };

  // Rename a page
  const handleRenamePage = (pageId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCapturedPages(prev => prev.map(p => p.id === pageId ? { ...p, name: trimmed } : p));
    if (previewPage && previewPage.id === pageId) {
      setPreviewPage(prev => prev ? { ...prev, name: trimmed } : null);
    }
    if (selectedMenuPage && selectedMenuPage.id === pageId) {
      setSelectedMenuPage(prev => prev ? { ...prev, name: trimmed } : null);
    }
  };

  // Rotate a page 90 degrees clockwise
  const handleRotatePage = (pageId: string) => {
    const targetPage = capturedPages.find(p => p.id === pageId);
    if (!targetPage) return;

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

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedPages(prev => prev.map(p => {
        if (p.id === pageId) {
          return {
            ...p,
            processed: rotatedDataUrl,
            original: rotatedDataUrl,
            width: canvas.width,
            height: canvas.height,
          };
        }
        return p;
      }));
      if (previewPage && previewPage.id === pageId) {
        setPreviewPage(prev => prev ? {
          ...prev,
          processed: rotatedDataUrl,
          original: rotatedDataUrl,
          width: canvas.width,
          height: canvas.height,
        } : null);
      }
      if (selectedMenuPage && selectedMenuPage.id === pageId) {
        setSelectedMenuPage(prev => prev ? { ...prev, processed: rotatedDataUrl } : null);
      }
    };
    img.src = targetPage.processed;
  };

  // Export single page directly
  const handleExportSinglePage = async (page: CapturedPage, format: 'PDF' | 'JPG') => {
    try {
      triggerInterstitialAd();
      if (format === 'JPG') {
        const link = document.createElement('a');
        link.href = page.processed;
        link.download = `${page.name.replace(/\s+/g, '_')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const jspdfLib = (window as any).jspdf;
        const jsPDF = jspdfLib?.jsPDF || jspdfLib;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        addImageFitted(doc, page);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${page.name.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Export single page error:', err);
    }
  };

  // FIX: getCapabilities() isn't implemented in every browser (e.g. Safari, many desktop
  // browsers) and can throw outside the promise chain — guard the whole thing.
  useEffect(() => {
    if (!activeTrack) return;
    try {
      const caps = activeTrack.getCapabilities ? activeTrack.getCapabilities() : ({} as any);
      if ((caps as any).torch) {
        activeTrack.applyConstraints({
          advanced: [{ torch: isFlashOn }]
        } as any).catch(err => console.error("Flash error:", err));
      }
    } catch (err) {
      console.warn("Torch not supported on this device:", err);
    }
  }, [isFlashOn, activeTrack]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        processImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const rawData = canvas.toDataURL('image/jpeg', 0.95);
    processImage(rawData);
  };

  const processImage = (imageSrc: string) => {
    setState({ status: 'processing', progress: 40, message: 'Processing Document...' });
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      let finalCanvas: HTMLCanvasElement | null = null;

      if (isAutoMode && scannerRef.current) {
        try {
          // jscanify edge detection and perspective correction
          finalCanvas = scannerRef.current.extractPaper(img, img.width, img.height);
        } catch (e) {
          console.warn("Auto extraction failed, using raw capture", e);
        }
      }

      // FIX: previously this fell back to the shared `canvasRef.current`, which
      // only actually contained the right pixels right after capturePhoto().
      // For file uploads and native-bridge scans it could be stale/blank/wrong-sized.
      // Now we always build a correctly-sized canvas from the actual source image.
      if (!finalCanvas) {
        finalCanvas = drawImageToFreshCanvas(img);
      }

      const processedData = finalCanvas.toDataURL('image/jpeg', 0.85);
      pageCounterRef.current += 1;
      const newPage: CapturedPage = {
        original: imageSrc,
        processed: processedData,
        // FIX: default filter is now 'none' to match the unmodified processed
        // image actually stored here. Previously this said 'bw' even though
        // no B&W conversion had been applied yet, so opening the editor showed
        // "B&W" selected on a still-color thumbnail, and hitting Save without
        // touching anything would silently convert the page to black & white.
        filter: 'none',
        id: generateId(),
        name: `Page ${pageCounterRef.current}`,
        date: new Date().toLocaleDateString('en-GB'),
        width: finalCanvas.width,
        height: finalCanvas.height,
      };

      setCapturedPages(prev => [...prev, newPage]);
      setState({ status: 'idle', progress: 0 });

      // If auto mode is on, we stay in camera to allow continuous scanning
      if (!isAutoMode) {
         setUiStep('gallery');
         stopCamera();
      }
    };
    img.onerror = () => {
      setState({ status: 'error', progress: 0, message: 'Failed to load captured image.' });
      setTimeout(() => setState({ status: 'idle', progress: 0 }), 2000);
    };
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // NEW: drag-to-reorder handlers for the gallery grid
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
    setCapturedPages(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const applyFilterAndCrop = async (pageId: string, filter: ScanFilter, doCrop: boolean = false) => {
    const page = capturedPages.find(p => p.id === pageId);
    if (!page) return;

    setState({ status: 'processing', progress: 50, message: 'Applying changes...' });

    const img = new Image();
    img.src = page.original;
    await new Promise(resolve => img.onload = resolve);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setState({ status: 'idle', progress: 0 });
      return;
    }

    if (doCrop && croppedAreaPixels) {
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    }

    // Apply Filter
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (filter === 'grayscale') {
        const avg = (r + g + b) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      } else if (filter === 'bw') {
        const avg = (r + g + b) / 3;
        const val = avg > 128 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      } else if (filter === 'magic_color') {
        // Simple contrast/brightness boost
        data[i] = Math.min(255, r * 1.1 + 10);
        data[i + 1] = Math.min(255, g * 1.1 + 10);
        data[i + 2] = Math.min(255, b * 1.1 + 10);
      } else if (filter === 'document') {
        // High contrast B&W
        const avg = (r + g + b) / 3;
        const val = avg > 160 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const processedData = canvas.toDataURL('image/jpeg', 0.85);
    const { width, height } = canvas;

    setCapturedPages(prev => prev.map(p =>
      p.id === pageId ? { ...p, processed: processedData, filter, width, height } : p
    ));

    if (previewPage?.id === pageId) {
      setPreviewPage(prev => prev ? { ...prev, processed: processedData, filter, width, height } : null);
    }

    setState({ status: 'idle', progress: 0 });
    setIsCropping(false);
  };

  // NEW: runs OCR (via Tesseract.js, loaded as a window global the same way
  // jspdf/jscanify/JSZip are) across the exported pages and returns one
  // combined, human-readable text transcript.
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

  // NEW: wraps a finished export blob together with an OCR transcript (when
  // requested) into a single zip, or just saves the blob directly otherwise.
  const finalizeExport = async (mainBlob: Blob, mainFilename: string, targets: CapturedPage[]) => {
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
    triggerInterstitialAd();
    setHasDownloaded(false);
    const targets = isSelectMode
      ? capturedPages.filter(p => selectedIds.has(p.id))
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
          await finalizeExport(blob, `${targets[0].name.replace(/\s+/g, '_')}.jpg`, targets);
        } else {
          const zip = new JSZip();
          for (let i = 0; i < targets.length; i++) {
            const page = targets[i];
            const res = await fetch(page.processed);
            const blob = await res.blob();
            zip.file(`${page.name.replace(/\s+/g, '_')}.jpg`, blob);
            setState({ status: 'processing', progress: Math.round(((i + 1) / targets.length) * 90), message: `Adding ${page.name}...` });
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
        if (enablePassword) {
          const userPassword = window.prompt('Set a password for this PDF:');
          if (userPassword) {
            pdfOptions.encryption = {
              userPassword,
              ownerPassword: userPassword,
              userPermissions: ['print', 'modify', 'copy', 'annot-forms'],
            };
          }
        }

        if (saveSeparately) {
          const zip = new JSZip();
          for (let i = 0; i < targets.length; i++) {
            const page = targets[i];
            const doc = new jsPDF(pdfOptions);
            addImageFitted(doc, page);
            const pdfBlob = doc.output('blob');
            zip.file(`${page.name.replace(/\s+/g, '_')}.pdf`, pdfBlob);
            setState({ status: 'processing', progress: 30 + Math.round(((i + 1) / targets.length) * 60), message: `Zipping ${page.name}...` });
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
            setState({ status: 'processing', progress: Math.round(((i + 1) / targets.length) * 90), message: `Adding ${targets[i].name}...` });
          }
          const blob = doc.output('blob');
          await finalizeExport(blob, `${folderName}.pdf`, targets);
        }
      }
      setShowShareModal(false);
    } catch (e) {
      console.error(e);
      setState({ status: 'error', progress: 0, message: 'Export Error. Please try again.' });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020617] text-white flex flex-col overflow-hidden h-screen w-screen select-none font-sans transition-colors duration-500">
      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* 1. TOP NAVBAR (Gallery & Preview Mode) */}
      {(uiStep === 'gallery' || uiStep === 'preview') && (
        <div className="pt-12 pb-4 px-6 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-[100]">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
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
                          onBlur={(e) => { setFolderName(e.target.value || "New Document"); setIsRenamingFolder(false); }}
                          onKeyDown={(e) => e.key === 'Enter' && (setFolderName((e.target as any).value || "New Document"), setIsRenamingFolder(false))}
                          className="text-[10px] font-black text-teal-400 bg-teal-400/10 rounded px-2 outline-none border border-teal-400/30"
                        />
                      ) : (
                        <span onClick={() => setIsRenamingFolder(true)} className="text-[10px] font-black text-teal-400 uppercase tracking-widest cursor-pointer flex items-center gap-1.5 hover:text-teal-300">
                          {folderName} <i className="fas fa-pen text-[7px] opacity-30"></i>
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm font-black text-white uppercase mt-1 tracking-tight">
                      {isSelectMode ? `${selectedIds.size} Selected` : `DOCUMENTS (${capturedPages.length})`}
                    </h2>
                 </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 relative">
                 <a
                   href="/scanner.html"
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-bold hover:bg-teal-500/20 active:scale-95 transition-all"
                   title="Open Standalone scanner.html WebView Bridge Test Page"
                 >
                   <i className="fas fa-arrow-up-right-from-square text-[9px]"></i>
                   <span className="hidden sm:inline">HTML Bridge Test</span>
                 </a>
                 <button
                  type="button"
                  onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds(new Set()); }}
                  className={`w-10 h-10 flex items-center justify-center text-lg transition-all active:scale-90 ${isSelectMode ? 'text-teal-400' : 'text-white/40'}`}
                  title={isSelectMode ? 'Exit Select Mode' : 'Select Pages'}
                 >
                   <i className="fas fa-check-double"></i>
                 </button>
                 <button
                   type="button"
                   onClick={() => setShowTopMenu(!showTopMenu)}
                   className={`w-10 h-10 flex items-center justify-center text-lg active:scale-90 transition-transform ${showTopMenu ? 'text-teal-400' : 'text-white/40'}`}
                   title="More Options"
                 >
                   <i className="fas fa-ellipsis-v"></i>
                 </button>

                 {/* Top Dropdown Menu */}
                 {showTopMenu && (
                   <>
                     <div className="fixed inset-0 z-[150]" onClick={() => setShowTopMenu(false)}></div>
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
                           setSelectedIds(new Set(capturedPages.map(p => p.id)));
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

                       <div className="h-px bg-white/5 my-1"></div>

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

      {/* Hidden File Input for uploading documents */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 2. MAIN GALLERY CONTENT */}
      {uiStep === 'gallery' && (
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-40 bg-[#020617]">
          {!isSelectMode && capturedPages.length > 1 && (
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-3">
              Drag a page to reorder
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
             {/* ADD PAGE VIA CAMERA / NATIVE SCANNER */}
             {!isSelectMode && (
                <div
                  onClick={startCamera}
                  className="aspect-[3/4] rounded-2xl border-2 border-dashed border-teal-500/40 bg-teal-500/5 flex flex-col items-center justify-center text-teal-400 active:scale-95 transition-all cursor-pointer hover:bg-teal-500/10 hover:border-teal-400"
                >
                   <div className="w-12 h-12 rounded-xl bg-teal-500/15 flex items-center justify-center mb-3 text-xl text-teal-400">
                      <i className="fas fa-camera"></i>
                   </div>
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-center px-2">Scan Page</span>
                   <span className="text-[7px] text-teal-400/60 mt-0.5">Camera / Bridge</span>
                </div>
             )}

             {/* UPLOAD FROM GALLERY/FILES */}
             {!isSelectMode && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-white/40 active:scale-95 transition-all cursor-pointer hover:bg-white/10 hover:border-white/20"
                >
                   <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3 text-xl text-white/60">
                      <i className="fas fa-image"></i>
                   </div>
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-center px-2">Upload Image</span>
                   <span className="text-[7px] text-white/30 mt-0.5">From Device</span>
                </div>
             )}

             {capturedPages.map((p, index) => (
               <div
                 key={p.id}
                 className="flex flex-col animate-in zoom-in duration-300"
                 draggable={!isSelectMode}
                 onDragStart={() => handleDragStart(index)}
                 onDragOver={handleDragOver}
                 onDrop={() => handleDrop(index)}
               >
                  <div
                    onClick={() => isSelectMode ? toggleSelect(p.id) : (setPreviewPage(p), setUiStep('preview'))}
                    className={`relative aspect-[3/4] bg-white/5 rounded-2xl overflow-hidden shadow-2xl border-2 transition-all cursor-pointer ${selectedIds.has(p.id) ? 'border-teal-500 ring-4 ring-teal-500/20' : 'border-white/5'}`}
                  >
                     <img src={p.processed} className="w-full h-full object-cover" alt="" />

                     {selectedIds.has(p.id) && (
                        <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center animate-in fade-in duration-200">
                           <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center text-white text-lg shadow-xl border-4 border-white">
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
                       className="absolute top-2 right-2 w-7 h-7 bg-black/40 hover:bg-teal-500 hover:text-black backdrop-blur-md rounded-full flex items-center justify-center text-white text-[10px] shadow-md transition-all active:scale-90 z-10 cursor-pointer"
                       title="Page Options"
                     >
                        <i className="fas fa-ellipsis-h"></i>
                     </button>

                     <div className="absolute bottom-2 left-2 bg-black/30 backdrop-blur-md text-white/70 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                        {index + 1}
                     </div>

                     <div className="absolute bottom-2 right-2 bg-white/10 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow-sm">
                        <span className="opacity-60">{index + 1}</span>
                        <i className="fas fa-file-pdf text-teal-400"></i>
                     </div>
                  </div>

                  <div className="pt-2 px-1">
                    {editingPageId === p.id ? (
                      <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
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
                          title="Save Name"
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
                          title="Click to rename page"
                        >
                          <span className="text-[10px] font-black text-white/90 uppercase truncate group-hover/name:text-teal-300 transition-colors">
                            {p.name}
                          </span>
                          <i className="fas fa-pencil text-[7px] text-teal-400/40 group-hover/name:text-teal-400 transition-colors"></i>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMenuPage(p);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-teal-400 transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
                          title="Page Options"
                        >
                          <i className="fas fa-ellipsis-v text-[9px]"></i>
                        </button>
                      </div>
                    )}
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-tighter">{p.date}</span>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* 3. FLOATING CAMERA & DOWNLOAD/EXPORT BUTTONS */}
      {uiStep === 'gallery' && !isSelectMode && (
        <div className="fixed bottom-12 right-8 flex flex-col items-end gap-5 z-[200]">
           <button
            onClick={() => setShowShareModal(true)}
            disabled={capturedPages.length === 0}
            title="Download & Export Documents"
            aria-label="Download & Export Documents"
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-2xl transition-all active:scale-90 ${capturedPages.length > 0 ? 'bg-white/10 text-white backdrop-blur-xl border border-white/10 hover:bg-white/20' : 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5'}`}
           >
             <i className="fas fa-arrow-down text-xl"></i>
           </button>
           <button
            onClick={startCamera}
            className="w-20 h-20 bg-teal-500 rounded-[2rem] flex items-center justify-center text-white text-3xl shadow-[0_20px_60px_-15px_rgba(20,184,166,0.6)] active:scale-90 transition-all border-4 border-white/20 hover:brightness-110"
           >
             <i className="fas fa-camera"></i>
           </button>
        </div>
      )}

      {/* 4. SELECTION FOOTER (Delete Button) */}
      {uiStep === 'gallery' && isSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0f172a] p-8 pb-14 border-t border-white/5 flex gap-5 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[300] animate-in slide-in-from-bottom duration-300">
           <button
             onClick={() => {
                setCapturedPages(prev => prev.filter(p => !selectedIds.has(p.id)));
                setSelectedIds(new Set());
                setIsSelectMode(false);
             }}
             disabled={selectedIds.size === 0}
             className="flex-1 bg-rose-500/10 text-rose-500 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest disabled:opacity-20 active:scale-95 transition-all border border-rose-500/20 flex items-center justify-center gap-3"
           >
             <i className="fas fa-trash-alt"></i> DELETE ({selectedIds.size})
           </button>
           <button
             onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
             className="flex-1 bg-white/5 text-white/40 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest active:scale-95 transition-all border border-white/5"
           >
             CANCEL
           </button>
        </div>
      )}

      {/* 5. FULLSCREEN CAMERA INTERFACE */}
      {uiStep === 'camera' && (
        <div className="absolute inset-0 z-[500] flex flex-col bg-black animate-in fade-in duration-300 overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            onLoadedMetadata={() => videoRef.current?.play()}
          ></video>

          <div className="absolute top-12 left-0 right-0 px-8 flex justify-between items-center z-[510]">
            <button onClick={stopCamera} className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform flex items-center justify-center border border-white/10">
              <i className="fas fa-times text-xl"></i>
            </button>
            <div className="bg-black/40 backdrop-blur-md p-1 rounded-2xl border border-white/10 flex">
               <button onClick={() => setIsAutoMode(true)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isAutoMode ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/30' : 'text-white/60'}`}>Auto</button>
               <button onClick={() => setIsAutoMode(false)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${!isAutoMode ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/30' : 'text-white/60'}`}>Manual</button>
            </div>
            <button onClick={() => setIsFlashOn(!isFlashOn)} className={`w-12 h-12 rounded-full backdrop-blur-md transition-all active:scale-90 flex items-center justify-center border border-white/10 ${isFlashOn ? 'bg-orange-500 text-white border-orange-400' : 'bg-black/40 text-white'}`}>
              <i className={`fas ${isFlashOn ? 'fa-bolt' : 'fa-bolt-slash'}`}></i>
            </button>
          </div>

          {isAutoMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="w-[80%] aspect-[3/4] border-2 border-teal-500/30 rounded-3xl relative">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-teal-500 rounded-tl-xl"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-teal-500 rounded-tr-xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-teal-500 rounded-bl-xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-teal-500 rounded-br-xl"></div>
                  <div className="absolute inset-0 bg-teal-500/5 animate-pulse"></div>
               </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-10 pb-16 flex items-center justify-between px-16 bg-gradient-to-t from-black/80 to-transparent z-[510]">
             <div className="w-16 h-16 rounded-2xl border-2 border-white/20 overflow-hidden bg-black/40 backdrop-blur-md cursor-pointer flex items-center justify-center" onClick={() => setUiStep('gallery')}>
                {capturedPages.length > 0 ? <img src={capturedPages[capturedPages.length-1].processed} className="w-full h-full object-cover" alt="" /> : <i className="fas fa-images text-white/20"></i>}
             </div>

             <button
              onClick={capturePhoto}
              className="w-24 h-24 rounded-full border-[8px] border-white/20 p-2 active:scale-95 transition-all shadow-2xl group relative"
             >
                <div className="w-full h-full bg-white rounded-full group-hover:scale-95 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.3)]"></div>
                {isAutoMode && <div className="absolute -inset-2 border-2 border-teal-500 rounded-full animate-ping opacity-20"></div>}
             </button>

             <button onClick={() => setUiStep('gallery')} className="w-16 h-16 flex flex-col items-center justify-center text-white bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 active:scale-95 transition-all">
                <span className="text-xl font-black">{capturedPages.length}</span>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Docs</span>
             </button>
          </div>
        </div>
      )}

      {/* 6. IMAGE PREVIEW & EDITOR STEP */}
      {uiStep === 'preview' && previewPage && (
        <div className="absolute inset-0 z-[600] bg-[#020617] flex flex-col animate-in slide-in-from-right duration-300">
           <div className="pt-12 pb-4 px-6 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl">
              <button onClick={() => setUiStep('gallery')} className="w-10 h-10 flex items-center justify-center text-white/60 text-xl active:scale-90 transition-transform">
                <i className="fas fa-times"></i>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenameModalPage(previewPage);
                  setRenameInputVal(previewPage.name);
                }}
                className="text-xs font-black uppercase tracking-widest text-teal-400 flex items-center gap-1.5 hover:text-teal-300 transition-colors cursor-pointer"
                title="Rename Page"
              >
                <span className="truncate max-w-[160px]">{previewPage.name}</span>
                <i className="fas fa-pencil text-[8px] opacity-50"></i>
              </button>
              <button
                onClick={async () => {
                  await applyFilterAndCrop(previewPage.id, previewPage.filter, isCropping);
                  setUiStep('gallery');
                }}
                className="bg-teal-500 text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
              >
                Save
              </button>
           </div>

           <div className="flex-1 relative bg-black overflow-hidden flex items-center justify-center">
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
                <img src={previewPage.processed} className="max-w-full max-h-full object-contain shadow-2xl" alt="" />
              )}
           </div>

           <div className="bg-[#0f172a] p-6 pb-12 border-t border-white/5 flex flex-col gap-6">
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
                 {[
                   { id: 'none', label: 'Original', icon: 'fa-image' },
                   { id: 'magic_color', label: 'Magic', icon: 'fa-wand-magic-sparkles' },
                   { id: 'document', label: 'Doc', icon: 'fa-file-lines' },
                   { id: 'bw', label: 'B&W', icon: 'fa-circle-half-stroke' },
                   { id: 'grayscale', label: 'Gray', icon: 'fa-palette' },
                 ].map((f) => (
                   <button
                    key={f.id}
                    onClick={() => applyFilterAndCrop(previewPage.id, f.id as ScanFilter)}
                    className={`flex flex-col items-center gap-2 min-w-[70px] transition-all active:scale-90 ${previewPage.filter === f.id ? 'text-teal-400' : 'text-white/30'}`}
                   >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg border-2 transition-all ${previewPage.filter === f.id ? 'bg-teal-400/10 border-teal-400' : 'bg-white/5 border-transparent'}`}>
                         <i className={`fas ${f.icon}`}></i>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest">{f.label}</span>
                   </button>
                 ))}
              </div>

              <div className="flex gap-3">
                 <button
                  type="button"
                  onClick={() => setIsCropping(!isCropping)}
                  className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer ${isCropping ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'}`}
                 >
                    <i className="fas fa-crop-simple"></i> {isCropping ? 'Done' : 'Crop'}
                 </button>
                 <button
                  type="button"
                  onClick={() => handleRotatePage(previewPage.id)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                 >
                    <i className="fas fa-rotate-right"></i> Rotate
                 </button>
                 <button
                  type="button"
                  onClick={() => {
                    setCapturedPages(prev => prev.filter(p => p.id !== previewPage.id));
                    setUiStep('gallery');
                  }}
                  className="flex-1 py-4 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                 >
                    <i className="fas fa-trash-alt"></i> Delete
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 7. SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-xl animate-in fade-in flex items-end">
           <div className="w-full bg-white text-slate-900 rounded-t-[3rem] p-8 pb-16 animate-in slide-in-from-bottom duration-500 max-w-2xl mx-auto shadow-2xl flex flex-col gap-8">
              <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                 <div className="w-16 h-16 bg-blue-500 text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-blue-500/20">
                    <i className="fas fa-arrow-down"></i>
                 </div>
                 <div className="flex-1">
                    <h3 className="text-xl font-black truncate">{folderName}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{capturedPages.length} Documents | Local Assets</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-bold text-slate-700">Output Mode</span>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                       <button onClick={() => setExportFormat('PDF')} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${exportFormat === 'PDF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>PDF</button>
                       <button onClick={() => setExportFormat('JPG')} className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${exportFormat === 'JPG' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>JPG</button>
                    </div>
                 </div>

                 {[
                   { label: 'Save Separately (ZIP File)', value: saveSeparately, setter: setSaveSeparately },
                   { label: 'Enable Password Protection', value: enablePassword, setter: setEnablePassword, disabled: exportFormat === 'JPG' },
                   // FIX/FEATURE: OCR is now a real, working feature instead of a
                   // permanently-disabled "coming soon" toggle.
                   { label: 'Extract OCR Text', value: enableOCR, setter: setEnableOCR },
                 ].map((item, idx) => (
                   <div key={idx} className={`flex items-center justify-between py-3.5 border-b border-slate-50 ${item.disabled ? 'opacity-40' : ''}`}>
                      <span className="text-sm font-bold text-slate-700">{item.label}</span>
                      <button
                        disabled={item.disabled}
                        onClick={() => item.setter(!item.value)}
                        className={`w-12 h-6 rounded-full transition-all relative ${item.value ? 'bg-blue-500' : 'bg-slate-200'} ${item.disabled ? 'cursor-not-allowed' : ''}`}
                      >
                         <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${item.value ? 'left-7' : 'left-1'}`}></div>
                      </button>
                   </div>
                 ))}
              </div>

              <div className="flex gap-4 mt-4">
                 <button onClick={() => setShowShareModal(false)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-black text-slate-400 uppercase tracking-widest text-xs active:scale-95 transition-all">CANCEL</button>
                 <button onClick={handleExport} className="flex-1 py-5 bg-[#1d3345] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-download"></i> DOWNLOAD &amp; SAVE
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 7b. PAGE ACTIONS BOTTOM SHEET / MODAL */}
      {selectedMenuPage && (
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#0f172a] text-white border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl p-6 pb-10 sm:pb-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            {/* Header with thumbnail */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <img
                src={selectedMenuPage.processed}
                alt={selectedMenuPage.name}
                className="w-12 h-16 object-cover rounded-xl border border-white/10 shadow shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-white uppercase truncate">{selectedMenuPage.name}</h3>
                <p className="text-[10px] text-white/40">{selectedMenuPage.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMenuPage(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm cursor-pointer"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Menu Actions */}
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const page = selectedMenuPage;
                  setSelectedMenuPage(null);
                  setRenameModalPage(page);
                  setRenameInputVal(page.name);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer"
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer"
              >
                <i className="fas fa-crop-simple text-blue-400 w-5"></i>
                <span>Edit, Crop &amp; Filters</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleRotatePage(selectedMenuPage.id);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer"
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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer"
              >
                <i className="fas fa-file-pdf text-amber-400 w-5"></i>
                <span>Download this Page as PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExportSinglePage(selectedMenuPage, 'JPG');
                  setSelectedMenuPage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all active:scale-98 cursor-pointer"
              >
                <i className="fas fa-file-image text-cyan-400 w-5"></i>
                <span>Download this Page as JPG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const pageId = selectedMenuPage.id;
                  setCapturedPages(prev => prev.filter(p => p.id !== pageId));
                  setSelectedMenuPage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs transition-all active:scale-98 border border-rose-500/20 cursor-pointer"
              >
                <i className="fas fa-trash-can w-5"></i>
                <span>Delete Page</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7c. DEDICATED PAGE RENAME MODAL */}
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
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 text-sm cursor-pointer"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-white/40">
                Page Name
              </label>
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
                placeholder="e.g. Aadhaar Front, Bill Page 1..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameModalPage(null)}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRenamePage(renameModalPage.id, renameInputVal);
                  setRenameModalPage(null);
                }}
                className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. PROCESSING & SUCCESS OVERLAYS */}
      {(state.status === 'processing' || state.status === 'loading') && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center text-white animate-in fade-in">
           <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-[8px] border-white/5 rounded-full"></div>
              <div className="absolute inset-0 border-[8px] border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-teal-500 text-2xl font-black">{state.progress}%</div>
           </div>
           <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Working...</h2>
           <p className="text-white/40 font-black uppercase text-[10px] tracking-[0.4em]">{state.message}</p>
        </div>
      )}

      {state.status === 'success' && (
        <div className="fixed inset-0 z-[3000] bg-[#020617] flex flex-col justify-between items-center text-center animate-in zoom-in duration-500 overflow-y-auto">
           <div className="flex-1 flex flex-col items-center justify-center p-8 w-full max-w-sm mx-auto my-auto">
             <div className="w-28 h-28 bg-teal-500 text-white text-5xl rounded-[3rem] flex items-center justify-center mb-8 shadow-2xl border-4 border-white/20 animate-bounce shrink-0">
                <i className="fas fa-check-double"></i>
             </div>
             <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">DONE!</h2>
             <p className="text-white/30 mb-8 font-black text-xs uppercase tracking-[0.25em]">Project exported to local disk.</p>
             <div className="flex flex-col gap-3.5 w-full">
                {/* 1. DOWNLOAD BUTTON (Invokes Ad then downloads) */}
                <button
                  type="button"
                  onClick={() => {
                    downloadFileWithAd(
                      state.resultUrl!,
                      state.resultFileName || `${folderName}.${exportFormat.toLowerCase()}`
                    );
                    setHasDownloaded(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-white py-5 px-6 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tight cursor-pointer"
                >
                  <i className="fas fa-file-download text-2xl"></i> DOWNLOAD
                </button>

                {/* 2. SHARE BUTTON: ALWAYS VISIBLE when file is ready! */}
                {state.resultUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      shareFileViaAndroidBridge(
                        state.resultUrl!,
                        state.resultFileName || `${folderName}.${exportFormat.toLowerCase()}`
                      )
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white py-4.5 px-6 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-tight ring-4 ring-indigo-400/30 cursor-pointer"
                  >
                    <i className="fas fa-share-nodes text-xl"></i> SHARE FILE
                  </button>
                )}

                <button
                  onClick={() => {
                    setState({ status: 'idle', progress: 0 });
                    setHasDownloaded(false);
                    setUiStep('gallery');
                  }}
                  className="text-white/40 font-black text-[10px] uppercase tracking-[0.4em] py-4 hover:text-teal-400 transition-colors"
                >
                  BACK TO FOLDER
                </button>
             </div>
           </div>

           {/* Dedicated Banner Ad Reserved Space at Bottom */}
           <div className="w-full shrink-0">
             <BannerAdBar isOverlay={true} />
           </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default Scan;