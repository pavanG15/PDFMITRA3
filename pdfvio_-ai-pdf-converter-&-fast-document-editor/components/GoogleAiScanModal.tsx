import React, { useState, useEffect } from 'react';
import {
  scanImageWithGoogleAI,
  GoogleScanResult,
} from '../utils/geminiScanner';

interface GoogleAiScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  pageName?: string;
  initialMode?: 'ocr' | 'aadhaar_extract' | 'full_analysis';
}

export const GoogleAiScanModal: React.FC<GoogleAiScanModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  pageName = 'Scanned Document',
  initialMode = 'ocr',
}) => {
  const [mode, setMode] = useState<'ocr' | 'aadhaar_extract' | 'full_analysis'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GoogleScanResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (isOpen && imageUrl) {
      performScan(mode);
    } else {
      setResult(null);
    }
  }, [isOpen, imageUrl]);

  const performScan = async (selectedMode: 'ocr' | 'aadhaar_extract' | 'full_analysis') => {
    setLoading(true);
    setResult(null);
    try {
      const scanRes = await scanImageWithGoogleAI(imageUrl, {
        mode: selectedMode,
      });
      setResult(scanRes);
    } catch (err: any) {
      setResult({
        success: false,
        extractedText: '',
        documentType: 'Error',
        language: '',
        summary: '',
        scanQuality: 'poor',
        error: err.message || 'Scan failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (text: string, fieldKey?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (fieldKey) {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    if (!result?.extractedText) return;
    const blob = new Blob([result.extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pageName.replace(/\s+/g, '_')}_Google_AI_Scan.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const fields = result?.fields || {};
  const hasFields = Object.values(fields).some((v) => Boolean(v));

  return (
    <div className="fixed inset-0 z-[1500] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0b1329] text-white border-t sm:border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="pt-5 pb-4 px-6 border-b border-white/10 flex items-center justify-between bg-[#0f172a]/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 shrink-0">
              <i className="fas fa-wand-magic-sparkles text-base"></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white truncate">
                  Google AI Image Scanner
                </h3>
                <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  FREE API
                </span>
              </div>
              <p className="text-[11px] text-white/50 truncate">
                Powered by Gemini 3.1 Flash-Lite &bull; High Accuracy OCR
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95 shrink-0"
            title="Close"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-3 px-6 bg-[#090f20] border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'ocr', label: 'Full Text OCR', icon: 'fa-align-left' },
            { id: 'aadhaar_extract', label: 'Aadhaar / ID Card', icon: 'fa-id-card' },
            { id: 'full_analysis', label: 'Deep Analysis', icon: 'fa-microscope' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                const newMode = m.id as any;
                setMode(newMode);
                performScan(newMode);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                mode === m.id
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-black'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className={`fas ${m.icon} text-[11px]`}></i>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 no-scrollbar">
          {/* Loading State */}
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-teal-500/20 animate-ping"></div>
                <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin flex items-center justify-center">
                  <i className="fas fa-bolt text-teal-400 text-lg"></i>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  Scanning image with Google AI...
                </h4>
                <p className="text-xs text-white/50 mt-1 max-w-sm">
                  Extracting text, detecting language, reading Indian scripts (Devanagari, Marathi, English) &amp; layout details.
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && result && !result.success && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-lg">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-300">Scan Operation Failed</h4>
                <p className="text-xs text-rose-200/70 mt-1">
                  {result.error || 'Unable to scan document. Please check your image or internet connection.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => performScan(mode)}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-black uppercase rounded-xl transition-all"
              >
                <i className="fas fa-rotate-right mr-1.5"></i> Try Again
              </button>
            </div>
          )}

          {/* Success Result */}
          {!loading && result && result.success && (
            <div className="space-y-4">
              {/* Top Document Summary & Badges */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-14 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0">
                    <img src={imageUrl} alt="Document" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-teal-300 uppercase tracking-wide">
                        {result.documentType || 'Scanned Document'}
                      </span>
                      {result.language && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md font-semibold">
                          {result.language}
                        </span>
                      )}
                    </div>
                    {result.summary && (
                      <p className="text-xs text-white/70 mt-1 line-clamp-2">
                        {result.summary}
                      </p>
                    )}
                  </div>
                </div>

                {result.scanQuality && (
                  <div className="shrink-0 flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                    <i
                      className={`fas fa-circle text-[8px] ${
                        result.scanQuality === 'excellent' || result.scanQuality === 'good'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    ></i>
                    <span className="text-[11px] font-bold text-white/80 capitalize">
                      {result.scanQuality} Quality
                    </span>
                  </div>
                )}
              </div>

              {/* Quality Tips (if provided by model) */}
              {result.qualityTips && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-200">
                  <i className="fas fa-lightbulb text-amber-400 mt-0.5 shrink-0"></i>
                  <span>{result.qualityTips}</span>
                </div>
              )}

              {/* Identity / Key Structured Fields (if detected) */}
              {hasFields && (
                <div className="bg-gradient-to-br from-blue-950/40 to-slate-900 border border-teal-500/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-2">
                      <i className="fas fa-id-card"></i> Detected Identity Details
                    </h4>
                    <span className="text-[10px] text-white/40 font-semibold">
                      Click to copy individual fields
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {fields.name && (
                      <div
                        onClick={() => handleCopyText(fields.name!, 'name')}
                        className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase block">Name</span>
                          <span className="font-bold text-white truncate block">{fields.name}</span>
                        </div>
                        <i className={`fas ${copiedField === 'name' ? 'fa-check text-emerald-400' : 'fa-copy text-white/30 group-hover:text-teal-300'} text-xs shrink-0`}></i>
                      </div>
                    )}

                    {fields.idNumber && (
                      <div
                        onClick={() => handleCopyText(fields.idNumber!, 'idNumber')}
                        className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase block">ID / Card No.</span>
                          <span className="font-bold text-teal-300 font-mono tracking-wider truncate block">{fields.idNumber}</span>
                        </div>
                        <i className={`fas ${copiedField === 'idNumber' ? 'fa-check text-emerald-400' : 'fa-copy text-white/30 group-hover:text-teal-300'} text-xs shrink-0`}></i>
                      </div>
                    )}

                    {fields.dobOrYob && (
                      <div
                        onClick={() => handleCopyText(fields.dobOrYob!, 'dob')}
                        className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase block">DOB / Year</span>
                          <span className="font-bold text-white truncate block">{fields.dobOrYob}</span>
                        </div>
                        <i className={`fas ${copiedField === 'dob' ? 'fa-check text-emerald-400' : 'fa-copy text-white/30 group-hover:text-teal-300'} text-xs shrink-0`}></i>
                      </div>
                    )}

                    {fields.gender && (
                      <div
                        onClick={() => handleCopyText(fields.gender!, 'gender')}
                        className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase block">Gender</span>
                          <span className="font-bold text-white truncate block">{fields.gender}</span>
                        </div>
                        <i className={`fas ${copiedField === 'gender' ? 'fa-check text-emerald-400' : 'fa-copy text-white/30 group-hover:text-teal-300'} text-xs shrink-0`}></i>
                      </div>
                    )}

                    {fields.fatherOrHusbandName && (
                      <div
                        onClick={() => handleCopyText(fields.fatherOrHusbandName!, 'relative')}
                        className="bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase block">Father / Husband</span>
                          <span className="font-bold text-white truncate block">{fields.fatherOrHusbandName}</span>
                        </div>
                        <i className={`fas ${copiedField === 'relative' ? 'fa-check text-emerald-400' : 'fa-copy text-white/30 group-hover:text-teal-300'} text-xs shrink-0`}></i>
                      </div>
                    )}

                    {fields.address && (
                      <div
                        onClick={() => handleCopyText(fields.address!, 'address')}
                        className="sm:col-span-2 bg-white/5 hover:bg-white/10 p-2.5 rounded-xl border border-white/5 cursor-pointer flex items-start justify-between group transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase block">Address</span>
                          <span className="font-medium text-white/90 text-xs block leading-relaxed">{fields.address}</span>
                        </div>
                        <i className={`fas ${copiedField === 'address' ? 'fa-check text-emerald-400' : 'fa-copy text-white/30 group-hover:text-teal-300'} text-xs mt-1 shrink-0`}></i>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Extracted Text Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white/70 flex items-center gap-2">
                    <i className="fas fa-file-lines text-teal-400"></i> Full Extracted Text
                  </h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(result.extractedText)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <i className={`fas ${copiedAll ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                      <span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTxt}
                      className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all border border-teal-500/30"
                    >
                      <i className="fas fa-download"></i>
                      <span>Download .txt</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#040817] border border-white/10 rounded-2xl p-4 max-h-72 overflow-y-auto no-scrollbar">
                  {result.extractedText ? (
                    <pre className="text-xs text-white/90 font-mono whitespace-pre-wrap leading-relaxed select-text">
                      {result.extractedText}
                    </pre>
                  ) : (
                    <div className="py-8 text-center text-white/40 text-xs">
                      No text detected in this image.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-white/10 bg-[#0f172a] flex items-center justify-between shrink-0">
          <div className="text-[10px] text-white/40 flex items-center gap-1.5">
            <i className="fab fa-google text-teal-400"></i>
            <span>Google API Free Tier &bull; Private &amp; Secure</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleAiScanModal;
