
import React, { useState } from 'react';
import Dropzone from '../components/Dropzone';
import { ProcessingState } from '../types';
import { shareFileViaAndroidBridge, triggerInterstitialAd } from '../utils/shareHelper';

declare const PDFLib: any;

const Unlock: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [state, setState] = useState<ProcessingState>({ status: 'idle', progress: 0 });
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const unlock = async () => {
    if (!file) return;
    setState({ status: 'processing', progress: 50, message: 'Unlocking document...' });

    try {
      const bytes = await file.arrayBuffer();
      // To unlock, we load it with the user provided password then save it without any
      const pdfDoc = await PDFLib.PDFDocument.load(bytes, { password });
      
      const unlockedBytes = await pdfDoc.save();
      const blob = new Blob([unlockedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setState({ status: 'success', progress: 100, resultUrl: url, resultFileName: `unlocked_${file.name}` });
    } catch (error) {
      setState({ status: 'error', progress: 0, message: 'Invalid password or error decrypting file.' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Unlock PDF</h1>
        <p className="text-slate-600 font-medium">Remove passwords and restrictions from your document.</p>
      </div>

      {!file && <Dropzone onFilesSelected={(f) => setFile(f[0])} />}

      {file && state.status !== 'success' && (
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
           <div className="mb-8">
              <label className="block text-sm font-bold text-slate-700 mb-2 text-left px-2">Current Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full px-6 py-4 rounded-xl border border-slate-200 focus:border-rose-500 outline-none"
                placeholder="Enter document password..."
              />
           </div>
           <button onClick={unlock} className="w-full bg-rose-500 text-white py-4 rounded-2xl font-black text-lg">
             Remove Security
           </button>
           {state.status === 'error' && <p className="mt-4 text-rose-500 font-bold text-sm">{state.message}</p>}
        </div>
      )}

      {state.status === 'success' && (
        <div className="bg-white p-12 rounded-[2.5rem] border-2 border-rose-500 text-center shadow-2xl">
           <div className="text-5xl mb-6 text-rose-500"><i className="fas fa-unlock"></i></div>
           <h2 className="text-3xl font-black mb-8">Document Unlocked!</h2>
           <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
             <a
               href={state.resultUrl}
               download={state.resultFileName}
               onClick={() => {
                 triggerInterstitialAd();
                 setHasDownloaded(true);
               }}
               className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all inline-flex items-center gap-2"
             >
               <i className="fas fa-file-download"></i> Download Unlocked PDF
             </a>
             {hasDownloaded && state.resultUrl && (
               <button
                 type="button"
                 onClick={() =>
                   shareFileViaAndroidBridge(
                     state.resultUrl!,
                     state.resultFileName || 'unlocked.pdf'
                   )
                 }
                 className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all inline-flex items-center gap-2 ring-4 ring-indigo-400/30 cursor-pointer animate-in zoom-in duration-300"
               >
                 <i className="fas fa-share-nodes"></i> Share File
               </button>
             )}
           </div>
        </div>
      )}
    </div>
  );
};

export default Unlock;
