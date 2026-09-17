
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './i18n';
import { LanguageSelector } from './components/LanguageSelector';
import Home from './pages/Home';
import Merge from './pages/Merge';
import Split from './pages/Split';
import Compress from './pages/Compress';
import PDFtoWord from './pages/PDFtoWord';
import WordToPDF from './pages/WordToPDF';
import PDFtoJPG from './pages/PDFtoJPG';
import JPGtoPDF from './pages/JPGtoPDF';
import Rotate from './pages/Rotate';
import Reorder from './pages/Reorder';
import Scan from './pages/Scan';
import Protect from './pages/Protect';
import Unlock from './pages/Unlock';
import Watermark from './pages/Watermark';
import Repair from './pages/Repair';
import Numbering from './pages/Numbering';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import IDCardMerge from './pages/IDCardMerge';
import ExtractPages from './pages/ExtractPages';
import DeletePages from './pages/DeletePages';
import CropPDF from './pages/CropPDF';
import Legal from './pages/Legal';
import About from './pages/About';
import Contact from './pages/Contact';
import Disclaimer from './pages/Disclaimer';

interface HeaderProps {
  isDark: boolean;
  toggleTheme: () => void;
  isHidden?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isDark, toggleTheme, isHidden }) => {
  const { t } = useLanguage();
  if (isHidden) return null;
  return (
    <nav className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-900 transition-all duration-300">
      <div className="max-w-5xl mx-auto px-2.5 sm:px-4">
        <div className="flex justify-between h-16 items-center gap-2">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group active:scale-95 transition-transform min-w-0 shrink">
            <div className="relative shrink-0">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-9 h-9 sm:w-11 sm:h-11 rounded-[12px] sm:rounded-[14px] text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <i className="fas fa-file-pdf text-base sm:text-xl"></i>
              </div>
              <div className="absolute -top-1 -right-1 bg-blue-400 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center">
                <i className="fas fa-bolt text-[5px] sm:text-[6px] text-white"></i>
              </div>
            </div>
            <div className="flex flex-col -space-y-0.5 min-w-0">
              <span className="text-sm xs:text-base sm:text-xl font-[900] tracking-tight text-slate-900 dark:text-white leading-none truncate">
                Aadhaar <span className="text-blue-600">1-Page</span>
              </span>
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 leading-none mt-0.5 truncate">
                {t('brandTagline')}
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Direct Hero Tool Shortcut (Desktop) */}
            <Link
              to="/aadhaar-merge"
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-black border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all shadow-sm"
            >
              <i className="fas fa-id-card"></i>
              <span>{t('toolAadhaarName')}</span>
            </Link>

            {/* Direct Scanner Shortcut (Desktop/Tablet) */}
            <Link
              to="/scan"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-black border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all shadow-sm"
              title="Scan Document"
            >
              <i className="fas fa-camera"></i>
              <span>{t('toolScanName')}</span>
            </Link>

            {/* Language Switcher */}
            <LanguageSelector />

            {/* Dark/Day Mode Toggle Button - Sleek, single theme toggle */}
            <button 
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-amber-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 transition-all border border-slate-200/80 dark:border-slate-800 shrink-0 cursor-pointer shadow-xs active:scale-95"
              aria-label={isDark ? t('lightMode') : t('darkMode')}
              title={isDark ? `${t('lightMode')} (Day Mode)` : `${t('darkMode')} (Night Mode)`}
            >
              <i className={`fas ${isDark ? 'fa-sun text-amber-400 text-sm sm:text-base' : 'fa-moon text-indigo-600 dark:text-slate-200 text-sm sm:text-base'}`}></i>
            </button>

            <button className="hidden lg:flex bg-orange-500 text-white px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
              {t('support')} <i className="fas fa-heart ml-1"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const MobileNav: React.FC<{ isHidden?: boolean }> = ({ isHidden }) => {
  const { t } = useLanguage();
  const location = useLocation();
  const path = location.pathname;
  if (isHidden) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] px-4 pb-6 pointer-events-none">
      <div className="bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-[2.5rem] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.15)] flex items-center justify-between px-6 py-2.5 pointer-events-auto">
        <Link 
          to="/"
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <i className={`fas fa-house text-sm ${path === '/' ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}></i>
          <span className={`text-[8px] font-black uppercase tracking-widest ${path === '/' ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>
            {t('home')}
          </span>
        </Link>

        <Link 
          to="/#tools"
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <i className="fas fa-shapes text-sm text-slate-400 dark:text-slate-500"></i>
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t('tools')}
          </span>
        </Link>

        {/* Floating Center Hero Button */}
        <Link 
          to="/aadhaar-merge"
          className="flex flex-col items-center gap-1 transition-all active:scale-90 relative -top-5"
          title="Aadhaar / ID Card in One Page"
        >
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg shadow-xl shadow-blue-500/40 ring-4 ring-white dark:ring-slate-950">
            <i className="fas fa-id-card"></i>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 -mt-1 font-sans">
            Aadhaar
          </span>
        </Link>

        <Link 
          to="/blog"
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
        >
          <i className={`fas fa-book-open text-sm ${path.startsWith('/blog') ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}></i>
          <span className={`text-[8px] font-black uppercase tracking-widest ${path.startsWith('/blog') ? 'text-blue-600' : 'text-slate-400 dark:text-slate-500'}`}>
            {t('blog')}
          </span>
        </Link>

        <Link 
          to="/scan"
          className="flex flex-col items-center gap-1 transition-all active:scale-90"
          title="Scan Document"
        >
          <i className={`fas fa-camera text-sm ${path === '/scan' ? 'text-teal-600' : 'text-slate-400 dark:text-slate-500'}`}></i>
          <span className={`text-[8px] font-black uppercase tracking-widest ${path === '/scan' ? 'text-teal-600' : 'text-slate-400 dark:text-slate-500'}`}>
            {t('toolScanName')}
          </span>
        </Link>
      </div>
    </div>
  );
};

function AppContent({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) {
  const { t } = useLanguage();
  const location = useLocation();
  // Hide global navigation if on scanner page (it has its own immersive UI)
  const isScannerActive = location.pathname === '/scan';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Header isDark={isDark} toggleTheme={toggleTheme} isHidden={isScannerActive} />
      <main className={`flex-grow ${isScannerActive ? '' : 'pb-32 md:pb-0'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/merge" element={<Merge />} />
          <Route path="/split" element={<Split />} />
          <Route path="/extract-pages" element={<ExtractPages />} />
          <Route path="/delete-pages" element={<DeletePages />} />
          <Route path="/crop" element={<CropPDF />} />
          <Route path="/compress" element={<Compress />} />
          <Route path="/pdf-to-word" element={<PDFtoWord />} />
          <Route path="/word-to-pdf" element={<WordToPDF />} />
          <Route path="/pdf-to-jpg" element={<PDFtoJPG />} />
          <Route path="/jpg-to-pdf" element={<JPGtoPDF />} />
          <Route path="/rotate" element={<Rotate />} />
          <Route path="/reorder" element={<Reorder />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/protect" element={<Protect />} />
          <Route path="/unlock" element={<Unlock />} />
          <Route path="/watermark" element={<Watermark />} />
          <Route path="/repair" element={<Repair />} />
          <Route path="/numbering" element={<Numbering />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:id" element={<BlogPost />} />
          <Route path="/id-merge" element={<IDCardMerge />} />
          <Route path="/aadhaar-merge" element={<IDCardMerge />} />
          <Route path="/aadhar-merge" element={<IDCardMerge />} />
          <Route path="/aadhaar-card" element={<IDCardMerge />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer className={`bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 py-16 px-6 hidden md:${isScannerActive ? 'hidden' : 'block'}`}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <Link to="/" className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <i className="fas fa-file-pdf text-lg"></i>
                </div>
                <span className="text-xl font-[900] tracking-tight text-slate-900 dark:text-white">
                  Aadhaar <span className="text-blue-600">in One Page</span>
                </span>
              </Link>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm">
                {t('footerTagline')}
              </p>
            </div>
            
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white mb-6">
                {t('quickLinks')}
              </h4>
              <ul className="space-y-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <li><Link to="/about" className="hover:text-blue-600 transition-colors">{t('aboutUs')}</Link></li>
                <li><Link to="/contact" className="hover:text-blue-600 transition-colors">{t('contactUs')}</Link></li>
                <li><Link to="/blog" className="hover:text-blue-600 transition-colors">{t('blog')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white mb-6">
                {t('legalPrivacy')}
              </h4>
              <ul className="space-y-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                <li><Link to="/legal" className="hover:text-blue-600 transition-colors">{t('legal')}</Link></li>
                <li><Link to="/disclaimer" className="hover:text-blue-600 transition-colors">{t('disclaimer')}</Link></li>
                <li><a href="/sitemap.xml" target="_blank" className="hover:text-blue-600 transition-colors">Sitemap</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-12 border-t border-slate-100 dark:border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[11px] font-black tracking-widest text-slate-400 dark:text-slate-600 uppercase">
              {t('allRightsReserved')}
            </div>
            <div className="flex gap-6 text-slate-400 dark:text-slate-600">
              <a href="#" className="hover:text-blue-600 transition-colors" aria-label="Twitter"><i className="fab fa-twitter"></i></a>
              <a href="#" className="hover:text-blue-600 transition-colors" aria-label="Facebook"><i className="fab fa-facebook"></i></a>
              <a href="#" className="hover:text-blue-600 transition-colors" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
            </div>
          </div>
        </div>
      </footer>
      <MobileNav isHidden={isScannerActive} />
    </div>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <LanguageProvider>
      <Router>
        <AppContent isDark={isDark} toggleTheme={toggleTheme} />
      </Router>
    </LanguageProvider>
  );
}
