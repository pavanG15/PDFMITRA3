
import React, { useState } from 'react';

const Contact: React.FC = () => {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    setSubmitted(true);
    setFormState({ name: '', email: '', message: '' });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white mb-4 uppercase">
          Contact <span className="text-blue-600">PDFVio</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
          We're here to help. Reach out to us with any questions or feedback.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-12 rounded-[3rem] shadow-sm">
          <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
            <i className="fas fa-envelope text-blue-600"></i> Get in Touch
          </h2>
          
          {submitted ? (
            <div className="bg-green-50 dark:bg-green-900/20 p-8 rounded-[2rem] border border-green-100 dark:border-green-800/30 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-4">
                <i className="fas fa-check"></i>
              </div>
              <h3 className="text-xl font-black text-green-900 dark:text-green-100 mb-2">Message Sent!</h3>
              <p className="text-green-700 dark:text-green-300">Thank you for reaching out. We'll get back to you soon.</p>
              <button 
                onClick={() => setSubmitted(false)}
                className="mt-6 text-green-600 dark:text-green-400 font-bold text-sm uppercase tracking-widest hover:underline"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={formState.email}
                  onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Your Message</label>
                <textarea 
                  required
                  rows={4}
                  value={formState.message}
                  onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  placeholder="How can we help you?"
                ></textarea>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Send Message <i className="fas fa-paper-plane ml-2"></i>
              </button>
            </form>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
            <h3 className="text-lg font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">
              Contact Information
            </h3>
            <div className="space-y-6">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
                  <i className="fas fa-envelope"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Support</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">support@pdfvio.com</p>
                </div>
              </div>
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
                  <i className="fas fa-location-dot"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Pune, Maharashtra, India</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
            <h3 className="text-lg font-black mb-4 uppercase tracking-tight">
              Community Support
            </h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-6">
              Join our community for faster support and feature requests.
            </p>
            <div className="flex gap-4">
              <button className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all">
                <i className="fab fa-twitter"></i>
              </button>
              <button className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all">
                <i className="fab fa-github"></i>
              </button>
              <button className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20 transition-all">
                <i className="fab fa-discord"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
