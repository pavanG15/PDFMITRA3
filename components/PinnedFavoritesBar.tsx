import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PDFTool } from '../types';
import { useLanguage } from '../i18n';
import { useFavoriteTools } from '../utils/favoritesHelper';

interface PinnedFavoritesBarProps {
  getToolDisplayName: (tool: PDFTool) => string;
  onToolClick?: (e: React.MouseEvent, tool: PDFTool) => void;
}

export const PinnedFavoritesBar: React.FC<PinnedFavoritesBarProps> = ({
  getToolDisplayName,
  onToolClick,
}) => {
  const { t } = useLanguage();
  const { favoriteTools, unpinFavorite, resetFavorites, isFavorite } =
    useFavoriteTools();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2400);
  };

  const handleUnpinClick = (e: React.MouseEvent, tool: PDFTool) => {
    e.preventDefault();
    e.stopPropagation();
    unpinFavorite(tool.id);
    showToast(
      `${getToolDisplayName(tool)}: ${t('unpinnedSuccess') || 'Removed from Quick Access'}`
    );
  };

  const handleRestoreDefaults = (e: React.MouseEvent) => {
    e.preventDefault();
    resetFavorites();
    showToast(t('pinnedSuccess') || 'Default tools restored ⭐');
  };

  return (
    <section className="mb-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-200 text-xs font-black flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md">
          <i className="fas fa-star text-amber-400"></i>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center text-xs shadow-xs">
            <i className="fas fa-thumbtack text-[11px] -rotate-45"></i>
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>{t('pinnedFavorites')}</span>
              {favoriteTools.length > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  {favoriteTools.length} {t('pinnedBadge')}
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Quick action: Reset / Manage */}
        {favoriteTools.length > 0 ? (
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="text-[10px] font-bold text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 uppercase tracking-widest transition-colors flex items-center gap-1 cursor-pointer"
            title="Reset to default pinned tools"
          >
            <i className="fas fa-rotate-left text-[9px]"></i>
            <span className="hidden sm:inline">{t('restoreDefaults')}</span>
          </button>
        ) : null}
      </div>

      {/* Pinned Cards Tray */}
      {favoriteTools.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2.5 sm:gap-3">
          {favoriteTools.map((tool) => {
            const displayName = getToolDisplayName(tool);
            const isAadhaar = tool.id === 'id-merge';

            return (
              <Link
                key={tool.id}
                to={tool.path}
                onClick={(e) => onToolClick?.(e, tool)}
                className={`group relative p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border transition-all active:scale-[0.98] hover:shadow-lg flex items-center gap-3 cursor-pointer select-none overflow-hidden ${
                  isAadhaar
                    ? 'border-blue-400/50 dark:border-blue-500/40 shadow-blue-500/5'
                    : 'border-slate-200/90 dark:border-slate-800 hover:border-amber-400/50 dark:hover:border-amber-500/40'
                }`}
              >
                {/* Ambient Soft Accent */}
                <div
                  className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full blur-xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-40"
                  style={{ backgroundColor: tool.color }}
                ></div>

                {/* Tool Icon with Custom Colored Backdrop */}
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 transition-transform group-hover:scale-105 shadow-xs"
                  style={{
                    backgroundColor: `${tool.color}18`,
                    color: tool.color,
                  }}
                >
                  <i className={`fas ${tool.icon}`}></i>
                </div>

                {/* Tool Name & Category */}
                <div className="min-w-0 flex-1 pr-6">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {displayName}
                    </h3>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">
                    {isAadhaar ? 'Front & Back 1-Page' : tool.description}
                  </p>
                </div>

                {/* Unpin Action Button (Top-Right Pin Badge) */}
                <button
                  type="button"
                  onClick={(e) => handleUnpinClick(e, tool)}
                  aria-label={`Unpin ${displayName}`}
                  title={`${t('unpinTool')} (${displayName})`}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-amber-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 flex items-center justify-center text-[10px] transition-all cursor-pointer shadow-2xs group-hover:scale-110 active:scale-90"
                >
                  <i className="fas fa-thumbtack -rotate-45"></i>
                </button>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Empty Favorites State */
        <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-5 text-center transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-base mx-auto mb-2">
            <i className="fas fa-star"></i>
          </div>
          <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
            {t('noFavoritesYet')}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
            {t('pinHint')}
          </p>
          <button
            type="button"
            onClick={handleRestoreDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black uppercase tracking-wider hover:bg-amber-400 active:scale-95 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <i className="fas fa-thumbtack text-[10px]"></i>
            <span>{t('restoreDefaults')}</span>
          </button>
        </div>
      )}
    </section>
  );
};

export default PinnedFavoritesBar;
