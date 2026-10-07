import React, { useState, useRef, useEffect } from 'react';
import Dropzone from '../components/Dropzone';
import { useLanguage } from '../i18n';
import { shareFileViaAndroidBridge, triggerInterstitialAd, downloadFileWithAd } from '../utils/shareHelper';

declare const pdfjsLib: any;
declare const jspdf: any;

export interface CompressQueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  message?: string;
  currentPage?: number;
  totalPages?: number;
  compressedBlob?: Blob;
  compressedUrl?: string;
  compressedSize?: number;
  error?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const Compress: React.FC = () => {
  const { t, language } = useLanguage();
  const [queue, setQueue] = useState<CompressQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState<boolean>(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);
  const [qualityPreset, setQualityPreset] = useState<'extreme' | 'recommended' | 'low' | 'custom'>('recommended');
  const [quality, setQuality] = useState<number>(60);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    document.title = `${t('brandName')} - ${t('toolCompressName')}`;
  }, [t, language]);

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      queue.forEach((item) => {
        if (item.compressedUrl) {
          URL.revokeObjectURL(item.compressedUrl);
        }
      });
    };
  }, [queue]);

  const handleAddFiles = (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length === 0) return;

    const newItems: CompressQueueItem[] = pdfFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      originalSize: file.size,
      status: 'queued',
      progress: 0,
    }));

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.compressedUrl) {
        URL.revokeObjectURL(target.compressedUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleClearAll = () => {
    if (isProcessingQueue) return;
    queue.forEach((item) => {
      if (item.compressedUrl) {
        URL.revokeObjectURL(item.compressedUrl);
      }
    });
    setQueue([]);
    setActiveItemIndex(-1);
  };

  const handlePresetSelect = (preset: 'extreme' | 'recommended' | 'low') => {
    setQualityPreset(preset);
    if (preset === 'extreme') setQuality(30);
    else if (preset === 'recommended') setQuality(60);
    else if (preset === 'low') setQuality(80);
  };

  const compressSingleFile = async (
    item: CompressQueueItem,
    qualityVal: number
  ): Promise<{ blob: Blob; url: string; size: number }> => {
    const { jsPDF } = jspdf;
    const buffer = await item.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const numPages = pdf.numPages;

    // Quality scaling factors
    const qualityFraction = qualityVal / 100;
    // Scale 1.0 (extreme) to 1.8 (high quality)
    const renderScale = Math.max(0.95, Math.min(1.8, 0.7 + qualityFraction * 1.1));

    // Get first page to initialize dimensions
    const firstPage = await pdf.getPage(1);
    const firstViewport = firstPage.getViewport({ scale: renderScale });
    const isLandscape = firstViewport.width > firstViewport.height;

    const outputPdf = new jsPDF({
      orientation: isLandscape ? 'l' : 'p',
      unit: 'pt',
      format: [firstViewport.width, firstViewport.height],
      compress: true,
    });

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (cancelProcessingRef.current) {
        throw new Error('Cancelled by user');
      }

      const pct = Math.round(((pageNum - 1) / numPages) * 100);
      setQueue((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                progress: pct,
                currentPage: pageNum,
                totalPages: numPages,
                message: `Page ${pageNum} of ${numPages}...`,
              }
            : it
        )
      );

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      // JPEG compression
      const imgData = canvas.toDataURL('image/jpeg', Math.max(0.3, Math.min(0.92, qualityFraction)));

      if (pageNum > 1) {
        const pageIsLandscape = viewport.width > viewport.height;
        outputPdf.addPage([viewport.width, viewport.height], pageIsLandscape ? 'l' : 'p');
      }

      outputPdf.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height, undefined, 'FAST');

      // Yield event loop
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const compressedBlob = outputPdf.output('blob');
    const compressedUrl = URL.createObjectURL(compressedBlob);

    return {
      blob: compressedBlob,
      url: compressedUrl,
      size: compressedBlob.size,
    };
  };

  const startBatchCompression = async () => {
    if (queue.length === 0 || isProcessingQueue) return;

    cancelProcessingRef.current = false;
    setIsProcessingQueue(true);

    const queueSnapshot = [...queue];

    for (let i = 0; i < queueSnapshot.length; i++) {
      if (cancelProcessingRef.current) break;

      const currentItem = queueSnapshot[i];
      // Skip already completed items
      if (currentItem.status === 'completed') continue;

      setActiveItemIndex(i);

      setQueue((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? {
                ...it,
                status: 'processing',
                progress: 5,
                message: 'Preparing document...',
              }
            : it
        )
      );

      try {
        const result = await compressSingleFile(currentItem, quality);

        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'completed',
                  progress: 100,
                  compressedBlob: result.blob,
                  compressedUrl: result.url,
                  compressedSize: result.size,
                  message: 'Done',
                }
              : it
          )
        );
      } catch (err: any) {
        console.error(`Error compressing ${currentItem.name}:`, err);
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'error',
                  progress: 0,
                  error: err?.message || 'Compression failed',
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
    const completedItems = queue.filter((item) => item.status === 'completed' && item.compressedBlob);
    if (completedItems.length === 0) return;

    setIsZipping(true);

    try {
      const JSZip = (window as any).JSZip;
      if (!JSZip) {
        throw new Error('ZIP library not loaded');
      }

      const zip = new JSZip();

      for (const item of completedItems) {
        if (item.compressedBlob) {
          const fileName = `compressed_${item.name}`;
          zip.file(fileName, item.compressedBlob);
        }
      }

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `Compressed_PDFs_Batch_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(zipUrl), 2000);
    } catch (e) {
      console.error('ZIP generation error:', e);
      // Fallback: download individual files
      completedItems.forEach((item) => {
        if (item.compressedUrl) {
          const link = document.createElement('a');
          link.href = item.compressedUrl;
          link.download = `compressed_${item.name}`;
          link.click();
        }
      });
    } finally {
      setIsZipping(false);
    }
  };

  // Compute batch statistics
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const isAllCompleted = queue.length > 0 && completedCount === queue.length;
  const totalOriginalBytes = queue.reduce((acc, it) => acc + it.originalSize, 0);
  const totalCompressedBytes = queue.reduce((acc, it) => acc + (it.compressedSize || it.originalSize), 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
  const overallReductionPercent =
    totalOriginalBytes > 0 ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) : 0;

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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 mb-2">
          <i className="fas fa-layer-group"></i>
          <span>{t('batchProcessing') || 'Batch Processing'} • 100% Private</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
          {t('toolCompressName')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-medium max-w-xl mx-auto text-xs sm:text-sm">
          {t('toolCompressDesc') || 'Reduce your file size while keeping visual integrity. Upload multiple files to compress in batch.'}
        </p>
      </div>

      {/* Compression Level Presets & Slider Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="fas fa-sliders text-sky-500"></i>
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              {t('compressionQuality') || 'Compression Quality'}
            </span>
          </div>
          <span className="text-xs font-black font-mono bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 px-2.5 py-0.5 rounded-full">
            {quality}%
          </span>
        </div>

        {/* 3 Quick Preset Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => handlePresetSelect('extreme')}
            className={`p-3 rounded-2xl border text-left transition-all active:scale-98 ${
              qualityPreset === 'extreme'
                ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 ring-2 ring-sky-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {t('extremeCompression') || 'Extreme'}
              </span>
              <span className="text-[10px] font-bold text-amber-500 font-mono">~30%</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Lowest file size, ideal for tight portal limits.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handlePresetSelect('recommended')}
            className={`p-3 rounded-2xl border text-left transition-all active:scale-98 ${
              qualityPreset === 'recommended'
                ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 ring-2 ring-sky-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {t('recommendedCompression') || 'Recommended'}
              </span>
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono">~60%</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Optimal balance between high clarity &amp; file reduction.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handlePresetSelect('low')}
            className={`p-3 rounded-2xl border text-left transition-all active:scale-98 ${
              qualityPreset === 'low'
                ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 ring-2 ring-sky-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {t('lowCompression') || 'High Quality'}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 font-mono">~80%</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Gentle reduction, preserves maximum crispness.
            </p>
          </button>
        </div>

        {/* Fine-tuning Slider */}
        <div>
          <input
            type="range"
            min="15"
            max="85"
            step="5"
            value={quality}
            onChange={(e) => {
              setQuality(Number(e.target.value));
              setQualityPreset('custom');
            }}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1.5">
            <span>Smallest File Size</span>
            <span>Balanced</span>
            <span>Highest Quality</span>
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
            title="Drop PDF files here to batch compress"
            description="Upload one or multiple files at once. 100% private in-browser processing."
            icon="fa-file-zipper"
          />
        </div>
      )}

      {/* Queue View */}
      {queue.length > 0 && (
        <div className="flex flex-col space-y-4">
          {/* Queue Top Action Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center text-lg">
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
                <i className="fas fa-plus text-sky-500"></i>
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
          <div className="flex flex-col space-y-2.5">
            {queue.map((item, index) => {
              const isProcessingThis = isProcessingQueue && activeItemIndex === index;
              const hasReduced =
                item.compressedSize !== undefined && item.compressedSize < item.originalSize;
              const itemSavingsPercent =
                item.compressedSize !== undefined
                  ? Math.round(
                      ((item.originalSize - item.compressedSize) / item.originalSize) * 100
                    )
                  : 0;

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 transition-all shadow-xs flex flex-col gap-2 ${
                    isProcessingThis
                      ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md'
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
                            ? 'bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400'
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
                          {item.status === 'completed' && item.compressedSize !== undefined && (
                            <>
                              <i className="fas fa-arrow-right text-[8px] text-slate-400"></i>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {formatBytes(item.compressedSize)}
                              </span>
                              {hasReduced && (
                                <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                                  -{itemSavingsPercent}%
                                </span>
                              )}
                            </>
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
                        <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 px-2 py-1 rounded-lg flex items-center gap-1.5">
                          <span>{item.progress}%</span>
                          {item.message && <span className="hidden sm:inline">• {item.message}</span>}
                        </span>
                      )}

                      {item.status === 'completed' && item.compressedUrl && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              downloadFileWithAd(item.compressedUrl!, `compressed_${item.name}`);
                              setDownloadedMap((prev) => ({ ...prev, [item.id]: true }));
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                            title="Download compressed PDF"
                          >
                            <i className="fas fa-download text-[10px]"></i>
                            <span className="hidden sm:inline">{t('downloadFile') || 'Download'}</span>
                          </button>

                          {item.compressedUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                shareFileViaAndroidBridge(
                                  item.compressedUrl!,
                                  `compressed_${item.name}`
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer ring-2 ring-indigo-400/30 animate-in zoom-in duration-200"
                              title="Share compressed PDF via Android Bridge"
                            >
                              <i className="fas fa-share-nodes text-[10px]"></i>
                              <span className="hidden xs:inline">Share</span>
                            </button>
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
                        className="bg-sky-500 h-full rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(5, item.progress)}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Batch Summary Stats Banner (When at least 1 item is completed) */}
          {completedCount > 0 && (
            <div className="bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-teal-500/10 border border-emerald-300 dark:border-emerald-800/60 rounded-3xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/30 shrink-0">
                    <i className="fas fa-chart-pie"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{t('totalSavings') || 'Total Space Saved'}</span>
                      <span className="text-xs bg-emerald-500 text-white font-mono px-2 py-0.5 rounded-full">
                        -{overallReductionPercent}%
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                      {formatBytes(totalOriginalBytes)} → {formatBytes(totalCompressedBytes)} • Saved{' '}
                      {formatBytes(totalSavedBytes)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadAllAsZip}
                    disabled={isZipping}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isZipping ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Zipping files...</span>
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
                onClick={startBatchCompression}
                disabled={isProcessingQueue}
                className="w-full py-4 rounded-2xl font-black text-sm sm:text-base bg-sky-500 hover:bg-sky-600 text-white shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-98 disabled:opacity-50 cursor-pointer"
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
                    <i className="fas fa-bolt"></i>
                    <span>
                      {t('startBatch') || 'Compress All Files'} ({queue.length}{' '}
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
                  disabled={isZipping}
                  className="flex-1 py-4 rounded-2xl font-black text-sm sm:text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2.5 active:scale-98"
                >
                  <i className="fas fa-download"></i>
                  <span>{t('downloadAllZip') || 'Download All as ZIP'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAll}
                  className="py-4 px-6 rounded-2xl font-black text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-rotate-left"></i>
                  <span>{t('processAnotherBatch') || 'Compress Another Batch'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Compress;
