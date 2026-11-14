
import React from 'react';
import { Link } from 'react-router-dom';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white mb-4 uppercase">
          About <span className="text-blue-600">PDFVio</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
          Empowering users with fast, secure, and private document management tools.
        </p>
      </div>

      <div className="grid gap-12">
        <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-12 rounded-[3rem] shadow-sm">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
            <i className="fas fa-shield-halved text-blue-600"></i> Our Mission
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            At PDFVio, we believe that your documents are your private property. Our mission is to provide professional-grade PDF tools that work entirely in your browser. This means your files never leave your device, ensuring 100% privacy and security.
          </p>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Whether you need to merge, split, compress, or convert documents, PDFVio offers a seamless and lightning-fast experience without the need for expensive software or risky cloud uploads.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2.5rem] border border-blue-100 dark:border-blue-800/30">
            <h3 className="text-xl font-black mb-4 text-blue-900 dark:text-blue-100 uppercase tracking-tight">
              Why Choose Us?
            </h3>
            <ul className="space-y-4 text-slate-600 dark:text-slate-400">
              <li className="flex gap-3 items-start">
                <i className="fas fa-check-circle text-blue-600 mt-1"></i>
                <span><strong>Privacy First:</strong> Local processing means no server uploads.</span>
              </li>
              <li className="flex gap-3 items-start">
                <i className="fas fa-check-circle text-blue-600 mt-1"></i>
                <span><strong>Lightning Fast:</strong> Optimized WebAssembly engines for speed.</span>
              </li>
              <li className="flex gap-3 items-start">
                <i className="fas fa-check-circle text-blue-600 mt-1"></i>
                <span><strong>Free Access:</strong> Professional tools accessible to everyone.</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/30">
            <h3 className="text-xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">
              Our Technology
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              We leverage modern web technologies like React, Tailwind CSS, and PDF-lib to deliver a high-performance desktop-like experience directly in your web browser. Our "Scan to PDF" feature uses advanced computer vision to detect document edges in real-time.
            </p>
          </div>
        </section>

        <div className="text-center mt-8">
          <Link to="/" className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-105 transition-all">
            Explore All Tools <i className="fas fa-arrow-right"></i>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default About;
