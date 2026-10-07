
import React from 'react';

const Disclaimer: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white mb-4 uppercase">
          Disclaimer <span className="text-blue-600">PDFVio</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
          Important information regarding the use of our document processing tools.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-12 rounded-[3rem] shadow-sm prose prose-slate dark:prose-invert max-w-none">
        <h2 className="text-2xl font-black mb-6">1. General Information</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          The information provided by PDFVio ("we," "us," or "our") on https://pdfvio.vercel.app (the "Site") is for general informational purposes only. All information on the Site is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site.
        </p>

        <h2 className="text-2xl font-black mb-6">2. Professional Disclaimer</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          The Site cannot and does not contain legal or professional document advice. The document processing information is provided for general informational and educational purposes only and is not a substitute for professional advice. Accordingly, before taking any actions based upon such information, we encourage you to consult with the appropriate professionals. We do not provide any kind of legal or professional document advice. THE USE OR RELIANCE OF ANY INFORMATION CONTAINED ON THE SITE IS SOLELY AT YOUR OWN RISK.
        </p>

        <h2 className="text-2xl font-black mb-6">3. External Links Disclaimer</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          The Site may contain (or you may be sent through the Site) links to other websites or content belonging to or originating from third parties or links to websites and features in banners or other advertising. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES LINKED THROUGH THE SITE OR ANY WEBSITE OR FEATURE LINKED IN ANY BANNER OR OTHER ADVERTISING. WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES.
        </p>

        <h2 className="text-2xl font-black mb-6">4. Errors and Omissions Disclaimer</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          While we have made every attempt to ensure that the information contained in this site has been obtained from reliable sources, PDFVio is not responsible for any errors or omissions, or for the results obtained from the use of this information. All information in this site is provided "as is", with no guarantee of completeness, accuracy, timeliness or of the results obtained from the use of this information, and without warranty of any kind, express or implied, including, but not limited to warranties of performance, merchantability, and fitness for a particular purpose.
        </p>

        <h2 className="text-2xl font-black mb-6">5. "Use at Your Own Risk" Disclaimer</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          All information in the Site is provided "as is", with no guarantee of completeness, accuracy, timeliness or of the results obtained from the use of this information, and without warranty of any kind, express or implied, including, but not limited to warranties of performance, merchantability and fitness for a particular purpose. In no event will PDFVio, its related partnerships or corporations, or the partners, agents or employees thereof be liable to you or anyone else for any decision made or action taken in reliance on the information in this Site or for any consequential, special or similar damages, even if advised of the possibility of such damages.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2rem] border border-blue-100 dark:border-blue-800/30 mt-12">
          <p className="text-blue-900 dark:text-blue-100 font-bold text-center italic">
            "Your use of the Site and your reliance on any information on the Site is solely at your own risk."
          </p>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
