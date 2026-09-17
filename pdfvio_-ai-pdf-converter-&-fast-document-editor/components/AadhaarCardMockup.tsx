import React from 'react';

interface AadhaarCardMockupProps {
  side: 'front' | 'back';
  userImage?: string | null;
  className?: string;
  compact?: boolean;
}

export const AadhaarCardMockup: React.FC<AadhaarCardMockupProps> = ({
  side,
  userImage,
  className = '',
  compact = false,
}) => {
  if (side === 'front') {
    return (
      <div
        className={`relative w-full aspect-[1.586/1] bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden flex flex-col justify-between select-none ${className}`}
      >
        {/* Top Tricolor Accent Line */}
        <div className="w-full h-1 bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0"></div>

        {/* Card Header: Emblem + Government of India */}
        <div className="px-2.5 pt-1 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1.5">
            {/* National Emblem Replica */}
            <div className="w-4 h-4 rounded-full bg-amber-50 border border-amber-300 flex items-center justify-center text-[8px] text-amber-800 font-bold">
              <i className="fas fa-landmark text-[7px]"></i>
            </div>
            <div className="flex flex-col -space-y-0.5">
              <span className="text-[7px] sm:text-[8px] font-black text-slate-800 leading-none">
                भारत सरकार
              </span>
              <span className="text-[6px] sm:text-[7px] font-bold text-slate-600 leading-none">
                Government of India
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[6px] font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
              आधार
            </span>
            <span className="text-[7px] font-black text-blue-700 uppercase tracking-wider">
              FRONT
            </span>
          </div>
        </div>

        {/* Card Body: Photo on Left, Details on Right */}
        <div className="px-2.5 py-1 flex items-center gap-2 flex-1 min-h-0">
          {/* Photo */}
          <div className="w-10 sm:w-14 aspect-[3/4] rounded bg-slate-100 border border-slate-300 shadow-inner flex flex-col items-center justify-center overflow-hidden shrink-0 relative">
            {userImage ? (
              <img src={userImage} alt="Aadhaar Photo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-blue-100 to-slate-200 flex flex-col items-center justify-center text-slate-500">
                <i className="fas fa-user text-xs sm:text-base text-slate-600 mb-0.5"></i>
                <span className="text-[5px] sm:text-[6px] font-bold text-slate-600 uppercase">PHOTO</span>
              </div>
            )}
          </div>

          {/* Demographic Information */}
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
            <div className="leading-none">
              <span className="text-[7px] sm:text-[8.5px] font-black text-slate-900 truncate block">
                पवन आर. खाते
              </span>
              <span className="text-[6.5px] sm:text-[7.5px] font-bold text-slate-700 truncate block">
                Pavan R. Khate
              </span>
            </div>

            <div className="leading-tight text-[6px] sm:text-[7px] text-slate-600">
              <span className="text-slate-500">जन्म तारीख / DOB: </span>
              <span className="font-bold text-slate-800">15/08/1995</span>
            </div>

            <div className="leading-tight text-[6px] sm:text-[7px] text-slate-600">
              <span className="text-slate-500">लिंग / Gender: </span>
              <span className="font-bold text-slate-800">पुरुष / Male</span>
            </div>
          </div>
        </div>

        {/* Aadhaar Number & Slogan Banner */}
        <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <span className="font-mono font-black text-[9px] sm:text-[11px] text-red-600 tracking-wider leading-none">
              XXXX XXXX 1234
            </span>
            <span className="text-[5px] sm:text-[6px] font-medium text-slate-500 italic leading-none mt-0.5">
              मेरा <span className="text-red-500 font-bold">आधार</span>, मेरी पहचान
            </span>
          </div>

          {/* UIDAI Flame Symbol */}
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <i className="fas fa-fingerprint text-[10px]"></i>
            </div>
          </div>
        </div>

        {/* Bottom Tricolor Line */}
        <div className="w-full h-0.5 bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0"></div>
      </div>
    );
  }

  // Back Side
  return (
    <div
      className={`relative w-full aspect-[1.586/1] bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden flex flex-col justify-between select-none ${className}`}
    >
      {/* Top Tricolor Accent Line */}
      <div className="w-full h-1 bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0"></div>

      {/* Card Header: UIDAI */}
      <div className="px-2.5 pt-1 flex items-center justify-between border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-[7px] sm:text-[8px] font-black text-slate-800 leading-none">
            भारतीय विशिष्ट पहचान प्राधिकरण
          </span>
          <span className="text-[5.5px] sm:text-[6.5px] font-medium text-slate-500 leading-none">
            (UIDAI)
          </span>
        </div>
        <span className="text-[7px] font-black text-indigo-700 uppercase tracking-wider">
          BACK
        </span>
      </div>

      {/* Card Body: Address on Left, Realistic QR on Right */}
      <div className="px-2.5 py-1 flex items-center justify-between gap-2 flex-1 min-h-0">
        {/* Address Lines */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <span className="text-[6.5px] sm:text-[7.5px] font-black text-slate-800 block leading-tight">
            पत्ता / Address:
          </span>
          <p className="text-[5.5px] sm:text-[6.5px] text-slate-600 leading-tight">
            आत्मशांती निवास, शनिवार पेठ, लेन क्र. ३, पुणे, महाराष्ट्र - ४११०३०
          </p>
          <p className="text-[5.5px] sm:text-[6.5px] text-slate-500 leading-tight">
            Lane No. 3, Shaniwar Peth, Pune, Maharashtra - 411030
          </p>
        </div>

        {/* High-fidelity Realistic QR Code Mockup */}
        <div className="w-10 sm:w-14 aspect-square bg-slate-900 rounded p-1 flex flex-col justify-between items-center shrink-0 relative shadow-inner">
          <div className="w-full flex justify-between">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-xs"></span>
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-xs"></span>
          </div>
          <div className="w-2 h-2 bg-red-400 rounded-full flex items-center justify-center">
            <span className="w-1 h-1 bg-white rounded-full"></span>
          </div>
          <div className="w-full flex justify-between">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-xs"></span>
            <span className="text-[4px] text-white font-mono font-bold">QR</span>
          </div>
        </div>
      </div>

      {/* Helpline & VID Footer */}
      <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 text-[5.5px] sm:text-[6.5px] text-slate-600">
          <i className="fas fa-phone text-emerald-600 text-[6px]"></i>
          <span className="font-bold">1947</span>
          <span className="text-slate-400">|</span>
          <span>help@uidai.gov.in</span>
        </div>
        <span className="font-mono text-[6px] sm:text-[7px] text-slate-500 font-bold">
          VID: 9123 4567 8901 2345
        </span>
      </div>

      {/* Bottom Tricolor Line */}
      <div className="w-full h-0.5 bg-gradient-to-r from-amber-500 via-white to-emerald-600 shrink-0"></div>
    </div>
  );
};

export default AadhaarCardMockup;
