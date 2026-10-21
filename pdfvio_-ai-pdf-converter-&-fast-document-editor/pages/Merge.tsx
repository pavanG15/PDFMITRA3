import React, { useState, useRef } from 'react';
import Dropzone from '../components/Dropzone';
import { ProcessingState } from '../types';
import {
  shareFileViaAndroidBridge,
  downloadFileWithAd,
  isAndroidBridgeAvailable,
} from '../utils/shareHelper';
import BannerAdBar from '../components/BannerAdBar';
import DownloadSuccessAdArea from '../components/DownloadSuccessAdArea';
import QuickCompressModal from '../components/QuickCompressModal';

declare const PDFLib: any;

const Merge: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });
  const [hasDownloaded, setHasDownloaded] = useState(false);
  const [quickCompressModalOpen, setQuickCompressModalOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [resultSizeBytes, setResultSizeBytes] = useState<number>(0);

  const addFileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: File[]) => {
    if (!newFiles || newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleAddFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...added]);
      // Reset input value so same files can be re-selected if desired
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    setFiles((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
  };

  /**
   * Converts any image file (JPG, PNG, WebP) into JPEG ArrayBuffer ready to embed into PDFDocument
   */
  const convertImageToJpegBytes = async (file: File): Promise<{ bytes: ArrayBuffer; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context unavailable');
          }

          // Fill clean white background in case image has alpha channel
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                reject(new Error(`Failed to encode image ${file.name}`));
                return;
              }
              const buffer = await blob.arrayBuffer();
              resolve({ bytes: buffer, width, height });
            },
            'image/jpeg',
            0.92
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Could not load image: ${file.name}`));
      };

      img.src = objectUrl;
    });
  };

  const isImageFile = (file: File): boolean => {
    return (
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(file.name)
    );
  };

  const startMerge = async () => {
    if (files.length < 2) return;

    setState({ status: 'processing', progress: 10, message: 'Initializing PDF merger...' });
    setShowShareModal(false);

    try {
      const win = window as any;
      const pdfLibInstance = win.PDFLib || (typeof PDFLib !== 'undefined' ? PDFLib : null);

      if (!pdfLibInstance || !pdfLibInstance.PDFDocument) {
        throw new Error('PDF Engine (PDF-Lib) is still loading. Please check internet connection or retry in a moment.');
      }

      const mergedPdf = await pdfLibInstance.PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const percent = Math.round(((i + 1) / files.length) * 85);

        setState((prev) => ({
          ...prev,
          progress: Math.max(15, percent),
          message: `Merging ${file.name} (${i + 1} of ${files.length})...`,
        }));

        if (isImageFile(file)) {
          // Process and embed image as an A4 page
          const { bytes: imgBytes } = await convertImageToJpegBytes(file);
          const embeddedImg = await mergedPdf.embedJpg(imgBytes);

          // Standard A4 dimensions in PDF points (72 DPI): 595.28 x 841.89
          const a4W = 595.28;
          const a4H = 841.89;
          const page = mergedPdf.addPage([a4W, a4H]);

          const imgW = embeddedImg.width;
          const imgH = embeddedImg.height;
          const margin = 24; // 24pt margins
          const maxW = a4W - margin * 2;
          const maxH = a4H - margin * 2;

          const scale = Math.min(maxW / imgW, maxH / imgH);
          const drawW = imgW * scale;
          const drawH = imgH * scale;

          const x = (a4W - drawW) / 2;
          const y = (a4H - drawH) / 2;

          page.drawImage(embeddedImg, {
            x,
            y,
            width: drawW,
            height: drawH,
          });
        } else {
          // Process and copy PDF pages
          const bytes = await file.arrayBuffer();
          const pdfDoc = await pdfLibInstance.PDFDocument.load(bytes, {
            ignoreEncryption: true,
          });

          const pageIndices = pdfDoc.getPageIndices();
          if (pageIndices.length === 0) {
            continue;
          }

          const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
          copiedPages.forEach((p: any) => mergedPdf.addPage(p));
        }
      }

      setState({ status: 'processing', progress: 95, message: 'Finalizing merged document...' });

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setResultSizeBytes(blob.size);

      // Clean default file name based on first file
      const firstBaseName = files[0].name.replace(/\.[^/.]+$/, '').trim().replace(/\s+/g, '_');
      const finalFileName = `${firstBaseName}_Merged.pdf`;

      // Bridge notification if running inside Android WebView
      if (typeof window !== 'undefined' && win.AndroidBridge) {
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64Data = reader.result as string;
            if (typeof win.AndroidBridge.downloadFile === 'function') {
              win.AndroidBridge.downloadFile(base64Data, finalFileName);
            }
          };
        } catch (bridgeErr) {
          console.warn('[Merge] Bridge save notice failed:', bridgeErr);
        }
      }

      setState({
        status: 'success',
        progress: 100,
        resultUrl: url,
        resultFileName: finalFileName,
      });
    } catch (error: any) {
      console.error('[Merge] Error during merge:', error);
      setState({
        status: 'error',
        progress: 0,
        message: error?.message || 'Unable to merge documents. Please check file formats and try again.',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white">
      {/* Hidden file input for adding more files */}
      <input
        ref={addFileInputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        onChange={handleAddFilesChange}
        className="hidden"
      />

      {/* 1. INITIAL EMPTY STATE */}
      {!files.length ? (
        <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 text-center">
          <div className="w-20 h-20 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-[2rem] flex items-center justify-center text-3xl mx-auto mb-6 shadow-xl shadow-teal-500/5">
            <i className="fas fa-layer-group"></i>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black mb-3 uppercase tracking-tight">
            Merge Documents
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold mb-10 max-w-md mx-auto text-xs uppercase tracking-wider">
            Combine multiple PDF documents and photos into one unified PDF file.
          </p>

          <Dropzone
            onFilesSelected={handleFiles}
            multiple
            accept="application/pdf,image/*"
            title="Add PDF or Image Files"
            description="Select multiple documents or images to combine"
            icon="fa-file-circle-plus"
          />

          <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <i className="fas fa-file-pdf text-rose-500"></i> PDF Documents
            </span>
            <span className="flex items-center gap-1.5">
              <i className="fas fa-file-image text-indigo-500"></i> JPG / PNG Photos
            </span>
            <span className="flex items-center gap-1.5">
              <i className="fas fa-shield-halved text-emerald-500"></i> 100% Offline
            </span>
          </div>
        </div>
      ) : (
        /* 2. LOADED QUEUE MANAGER */
        <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300">
          {/* Sticky Top Header */}
          <div className="p-4 pt-6 sm:pt-8 flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs sticky top-0 z-30">
            <div className="flex justify-between items-center px-1">
              <button
                type="button"
                onClick={() => setFiles([])}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                title="Back to start"
              >
                <i className="fas fa-arrow-left text-lg"></i>
              </button>
              <div className="flex-1 px-4 text-center">
                <h2 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white">
                  Merge Manager
                </h2>
                <p className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest">
                  {files.length} {files.length === 1 ? 'Document' : 'Documents'} in Queue
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-rose-500 hover:text-rose-600 font-black text-xs uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Document Cards List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 max-w-2xl w-full mx-auto no-scrollbar">
            {files.map((file, i) => {
              const isImg = isImageFile(file);
              return (
                <div
                  key={`${file.name}-${i}`}
                  className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 group transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Index & Type Icon */}
                    <div className="relative shrink-0">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                          isImg
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                        }`}
                      >
                        <i className={`fas ${isImg ? 'fa-file-image' : 'fa-file-pdf'}`}></i>
                      </div>
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h3
                        className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate"
                        title={file.name}
                      >
                        {file.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-slate-400">
                        <span className="uppercase tracking-wider font-mono">
                          {formatFileSize(file.size)}
                        </span>
                        <span>·</span>
                        <span className="uppercase text-slate-500 dark:text-slate-400 font-semibold">
                          {isImg ? 'Image Page' : 'PDF Document'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ordering & Remove Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Move Up */}
                    <button
                      type="button"
                      onClick={() => moveFile(i, 'up')}
                      disabled={i === 0}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs transition-colors disabled:opacity-20 disabled:pointer-events-none active:scale-95"
                      title="Move Up"
                    >
                      <i className="fas fa-chevron-up"></i>
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      onClick={() => moveFile(i, 'down')}
                      disabled={i === files.length - 1}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs transition-colors disabled:opacity-20 disabled:pointer-events-none active:scale-95"
                      title="Move Down"
                    >
                      <i className="fas fa-chevron-down"></i>
                    </button>

                    {/* Remove File */}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-500 flex items-center justify-center text-xs transition-colors active:scale-95 ml-1"
                      title="Remove file"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Tap to Add More Files container */}
            <div
              onClick={() => addFileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 rounded-3xl p-5 text-center cursor-pointer transition-all flex items-center justify-center gap-3 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 active:scale-[0.99] bg-white/50 dark:bg-slate-900/50"
            >
              <i className="fas fa-plus-circle text-xl text-teal-500"></i>
              <span className="text-xs font-black uppercase tracking-wider">
                Add More PDFs or Photos
              </span>
            </div>
          </div>

          {/* Sticky Bottom Action Bar with Working Add Button (+) */}
          <div
            className="bg-white dark:bg-slate-900 p-4 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3 shadow-2xl z-30 max-w-2xl w-full mx-auto"
            style={{
              paddingBottom: 'calc(var(--bottom-nav-total-padding, 96px) + 0.75rem)',
            }}
          >
            {/* Working Add Button (+) */}
            <button
              type="button"
              onClick={() => addFileInputRef.current?.click()}
              className="w-14 h-14 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center text-2xl active:scale-90 transition-transform shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
              title="Add more documents or images"
            >
              <i className="fas fa-plus"></i>
            </button>

            {/* Merge Documents Action Button */}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              disabled={files.length < 2}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-teal-500/20 active:scale-95 transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="fas fa-layer-group text-base"></i>
              <span>
                {files.length < 2
                  ? 'Add at least 2 files'
                  : `Merge Documents (${files.length})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 3. OPTIONAL SETTINGS / PRE-MERGE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md animate-in fade-in flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-8 animate-in slide-in-from-bottom duration-300 max-w-lg mx-auto shadow-2xl flex flex-col gap-6 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
            <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="w-14 h-14 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                <i className="fas fa-layer-group"></i>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black truncate">Merge Confirmation</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Combining {files.length} Documents into Single PDF
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <i className="fas fa-shield-alt text-teal-500"></i>
                    <span>PDF Password Protection</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnablePassword(!enablePassword)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      enablePassword ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-xs ${
                        enablePassword ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {enablePassword && (
                  <input
                    type="password"
                    placeholder="Enter secure document password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 p-3 rounded-xl border border-teal-500/30 text-xs font-bold text-slate-900 dark:text-white outline-none mt-2"
                  />
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Output Format:</span>
                <span className="font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest font-mono">
                  Adobe PDF (.pdf)
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startMerge}
                className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-teal-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fas fa-bolt"></i>
                <span>Merge Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PROCESSING STATE OVERLAY */}
      {(state.status === 'processing' || state.status === 'loading') && (
        <div className="fixed inset-0 z-[30000] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center text-white">
          <div className="relative w-28 h-28 mb-8">
            <div className="absolute inset-0 border-[6px] border-white/10 rounded-full" />
            <div className="absolute inset-0 border-[6px] border-teal-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-teal-400 text-xl font-black">
              {state.progress}%
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">Merging Documents</h2>
          <p className="text-white/60 font-mono text-xs max-w-sm px-4">
            {state.message || 'Combining streams and pages...'}
          </p>
        </div>
      )}

      {/* 5. ERROR STATE OVERLAY */}
      {state.status === 'error' && (
        <div className="fixed inset-0 z-[30000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center text-white">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center text-3xl mb-6">
            <i className="fas fa-triangle-exclamation"></i>
          </div>
          <h3 className="text-xl font-black uppercase mb-2">Merge Failed</h3>
          <p className="text-xs text-white/70 max-w-sm mb-6">{state.message}</p>
          <button
            type="button"
            onClick={() => setState({ status: 'idle', progress: 0 })}
            className="px-8 py-3.5 rounded-2xl bg-teal-500 text-slate-950 font-black text-xs uppercase tracking-widest cursor-pointer"
          >
            Dismiss &amp; Try Again
          </button>
        </div>
      )}

      {/* 6. SUCCESS VIEW */}
      {state.status === 'success' && (
        <div className="fixed inset-0 z-[99999] bg-[#020617] text-white flex flex-col justify-between items-center text-center animate-in zoom-in duration-300 overflow-y-auto no-scrollbar">
          <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto my-auto space-y-6">
            <div className="w-24 h-24 bg-teal-500 text-slate-950 text-4xl rounded-[2.5rem] flex items-center justify-center shadow-2xl border-4 border-white/20 shrink-0">
              <i className="fas fa-check-double"></i>
            </div>

            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                MERGED!
              </h2>
              <p className="text-slate-400 font-mono text-xs font-bold truncate max-w-full px-2 mt-1">
                {state.resultFileName || 'merged_document.pdf'}
              </p>
              {resultSizeBytes > 0 && (
                <span className="inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full bg-teal-950 text-teal-300 border border-teal-500/30">
                  {formatFileSize(resultSizeBytes)} · {files.length} Files Combined
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full">
              {/* DOWNLOAD BUTTON */}
              <button
                type="button"
                onClick={() => {
                  downloadFileWithAd(
                    state.resultUrl!,
                    state.resultFileName || 'merged_document.pdf'
                  );
                  setHasDownloaded(true);
                }}
                className="bg-orange-500 hover:bg-orange-600 text-white py-4 px-6 rounded-2xl font-black text-lg shadow-2xl shadow-orange-500/25 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase cursor-pointer"
              >
                <i className="fas fa-file-download text-xl"></i> DOWNLOAD PDF
              </button>

              {/* COMPRESS PDF BUTTON */}
              {state.resultUrl && (
                <button
                  type="button"
                  onClick={() => setQuickCompressModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 py-3.5 px-6 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase cursor-pointer"
                  title="Compress PDF (<100KB, <200KB, <50KB)"
                >
                  <i className="fas fa-file-zipper text-lg"></i> COMPRESS PDF
                </button>
              )}

              {/* SHARE BUTTON */}
              {state.resultUrl && (
                <button
                  type="button"
                  onClick={() =>
                    shareFileViaAndroidBridge(
                      state.resultUrl!,
                      state.resultFileName || 'merged_document.pdf'
                    )
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-6 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 uppercase cursor-pointer"
                >
                  <i className="fas fa-share-nodes text-lg"></i> SHARE FILE
                </button>
              )}

              {/* START NEW MERGE */}
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setHasDownloaded(false);
                  setState({ status: 'idle', progress: 0 });
                }}
                className="text-white/40 font-black text-[10px] uppercase tracking-[0.25em] py-3 hover:text-teal-400 transition-colors cursor-pointer"
              >
                START NEW MERGE
              </button>
            </div>

            {hasDownloaded && (
              <DownloadSuccessAdArea
                downloadKey={state.resultFileName || 'merged_document.pdf'}
              />
            )}
          </div>

          {/* Quick Compress Modal */}
          {quickCompressModalOpen && state.resultUrl && (
            <QuickCompressModal
              isOpen={quickCompressModalOpen}
              onClose={() => setQuickCompressModalOpen(false)}
              fileSource={state.resultUrl}
              fileName={state.resultFileName || 'merged_document.pdf'}
              fileType="pdf"
            />
          )}

          {/* Bottom AdMob slot */}
          <div className="w-full shrink-0">
            <BannerAdBar isOverlay={true} />
          </div>
        </div>
      )}

      {/* Bottom AdMob banner on idle/queue view */}
      {state.status !== 'success' && (
        <div className="w-full shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <BannerAdBar isOverlay={false} />
        </div>
      )}
    </div>
  );
};

export default Merge;
