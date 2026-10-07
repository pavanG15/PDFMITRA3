import React, { useState, useRef, useEffect } from 'react';
import Dropzone from '../components/Dropzone';
import { useLanguage } from '../i18n';
import { shareFileViaAndroidBridge, triggerInterstitialAd, downloadFileWithAd } from '../utils/shareHelper';

declare const pdfjsLib: any;
declare const JSZip: any;

export interface ConvertedPageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PDFtoJPGQueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  currentPage?: number;
  totalPages?: number;
  images: ConvertedPageImage[];
  zipBlob?: Blob;
  zipUrl?: string;
  error?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const PDFtoJPG: React.FC = () => {
  const { t, language } = useLanguage();
  const [queue, setQueue] = useState<PDFtoJPGQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);

  // Settings
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [resolution, setResolution] = useState<'high' | 'medium' | 'web'>('high');
  const [pageScope, setPageScope] = useState<'all' | 'firstOnly'>('all');

  // Preview Modal
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [isZippingAll, setIsZippingAll] = useState<boolean>(false);
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    document.title = `${t('brandName')} - ${t('toolPdfToJpgName')}`;
  }, [t, language]);

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      queue.forEach((item) => {
        if (item.zipUrl) {
          URL.revokeObjectURL(item.zipUrl);
        }
      });
    };
  }, [queue]);

  const handleAddFiles = (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length === 0) return;

    const newItems: PDFtoJPGQueueItem[] = pdfFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      originalSize: file.size,
      status: 'queued',
      progress: 0,
      images: [],
    }));

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.zipUrl) {
        URL.revokeObjectURL(target.zipUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAll = () => {
    if (isProcessingQueue) return;
    queue.forEach((item) => {
      if (item.zipUrl) {
        URL.revokeObjectURL(item.zipUrl);
      }
    });
    setQueue([]);
    setActiveItemIndex(-1);
  };

  const convertSingleFile = async (
    item: PDFtoJPGQueueItem
  ): Promise<{ images: ConvertedPageImage[]; zipBlob?: Blob; zipUrl?: string }> => {
    const buffer = await item.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const numPages = pdf.numPages;

    const scale = resolution === 'high' ? 2.0 : resolution === 'medium' ? 1.5 : 1.0;
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const quality = format === 'png' ? 1.0 : resolution === 'high' ? 0.92 : 0.82;

    const targetPages = pageScope === 'firstOnly' ? 1 : numPages;
    const convertedImages: ConvertedPageImage[] = [];

    for (let pageNum = 1; pageNum <= targetPages; pageNum++) {
      if (cancelProcessingRef.current) {
        throw new Error('Cancelled by user');
      }

      const pct = Math.round(((pageNum - 1) / targetPages) * 100);
      setQueue((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                progress: pct,
                currentPage: pageNum,
                totalPages: targetPages,
                message: `Rendering page ${pageNum} of ${targetPages}...`,
              }
            : it
        )
      );

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const dataUrl = canvas.toDataURL(mimeType, quality);
      convertedImages.push({
        pageNumber: pageNum,
        dataUrl,
        width: viewport.width,
        height: viewport.height,
      });

      // Yield event loop
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // If multiple pages, generate a ZIP for this document
    let zipBlob: Blob | undefined;
    let zipUrl: string | undefined;

    const zipLib = (window as any).JSZip;
    if (zipLib && convertedImages.length > 1) {
      try {
        const docZip = new zipLib();
        const baseName = item.name.replace(/\.pdf$/i, '');
        const ext = format === 'png' ? 'png' : 'jpg';

        convertedImages.forEach((img) => {
          const rawBase64 = img.dataUrl.replace(/^data:image\/(jpeg|png);base64,/, '');
          docZip.file(`${baseName}_page_${img.pageNumber}.${ext}`, rawBase64, { base64: true });
        });

        zipBlob = await docZip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 5 },
        });
        zipUrl = URL.createObjectURL(zipBlob);
      } catch (err) {
        console.warn('Individual ZIP generation error:', err);
      }
    }

    return {
      images: convertedImages,
      zipBlob,
      zipUrl,
    };
  };

  const startBatchConversion = async () => {
    if (queue.length === 0 || isProcessingQueue) return;

    cancelProcessingRef.current = false;
    setIsProcessingQueue(true);

    const queueSnapshot = [...queue];

    for (let i = 0; i < queueSnapshot.length; i++) {
      if (cancelProcessingRef.current) break;

      const currentItem = queueSnapshot[i];
      if (currentItem.status === 'completed') continue;

      setActiveItemIndex(i);

      setQueue((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? {
                ...it,
                status: 'processing',
                progress: 5,
                message: 'Opening document...',
              }
            : it
        )
      );

      try {
        const result = await convertSingleFile(currentItem);

        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'completed',
                  progress: 100,
                  images: result.images,
                  zipBlob: result.zipBlob,
                  zipUrl: result.zipUrl,
                  message: `${result.images.length} images ready`,
                }
              : it
          )
        );
      } catch (err: any) {
        console.error(`Error converting ${currentItem.name}:`, err);
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'error',
                  progress: 0,
                  error: err?.message || 'Conversion failed',
                }
              : it
          )
        );
      }
    }

    setIsProcessingQueue(false);
    setActiveItemIndex(-1);
  };

  const handleDownloadAllAsZip = async () => {
    triggerInterstitialAd();
    const completedItems = queue.filter((item) => item.status === 'completed' && item.images.length > 0);
    if (completedItems.length === 0) return;

    setIsZippingAll(true);

    try {
      const zipLib = (window as any).JSZip;
      if (!zipLib) throw new Error('ZIP library not loaded');

      const masterZip = new zipLib();
      const ext = format === 'png' ? 'png' : 'jpg';

      for (const item of completedItems) {
        const safeDocName = item.name.replace(/\.pdf$/i, '').replace(/[/\\?%*:|"<>]/g, '_');
        const folder = masterZip.folder(safeDocName);

        item.images.forEach((img) => {
          const rawBase64 = img.dataUrl.replace(/^data:image\/(jpeg|png);base64,/, '');
          folder.file(`page_${img.pageNumber}.${ext}`, rawBase64, { base64: true });
        });
      }

      const zipBlob = await masterZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `PDF_Images_Batch_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(zipUrl), 2000);
    } catch (err) {
      console.error('Master ZIP generation error:', err);
    } finally {
      setIsZippingAll(false);
    }
  };

  // Stats
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const isAllCompleted = queue.length > 0 && completedCount === queue.length;
  const totalOriginalBytes = queue.reduce((acc, it) => acc + it.originalSize, 0);
  const totalRenderedImages = queue.reduce((acc, it) => acc + it.images.length, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 transition-colors duration-300">
      {/* Hidden file input for adding more files */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleAddFiles(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 mb-2">
          <i className="fas fa-layer-group"></i>
          <span>{t('batchProcessing') || 'Batch Processing'} • 100% Private</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
          {t('toolPdfToJpgName')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium max-w-xl mx-auto text-xs sm:text-sm">
          {t('toolPdfToJpgDesc') || 'Render PDF pages as high-quality image files. Upload multiple files to convert in batch.'}
        </p>
      </div>

      {/* Conversion Options Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Format Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('imageFormat') || 'Format'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('jpg')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  format === 'jpg'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                JPG (Standard)
              </button>
              <button
                type="button"
                onClick={() => setFormat('png')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  format === 'png'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                PNG (Lossless)
              </button>
            </div>
          </div>

          {/* Resolution Selection */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {t('imageQuality') || 'Resolution / Quality'}
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'high', label: 'High (300 DPI)' },
                { id: 'medium', label: 'Med (150 DPI)' },
                { id: 'web', label: 'Web (72 DPI)' },
              ].map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setResolution(res.id as any)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-black text-center transition-all ${
                    resolution === res.id
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          {/* Page Scope */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Pages to Render
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPageScope('all')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  pageScope === 'all'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {t('convertAllPages') || 'All Pages'}
              </button>
              <button
                type="button"
                onClick={() => setPageScope('firstOnly')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all ${
                  pageScope === 'firstOnly'
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {t('firstPageOnly') || '1st Page Only'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State: Dropzone */}
      {queue.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <Dropzone
            onFilesSelected={handleAddFiles}
            multiple={true}
            accept="application/pdf"
            title="Drop PDF files here to batch convert to images"
            description="Upload one or multiple PDF documents. 100% private in-browser rendering."
            icon="fa-images"
          />
        </div>
      )}

      {/* Queue View */}
      {queue.length > 0 && (
        <div className="flex flex-col space-y-4">
          {/* Queue Top Action Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
                <i className="fas fa-list-check"></i>
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {t('batchQueueTitle') || 'Processing Queue'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {queue.length} {t('filesCount') || 'files'} • {formatBytes(totalOriginalBytes)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingQueue}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <i className="fas fa-plus text-amber-500"></i>
                <span>{t('addMoreFiles') || 'Add More'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                disabled={isProcessingQueue}
                className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <i className="fas fa-trash-can"></i>
                <span>{t('clearAllFiles') || 'Clear All'}</span>
              </button>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="flex flex-col space-y-3">
            {queue.map((item, index) => {
              const isProcessingThis = isProcessingQueue && activeItemIndex === index;

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 transition-all shadow-xs flex flex-col gap-3 ${
                    isProcessingThis
                      ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                      : item.status === 'completed'
                      ? 'border-emerald-200 dark:border-emerald-900/60'
                      : item.status === 'error'
                      ? 'border-rose-300 dark:border-rose-900/60'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Icon & Info */}
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                          item.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : item.status === 'processing'
                            ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                            : item.status === 'error'
                            ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {item.status === 'completed' ? (
                          <i className="fas fa-check"></i>
                        ) : item.status === 'processing' ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : item.status === 'error' ? (
                          <i className="fas fa-triangle-exclamation"></i>
                        ) : (
                          <i className="fas fa-file-pdf"></i>
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>{formatBytes(item.originalSize)}</span>
                          {item.status === 'completed' && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              • {item.images.length} {item.images.length === 1 ? 'page' : 'pages'}{' '}
                              converted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions / Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'queued' && (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          {t('statusQueued') || 'Queued'}
                        </span>
                      )}

                      {item.status === 'processing' && (
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg flex items-center gap-1.5">
                          <span>{item.progress}%</span>
                          {item.message && <span className="hidden sm:inline">• {item.message}</span>}
                        </span>
                      )}

                      {item.status === 'completed' && (
                        <div className="flex items-center gap-1.5">
                          {/* If single image */}
                          {item.images.length === 1 && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  downloadFileWithAd(
                                    item.images[0].dataUrl,
                                    `${item.name.replace(/\.pdf$/i, '')}_page_1.${format}`
                                  );
                                  setDownloadedMap((prev) => ({ ...prev, [item.id]: true }));
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                              >
                                <i className="fas fa-download text-[10px]"></i>
                                <span>Download {format.toUpperCase()}</span>
                              </button>
                              {item.images && item.images.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    shareFileViaAndroidBridge(
                                      item.images[0].dataUrl,
                                      `${item.name.replace(/\.pdf$/i, '')}_page_1.${format}`
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer ring-2 ring-indigo-400/30 animate-in zoom-in duration-200"
                                  title="Share image via Android Bridge"
                                >
                                  <i className="fas fa-share-nodes text-[10px]"></i>
                                  <span>Share</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* If multiple images and ZIP available */}
                          {item.images.length > 1 && item.zipUrl && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  downloadFileWithAd(
                                    item.zipUrl!,
                                    `${item.name.replace(/\.pdf$/i, '')}_images.zip`
                                  );
                                  setDownloadedMap((prev) => ({ ...prev, [item.id]: true }));
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                title="Download all pages of this document in ZIP"
                              >
                                <i className="fas fa-file-zipper text-[10px]"></i>
                                <span>Download ZIP ({item.images.length})</span>
                              </button>
                              {item.zipUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    shareFileViaAndroidBridge(
                                      item.zipUrl!,
                                      `${item.name.replace(/\.pdf$/i, '')}_images.zip`
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer ring-2 ring-indigo-400/30 animate-in zoom-in duration-200"
                                  title="Share ZIP via Android Bridge"
                                >
                                  <i className="fas fa-share-nodes text-[10px]"></i>
                                  <span>Share</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {item.status === 'error' && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg">
                          {t('statusError') || 'Failed'}
                        </span>
                      )}

                      {!isProcessingQueue && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs transition-colors"
                          title="Remove from queue"
                        >
                          <i className="fas fa-xmark"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Progress bar */}
                  {isProcessingThis && (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(5, item.progress)}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Converted Page Thumbnails Preview Gallery (When completed) */}
                  {item.status === 'completed' && item.images.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {item.images.map((img) => (
                          <div
                            key={img.pageNumber}
                            className="relative group shrink-0 w-20 h-28 bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between"
                          >
                            <img
                              src={img.dataUrl}
                              alt={`Page ${img.pageNumber}`}
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={() =>
                                setPreviewImage({
                                  src: img.dataUrl,
                                  title: `${item.name} - Page ${img.pageNumber}`,
                                })
                              }
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-mono px-1 py-0.5 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                              <span>P.{img.pageNumber}</span>
                              <a
                                href={img.dataUrl}
                                download={`${item.name.replace(/\.pdf$/i, '')}_page_${
                                  img.pageNumber
                                }.${format}`}
                                className="text-amber-400 hover:text-white"
                                title="Download image"
                              >
                                <i className="fas fa-arrow-down text-[8px]"></i>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Batch Completed Stats & Download All Bar */}
          {completedCount > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 border border-amber-300 dark:border-amber-800/60 rounded-3xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-md shadow-amber-500/30 shrink-0">
                    <i className="fas fa-images"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{t('batchCompleted') || 'Batch Completed!'}</span>
                      <span className="text-xs bg-amber-500 text-white font-mono px-2 py-0.5 rounded-full">
                        {totalRenderedImages} {format.toUpperCase()} images
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                      Converted across {completedCount} of {queue.length} documents
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadAllAsZip}
                    disabled={isZippingAll}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isZippingAll ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Packaging ZIP...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-file-zipper"></i>
                        <span>{t('downloadAllZip') || 'Download All as ZIP'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Button (Start Batch) */}
          <div className="pt-2">
            {!isAllCompleted ? (
              <button
                type="button"
                onClick={startBatchConversion}
                disabled={isProcessingQueue}
                className="w-full py-4 rounded-2xl font-black text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isProcessingQueue ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>
                      {t('processingQueueItem') || 'Processing queue'} (
                      {activeItemIndex + 1} of {queue.length})...
                    </span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-wand-magic-sparkles"></i>
                    <span>
                      {t('startBatch') || 'Convert All Files to Images'} ({queue.length}{' '}
                      {t('filesCount') || 'files'})
                    </span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleDownloadAllAsZip}
                  disabled={isZippingAll}
                  className="flex-1 py-4 rounded-2xl font-black text-sm sm:text-base bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-98"
                >
                  <i className="fas fa-file-zipper"></i>
                  <span>{t('downloadAllZip') || 'Download All as ZIP'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="py-4 px-6 rounded-2xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-rotate-left"></i>
                  <span>{t('processAnotherBatch') || 'Convert Another Batch'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                {previewImage.title}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 flex items-center justify-center"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950/50 min-h-[300px]">
              <img
                src={previewImage.src}
                alt="Preview"
                className="max-h-[70vh] object-contain rounded-xl shadow-md"
              />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <a
                href={previewImage.src}
                download={`${previewImage.title.replace(/\s+/g, '_')}.${format}`}
                onClick={() => triggerInterstitialAd()}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95"
              >
                <i className="fas fa-download"></i>
                <span>Download Image</span>
              </a>
              <button
                type="button"
                onClick={() =>
                  shareFileViaAndroidBridge(
                    previewImage.src,
                    `${previewImage.title.replace(/\s+/g, '_')}.${format}`
                  )
                }
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
              >
                <i className="fas fa-share-nodes"></i>
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFtoJPG;
