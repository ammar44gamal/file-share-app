'use client';

export default function AccountMenu({ 
    showAccountMenu, 
    setShowAccountMenu, 
    profileName, 
    userEmail, 
    handleChangePassword, 
    handleLogout 
}: { 
    showAccountMenu: boolean; 
    setShowAccountMenu: (val: boolean) => void; 
    profileName: string; 
    userEmail: string; 
    handleChangePassword: () => void; 
    handleLogout: () => void; 
}) {
  return (
    <div className="absolute top-4 right-4 md:top-12 md:right-12 z-30">
      <button 
        onClick={() => setShowAccountMenu(!showAccountMenu)} 
        className="w-10 h-10 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white transition-all overflow-hidden shadow-lg font-bold"
      >
          {profileName[0]?.toUpperCase()}
      </button>
      
      {showAccountMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-[#111] border border-[#333] rounded-xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-black text-2xl font-bold mb-4">
            {profileName[0]?.toUpperCase()}
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Hi, {profileName}!</h3>
          <p className="text-[10px] text-[#444] mb-6 truncate px-2">{userEmail}</p>
          <div className="space-y-2">
            <button onClick={handleChangePassword} className="w-full py-2.5 text-[10px] font-bold border border-[#222] rounded-lg hover:bg-[#1a1a1a] transition uppercase tracking-widest">
              CHANGE PASSWORD
            </button>
            <div className="pt-2">
              <button onClick={handleLogout} className="w-full py-2.5 text-[10px] font-bold bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition uppercase tracking-widest">
                LOGOUT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}