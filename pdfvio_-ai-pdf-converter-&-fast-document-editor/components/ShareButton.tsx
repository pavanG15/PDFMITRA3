import React, { useState } from 'react';
import { shareFileViaAndroidBridge } from '../utils/shareHelper';

interface ShareButtonProps {
  fileUrl?: string;
  blob?: Blob;
  fileName?: string;
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'indigo' | 'emerald' | 'outline';
  showIconOnly?: boolean;
  onShared?: () => void;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  fileUrl,
  blob,
  fileName = 'document.pdf',
  className = '',
  label,
  size = 'md',
  variant = 'indigo',
  showIconOnly = false,
  onShared,
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [justShared, setJustShared] = useState(false);

  const handleShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    const target = blob || fileUrl;
    if (!target) return;

    try {
      setIsSharing(true);
      await shareFileViaAndroidBridge(target, fileName);
      setJustShared(true);
      onShared?.();
      setTimeout(() => setJustShared(false), 3000);
    } catch (err) {
      console.error('Failed to share file:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
    md: 'px-5 py-3 text-sm rounded-2xl gap-2 font-bold',
    lg: 'px-8 py-5 text-lg rounded-[2rem] gap-3 font-black',
  }[size];

  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 active:scale-95',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-white shadow-md active:scale-95',
    indigo:
      'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 active:scale-95 ring-2 ring-indigo-500/30',
    emerald:
      'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 active:scale-95 ring-2 ring-emerald-500/30',
    outline:
      'border-2 border-indigo-500/50 hover:border-indigo-500 text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-95',
  }[variant];

  const defaultLabel = justShared ? 'Shared!' : 'Share File';

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={isSharing || (!fileUrl && !blob)}
      title="Share PDF via Android Bridge"
      className={`inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
    >
      {isSharing ? (
        <i className="fas fa-spinner fa-spin text-sm"></i>
      ) : justShared ? (
        <i className="fas fa-check text-sm text-emerald-300"></i>
      ) : (
        <i className="fas fa-share-nodes text-sm"></i>
      )}
      {!showIconOnly && (
        <span className="tracking-wide uppercase text-xs">
          {label || defaultLabel}
        </span>
      )}
    </button>
  );
};

export default ShareButton;
