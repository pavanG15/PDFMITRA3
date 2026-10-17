import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TOOLS, BLOG_POSTS } from '../constants';
import { ToolCategory } from '../types';
import { useLanguage } from '../i18n';
import AadhaarCardMockup from '../components/AadhaarCardMockup';
import {
  isAndroidScannerAvailable,
  launchNativeScannerIfAvailable,
} from '../utils/scannerBridge';

const Home: React.FC = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');

  const handleToolClick = (e: React.MouseEvent, tool: (typeof TOOLS)[0]) => {
    if (tool.path === '/scan' || tool.id === 'scan-to-pdf') {
      const isAndroidApp =
        typeof window !== 'undefined' &&
        Boolean((window as any).AndroidScanner || (window as any).AndroidBridge);
      if (isAndroidApp) {
        e.preventDefault();
        // DO NOT open the web camera screen. Immediately call AndroidScanner.startScan() or AndroidBridge.startDocumentScan()
        if (
          (window as any).AndroidBridge &&
          typeof (window as any).AndroidBridge.startDocumentScan === 'function'
        ) {
          (window as any).AndroidBridge.startDocumentScan();
        } else if (
          (window as any).AndroidScanner &&
          typeof (window as any).AndroidScanner.startScan === 'function'
        ) {
          (window as any).AndroidScanner.startScan();
        } else if (
          (window as any).AndroidBridge &&
          typeof (window as any).AndroidBridge.startScan === 'function'
        ) {
          (window as any).AndroidBridge.startScan();
        }
        return;
      }
      // Only fallback to the web camera UI if running in a normal desktop/mobile browser where the native bridge is not available.
    }
  };

  // Auto scroll down smoothly to tools section on #tools hash
  useEffect(() => {
    if (location.hash === '#tools') {
      const timer = setTimeout(() => {
        const el = document.getElementById('tools');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  const categories = useMemo(
    () => [
      { label: t('catAll'), value: 'all', icon: 'fa-border-all' },
      { label: t('catConvert'), value: ToolCategory.CONVERT, icon: 'fa-repeat' },
      { label: t('catOrganize'), value: ToolCategory.ORGANIZE, icon: 'fa-layer-group' },
      { label: t('catSecurity'), value: ToolCategory.SECURITY, icon: 'fa-shield-halved' },
      { label: t('catEdit'), value: ToolCategory.EDIT, icon: 'fa-pen-ruler' },
    ],
    [t]
  );

  const getToolDisplayName = useCallback(
    (tool: (typeof TOOLS)[0]) => {
      if (tool.id === 'id-merge') return t('toolAadhaarName');
      if (tool.id === 'merge') return t('toolMergeName');
      if (tool.id === 'split') return t('toolSplitName');
      if (tool.id === 'compress') return t('toolCompressName');
      if (tool.id === 'jpg-to-pdf') return t('toolJpgToPdfName');
      if (tool.id === 'pdf-to-jpg') return t('toolPdfToJpgName');
      if (tool.id === 'scan' || tool.id === 'scan-to-pdf') return t('toolScanName');
      return tool.name;
    },
    [t]
  );

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return TOOLS.filter((tool) => {
      if (tool.hidden) return false;
      const displayName = getToolDisplayName(tool).toLowerCase();
      const rawName = tool.name.toLowerCase();
      const desc = ((tool as any).description || '').toLowerCase();

      const matchesSearch =
        !query ||
        rawName.includes(query) ||
        displayName.includes(query) ||
        desc.includes(query) ||
        tool.id.toLowerCase().includes(query);

      const matchesCategory =
        activeCategory === 'all' || tool.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory, getToolDisplayName]);

  // Strip duplicate leading star characters from translation string
  const cleanHeroBadge = useMemo(() => {
    const raw = t('heroBadge') || '';
    return raw.replace(/^[★⭐☆\s]+/, '');
  }, [t]);

  const showHeroCard = !search.trim() && activeCategory === 'all';

  return (
    <div className="pb-48 sm:pb-44 md:pb-24 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
      {/* Sticky Search & Category Filter Bar */}
      <section className="bg-white/95 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 pt-4 pb-3 px-4 sticky top-16 z-30 backdrop-blur-xl shadow-xs">
        <div className="max-w-5xl mx-auto">
          {/* Search Input with Clear Button */}
          <div className="relative mb-3.5">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm pointer-events-none"></i>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 transition-all text-xs sm:text-sm font-bold outline-none text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 flex items-center justify-center text-[10px] active:scale-90 transition-all"
              >
                <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          {/* Horizontal Category Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setActiveCategory(cat.value as ToolCategory | 'all')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                  }`}
                >
                  <i
                    className={`fas ${cat.icon} text-[9px] ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  ></i>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Flagship Hero Feature: Aadhaar & ID Card in One Page */}
      {showHeroCard && (
        <div className="max-w-5xl mx-auto px-4 mt-5">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-5 sm:p-8 shadow-xl shadow-blue-600/15 border border-blue-400/25">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-xl text-left w-full">
                {/* Fixed Single-Star Hero Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/15 text-white backdrop-blur-sm border border-white/20 mb-3">
                  <i className="fas fa-star text-amber-300"></i>
                  <span>{cleanHeroBadge}</span>
                </div>

                <h2
                  id="hero-id-merge-heading"
                  className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight mb-3 text-white"
                >
                  {t('heroTitle')}
                </h2>

                {/* Supported ID Cards Pill Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3.5 text-[10px] sm:text-[11px] font-bold">
                  <span className="bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                    <i className="fas fa-id-card"></i> Aadhaar / आधार
                  </span>
                  <span className="bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20">
                    PAN Card (पॅन)
                  </span>
                  <span className="bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20">
                    Voter ID (मतदान)
                  </span>
                  <span className="bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20">
                    Driving License (लायसन्स)
                  </span>
                  <span className="bg-white/15 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20">
                    All ID Cards
                  </span>
                </div>

                <p className="text-blue-100 text-xs sm:text-sm leading-relaxed mb-4">
                  {t('heroTagline')}
                </p>

                {/* Feature Highlights */}
                <div className="flex flex-wrap gap-2 mb-5 text-[10px] sm:text-[11px] font-bold text-white/95">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/15">
                    <i className="fas fa-camera text-emerald-300"></i>
                    <span>{t('heroFeatCamera')}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/15">
                    <i className="fas fa-print text-sky-300"></i>
                    <span>{t('heroFeatA4')}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/15">
                    <i className="fas fa-shield-halved text-amber-300"></i>
                    <span>{t('heroFeatPrivate')}</span>
                  </span>
                </div>

                {/* Primary Call-To-Action Button */}
                <Link
                  to="/aadhaar-merge"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white text-blue-700 hover:bg-blue-50 px-6 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-black/20 active:scale-95 transition-all"
                >
                  <span>{t('heroCta')}</span>
                  <i className="fas fa-arrow-right text-xs"></i>
                </Link>
              </div>

              {/* A4 Sheet Preview Card */}
              <Link
                to="/aadhaar-merge"
                className="w-full max-w-[250px] sm:max-w-[290px] aspect-[210/297] bg-white rounded-2xl shadow-2xl ring-4 ring-white/25 p-3 sm:p-4 flex flex-col justify-between shrink-0 mx-auto hover:scale-[1.02] active:scale-95 transition-all group text-slate-800 cursor-pointer select-none"
              >
                {/* Header: A4 Sheet specs */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span className="text-[8px] sm:text-[9px] font-black text-blue-700 uppercase tracking-wider">
                      A4 Page • एक पान
                    </span>
                  </div>
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    100 mm • 300 DPI
                  </span>
                </div>

                {/* Stacked Front and Back ID Demo */}
                <div className="flex flex-col gap-2.5 my-auto py-1">
                  <div className="flex flex-col items-start w-full">
                    <span className="text-[6.5px] sm:text-[7.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <i className="fas fa-scissors text-[6px] text-slate-400"></i> FRONT • समोरची बाजू
                    </span>
                    <div className="w-full p-0.5 border border-dashed border-slate-400 rounded-lg bg-slate-50/50 shadow-2xs">
                      <AadhaarCardMockup side="front" />
                    </div>
                  </div>

                  <div className="flex flex-col items-start w-full">
                    <span className="text-[6.5px] sm:text-[7.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                      <i className="fas fa-scissors text-[6px] text-slate-400"></i> BACK • मागील बाजू
                    </span>
                    <div className="w-full p-0.5 border border-dashed border-slate-400 rounded-lg bg-slate-50/50 shadow-2xs">
                      <AadhaarCardMockup side="back" />
                    </div>
                  </div>
                </div>

                {/* Bottom Status Bar */}
                <div className="text-center pt-1.5 border-t border-slate-100 flex items-center justify-between text-[7px] sm:text-[8px] font-black text-blue-600 group-hover:text-blue-700 shrink-0">
                  <span className="flex items-center gap-1">
                    <i className="fas fa-print text-emerald-600"></i> {t('readyToPrint')}
                  </span>
                  <span className="flex items-center gap-1 underline">
                    <span>{t('heroCta')}</span>
                    <i className="fas fa-arrow-right text-[6px]"></i>
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tools Grid Section */}
      <div id="tools" className="max-w-5xl mx-auto px-4 mt-8 scroll-mt-36">
        {/* Section Title & Count */}
        <div className="flex items-center justify-between mb-5 px-1">
          <h2 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-toolbox text-blue-600 dark:text-blue-400"></i>
            <span>
              {activeCategory === 'all'
                ? 'All PDF & ID Tools'
                : categories.find((c) => c.value === activeCategory)?.label}
            </span>
          </h2>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
            {filteredTools.length} {filteredTools.length === 1 ? 'Tool' : 'Tools'}
          </span>
        </div>

        {filteredTools.length === 0 ? (
          /* Empty Search / Filter State */
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200/70 dark:border-slate-800 my-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
              <i className="fas fa-magnifying-glass"></i>
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-1">
              No Matching Tools Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Try searching with a different keyword or reset the category filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActiveCategory('all');
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all"
            >
              Show All Tools
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 sm:gap-x-4 gap-y-7">
            {filteredTools.map((tool) => (
              <Link
                to={tool.path}
                key={tool.id}
                onClick={(e) => handleToolClick(e, tool)}
                className="group flex flex-col items-center transition-all active:scale-90"
              >
                {/* App Icon Card */}
                <div className="relative w-full aspect-square max-w-[86px] rounded-[22px] flex items-center justify-center text-2xl sm:text-3xl mb-2.5 transition-all shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                  <div
                    className="w-13 h-13 sm:w-14 sm:h-14 rounded-[16px] flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${tool.color}15`,
                      color: tool.color,
                    }}
                  >
                    <i className={`fas ${tool.icon}`}></i>
                  </div>
                  {(tool.isNew || tool.isPopular) && (
                    <div
                      className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-50 dark:border-slate-950 ${
                        tool.isNew ? 'bg-blue-500' : 'bg-orange-500'
                      }`}
                    ></div>
                  )}
                </div>

                {/* Tool Name & Badge */}
                <div className="text-center px-1">
                  <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide leading-tight line-clamp-2">
                    {getToolDisplayName(tool)}
                  </h3>
                  {tool.isPopular && (
                    <span className="text-[7px] font-black uppercase text-orange-500 tracking-widest mt-0.5 block">
                      {t('hotTool')}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pro Tips / Blog Preview */}
        {BLOG_POSTS.length > 0 && (
          <section className="mt-16 pt-12 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6 px-1">
              <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                {t('proInsights')}
              </h2>
              <Link
                to="/blog"
                className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline"
              >
                {t('seeAll')}
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {BLOG_POSTS.slice(0, 3).map((post) => (
                <Link
                  to={`/blog/${post.id}`}
                  key={post.id}
                  className="group flex flex-col p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 hover:border-blue-500/50 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">
                      <i className="fas fa-bolt"></i>
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {post.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <div className="mt-auto flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    <span>{t('readArticle')}</span>
                    <i className="fas fa-chevron-right text-[8px] group-hover:translate-x-0.5 transition-transform"></i>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Home;