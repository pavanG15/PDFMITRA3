import React, { useState } from 'react';
import { useLanguage } from '../i18n';
import { compressPdf, compressImage, formatFileSize, CompressResult } from '../utils/compressHelper';
import { downloadFileWithAd, shareFileViaAndroidBridge } from '../utils/shareHelper';

interface QuickCompressModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileSource: Blob | string | null;
  fileName: string;
  fileType: 'pdf' | 'image';
  currentSizeBytes?: number;
  onSuccess?: (result: CompressResult) => void;
}

const QuickCompressModal: React.FC<QuickCompressModalProps> = ({
  isOpen,
  onClose,
  fileSource,
  fileName,
  fileType,
  currentSizeBytes,
  onSuccess,
}) => {
  const { language } = useLanguage();
  const [targetPreset, setTargetPreset] = useState<'50kb' | '100kb' | '200kb' | 'custom'>('100kb');
  const [customQuality, setCustomQuality] = useState<number>(55);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [result, setResult] = useState<CompressResult | null>(null);

  if (!isOpen || !fileSource) return null;

  const handleRunCompress = async () => {
    setIsProcessing(true);
    setProgress(15);
    setStatusMessage(
      language === 'mr'
        ? 'कॉम्प्रेस प्रक्रिया सुरू होत आहे...'
        : language === 'hi'
        ? 'कंप्रेशन प्रक्रिया शुरू हो रही है...'
        : 'Starting compression...'
    );

    try {
      let compressRes: CompressResult;

      if (fileType === 'pdf') {
        compressRes = await compressPdf(
          fileSource,
          targetPreset,
          customQuality / 100,
          (pct, msg) => {
            setProgress(pct);
            setStatusMessage(msg);
          }
        );
      } else {
        setProgress(50);
        setStatusMessage(
          language === 'mr'
            ? 'इमेज कॉम्प्रेस करत आहे...'
            : language === 'hi'
            ? 'इमेज कंप्रेस हो रही है...'
            : 'Compressing image...'
        );
        compressRes = await compressImage(fileSource, targetPreset, customQuality / 100);
      }

      setProgress(100);
      setResult(compressRes);

      // Suffix for the compressed file
      const ext = fileType === 'pdf' ? '.pdf' : '.jpg';
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const compressedName = `${baseName}_Compressed_${targetPreset}${ext}`;

      // Trigger download with ad flow
      await downloadFileWithAd(compressRes.url, compressedName);

      if (onSuccess) {
        onSuccess(compressRes);
      }
    } catch (err: any) {
      console.error('Compression error:', err);
      alert(
        language === 'mr'
          ? 'कॉम्प्रेस करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.'
          : 'Error while compressing. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShareCompressed = () => {
    if (!result) return;
    const ext = fileType === 'pdf' ? '.pdf' : '.jpg';
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const compressedName = `${baseName}_Compressed_${targetPreset}${ext}`;
    shareFileViaAndroidBridge(result.url, compressedName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <i className="fas fa-compress-arrows-alt text-lg"></i>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                {language === 'mr'
                  ? 'फाईल कॉम्प्रेस करा (आकार कमी करा)'
                  : language === 'hi'
                  ? 'फ़ाइल कंप्रेस करें (साइज कम करें)'
                  : 'Compress Document / Image'}
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {language === 'mr'
                  ? 'सरकारी फॉर्म्स व जॉब पोर्टल्ससाठी हवी ती साईज निवडा'
                  : language === 'hi'
                  ? 'सरकारी फॉर्म और जॉब पोर्टल के लिए उपयुक्त साइज चुनें'
                  : 'Target size for Govt portals & job uploads'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* File Card Info */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <i
                className={`fas ${fileType === 'pdf' ? 'fa-file-pdf text-red-500' : 'fa-file-image text-emerald-500'} text-xl shrink-0`}
              ></i>
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                {fileName}
              </span>
            </div>
            {currentSizeBytes && currentSizeBytes > 0 && (
              <span className="shrink-0 text-xs font-black px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {formatFileSize(currentSizeBytes)}
              </span>
            )}
          </div>

          {/* Result view if already compressed */}
          {result ? (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-md">
                <i className="fas fa-check"></i>
              </div>
              <div>
                <h4 className="font-black text-emerald-800 dark:text-emerald-300 text-base">
                  {language === 'mr' ? 'कॉम्प्रेस यशस्वी झाले!' : 'Compressed Successfully!'}
                </h4>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatFileSize(result.originalSize)} ➔{' '}
                  <strong className="text-sm font-extrabold text-emerald-700 dark:text-emerald-200">
                    {formatFileSize(result.size)}
                  </strong>{' '}
                  ({result.reductionPercentage}% {language === 'mr' ? 'कमी' : 'smaller'})
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleShareCompressed}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <i className="fas fa-share-nodes"></i>
                  <span>{language === 'mr' ? 'शेअर करा' : 'Share File'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-300 transition-colors"
                >
                  {language === 'mr' ? 'पूर्ण झाले' : 'Done'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Target Size Presets */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{language === 'mr' ? 'टार्गेट साईज निवडा:' : 'Select Target Size:'}</span>
                  <span className="text-[11px] text-emerald-600 font-extrabold">
                    {language === 'mr' ? '१-क्लिक रेडी' : '1-Click Ready'}
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* <100 KB Option */}
                  <button
                    type="button"
                    onClick={() => setTargetPreset('100kb')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all relative ${
                      targetPreset === '100kb'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500 text-white">
                      HOT
                    </span>
                    <div className="font-black text-sm">&lt; 100 KB</div>
                    <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                      {language === 'mr' ? 'महाडीबीटी / भरती' : 'Govt / Police Bharti'}
                    </div>
                  </button>

                  {/* <200 KB Option */}
                  <button
                    type="button"
                    onClick={() => setTargetPreset('200kb')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      targetPreset === '200kb'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-black text-sm">&lt; 200 KB</div>
                    <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                      {language === 'mr' ? 'स्टँडर्ड अर्ज' : 'Standard Upload'}
                    </div>
                  </button>

                  {/* <50 KB Option */}
                  <button
                    type="button"
                    onClick={() => setTargetPreset('50kb')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      targetPreset === '50kb'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-black text-sm">&lt; 50 KB</div>
                    <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold mt-0.5">
                      {language === 'mr' ? 'अति लहान साईज' : 'Strict Limit'}
                    </div>
                  </button>
                </div>

                {/* Custom Quality Slider Option */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    <span>
                      {language === 'mr' ? 'कस्टम कॉम्प्रेस लेव्हल:' : 'Custom Compression Quality:'}
                    </span>
                    <span className="font-extrabold text-emerald-600">{customQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="5"
                    value={customQuality}
                    onChange={(e) => {
                      setCustomQuality(Number(e.target.value));
                      setTargetPreset('custom');
                    }}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-700 dark:text-slate-300">
                    <span>{language === 'mr' ? 'अति लहान (Small KB)' : 'Smallest Size'}</span>
                    <span>{language === 'mr' ? 'उत्तम दर्जा (High Quality)' : 'Higher Quality'}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar when processing */}
              {isProcessing && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-2">
                      <i className="fas fa-spinner fa-spin text-emerald-600"></i>
                      <span>{statusMessage || 'Processing...'}</span>
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleRunCompress}
                disabled={isProcessing}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>{language === 'mr' ? 'कॉम्प्रेस होत आहे...' : 'Compressing...'}</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-arrow-down text-lg"></i>
                    <span>
                      {language === 'mr'
                        ? 'कॉम्प्रेस करून डाऊनलोड करा'
                        : language === 'hi'
                        ? 'कंप्रेस करके डाउनलोड करें'
                        : 'Compress & Download Now'}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickCompressModal;
