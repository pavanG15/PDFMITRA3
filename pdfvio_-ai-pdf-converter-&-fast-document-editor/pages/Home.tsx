
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TOOLS, BLOG_POSTS } from '../constants';
import { ToolCategory } from '../types';
import { useLanguage } from '../i18n';
import AadhaarCardMockup from '../components/AadhaarCardMockup';

const Home: React.FC = () => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');

  const categories = [
    { label: t('catAll'), value: 'all' },
    { label: t('catConvert'), value: ToolCategory.CONVERT },
    { label: t('catOrganize'), value: ToolCategory.ORGANIZE },
    { label: t('catSecurity'), value: ToolCategory.SECURITY },
    { label: t('catEdit'), value: ToolCategory.EDIT },
  ];

  const getToolDisplayName = (tool: typeof TOOLS[0]) => {
    if (tool.id === 'id-merge') return t('toolAadhaarName');
    if (tool.id === 'merge') return t('toolMergeName');
    if (tool.id === 'split') return t('toolSplitName');
    if (tool.id === 'compress') return t('toolCompressName');
    if (tool.id === 'jpg-to-pdf') return t('toolJpgToPdfName');
    if (tool.id === 'pdf-to-jpg') return t('toolPdfToJpgName');
    if (tool.id === 'scan' || tool.id === 'scan-to-pdf') return t('toolScanName');
    return tool.name;
  };

  const filteredTools = useMemo(() => {
    return TOOLS.filter(tool => {
      if (tool.hidden) return false;
      const displayName = getToolDisplayName(tool);
      const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase()) ||
                            displayName.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory, t]);

  return (
    <div className="pb-20 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
      {/* Sleek App Controller */}
      <section className="bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 pt-8 pb-4 px-4 sticky top-16 z-40 backdrop-blur-xl shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="relative mb-6">
            <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"></i>
            <input 
              type="text"
              placeholder={t('searchPlaceholder')}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold outline-none dark:text-white shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value as any)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all border ${
                  activeCategory === cat.value 
                  ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Flagship Hero Feature: Aadhaar in One Page */}
      {!search && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/15 border border-blue-500/30">
            {/* Background ambient lighting */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="max-w-xl text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-white/15 text-white backdrop-blur-sm border border-white/20 mb-3">
                  <i className="fas fa-star text-amber-300"></i>
                  <span>{t('heroBadge')}</span>
                </div>
                <h2
                  id="hero-id-merge-heading"
                  className="text-2xl sm:text-3xl lg:text-4xl font-[900] tracking-tight leading-tight mb-2.5 text-white drop-shadow-sm"
                >
                  {t('heroTitle')}
                </h2>

                {/* Supported ID Cards Pill Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] sm:text-[11px] font-bold">
                  <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <i className="fas fa-id-card"></i> Aadhaar / आधार
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full border border-white/25">
                    PAN Card (पॅन)
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full border border-white/25">
                    Voter ID (मतदान)
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full border border-white/25">
                    Driving License (लायसन्स)
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full border border-white/25">
                    All ID Cards
                  </span>
                </div>

                <p className="text-blue-100 text-xs sm:text-sm leading-relaxed mb-5">
                  {t('heroTagline')}
                </p>

                {/* Feature Highlights */}
                <div className="flex flex-wrap gap-2 mb-6 text-[11px] font-bold text-white/90">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                    <i className="fas fa-camera text-emerald-300"></i> {t('heroFeatCamera')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                    <i className="fas fa-print text-sky-300"></i> {t('heroFeatA4')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                    <i className="fas fa-shield-halved text-amber-300"></i> {t('heroFeatPrivate')}
                  </span>
                </div>

                <Link
                  to="/aadhaar-merge"
                  className="inline-flex items-center gap-2.5 bg-white text-blue-700 hover:bg-blue-50 px-6 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <span>{t('heroCta')}</span>
                  <i className="fas fa-arrow-right text-xs"></i>
                </Link>
              </div>

              {/* Authentic A4 Sheet Preview Card with Real Demo Front & Back Aadhaar Cards */}
              <Link
                to="/aadhaar-merge"
                className="w-full max-w-[270px] sm:max-w-[310px] aspect-[210/297] bg-white rounded-2xl shadow-2xl ring-4 ring-white/30 p-3 sm:p-4 flex flex-col justify-between shrink-0 mx-auto hover:scale-105 active:scale-95 transition-all group text-slate-800 cursor-pointer select-none"
              >
                {/* Header: A4 Sheet specs */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span className="text-[8px] sm:text-[9px] font-black text-blue-700 uppercase tracking-wider">
                      A4 Page • एक पान
                    </span>
                  </div>
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    100 mm • 300 DPI
                  </span>
                </div>

                {/* Cards Container: Stacked Front and Back with Dashed Cut Guides */}
                <div className="flex flex-col gap-2.5 sm:gap-3 my-auto py-1">
                  {/* Front Side Aadhaar Demo */}
                  <div className="flex flex-col items-start w-full">
                    <div className="flex items-center justify-between w-full mb-0.5">
                      <span className="text-[6.5px] sm:text-[7.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <i className="fas fa-scissors text-[6px] text-slate-400"></i> FRONT • समोरची बाजू
                      </span>
                    </div>
                    <div className="w-full p-0.5 border border-dashed border-slate-400 rounded-lg bg-slate-50/50 shadow-sm">
                      <AadhaarCardMockup side="front" />
                    </div>
                  </div>

                  {/* Back Side Aadhaar Demo */}
                  <div className="flex flex-col items-start w-full">
                    <div className="flex items-center justify-between w-full mb-0.5">
                      <span className="text-[6.5px] sm:text-[7.5px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <i className="fas fa-scissors text-[6px] text-slate-400"></i> BACK • मागील बाजू
                      </span>
                    </div>
                    <div className="w-full p-0.5 border border-dashed border-slate-400 rounded-lg bg-slate-50/50 shadow-sm">
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

      {/* App Drawer Grid */}
      <div id="tools" className="max-w-5xl mx-auto px-4 mt-10">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-10">
          {filteredTools.map((tool) => (
            <Link 
              to={tool.path} 
              key={tool.id}
              className="group flex flex-col items-center transition-all active:scale-90"
            >
              {/* Big "App Icon" */}
              <div 
                className="relative w-full aspect-square max-w-[90px] rounded-[24px] flex items-center justify-center text-3xl mb-3 transition-all shadow-md group-hover:shadow-xl group-hover:-translate-y-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
              >
                <div 
                  className="w-14 h-14 rounded-[18px] flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: `${tool.color}15`, color: tool.color }}
                >
                  <i className={`fas ${tool.icon}`}></i>
                </div>
                {(tool.isNew || tool.isPopular) && (
                  <div className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-4 border-slate-50 dark:border-slate-950 ${tool.isNew ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                )}
              </div>
              
              <div className="text-center">
                <h3 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider leading-tight">
                  {getToolDisplayName(tool)}
                </h3>
                {/* Visual hint for popular tools */}
                {tool.isPopular && (
                  <span className="text-[7px] font-black uppercase text-orange-500 tracking-widest mt-1 block">{t('hotTool')}</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Pro Tips / Blog Preview */}
        <section className="mt-24 pt-16 border-t border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8 px-1">
            <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">{t('proInsights')}</h2>
            <Link to="/blog" className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t('seeAll')}</Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link to={`/blog/${post.id}`} key={post.id} className="group flex flex-col p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 transition-all shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs">
                    <i className="fas fa-bolt"></i>
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{post.category}</span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-snug mb-2 group-hover:text-blue-600 transition-colors">{post.title}</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
                <div className="mt-auto flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-600">
                  {t('readArticle')} <i className="fas fa-chevron-right text-[8px]"></i>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
