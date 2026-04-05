'use client';

import NetworkBackground from '../ui/NetworkBackground';
import Modal from '../ui/Modal';

export default function AuthScreen({
    modal, setModal, isSignUp, setIsSignUp, email, setEmail, password, setPassword,
    username, setUsername, showPassword, setShowPassword, handleAuth, handleForgotPassword
}: any) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-4 relative overflow-hidden">
        <NetworkBackground />
        <Modal modal={modal} setModal={setModal} />
        
        <div className="bg-[#111]/80 backdrop-blur-xl border border-[#333] p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-sm z-10">
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tight italic">FileHub Access</h2>
          
          {isSignUp && (
            <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} 
                   className="w-full p-4 mb-4 bg-black/50 border border-[#333] text-white rounded-lg focus:border-white outline-none" />
          )}
          
          <input type="email" value={email} placeholder="Email" onChange={e => setEmail(e.target.value)} 
                 className="w-full p-4 mb-4 bg-black/50 border border-[#333] text-white rounded-lg focus:border-white outline-none" />
          
          <div className="relative mb-8">
            <input type={showPassword ? "text" : "password"} value={password} placeholder="Password" onChange={e => setPassword(e.target.value)} 
                   className="w-full p-4 bg-black/50 border border-[#333] text-white rounded-lg focus:border-white outline-none pr-12" />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-white transition">
                {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-xs">
              {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          
          {!isSignUp && (
              <p onClick={handleForgotPassword} className="text-center mt-4 text-[10px] text-[#444] hover:text-white cursor-pointer transition uppercase tracking-widest font-bold">
                  Forgot Password?
              </p>
          )}
          
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-sm text-[#888] cursor-pointer hover:text-white transition">
              {isSignUp ? 'Back to Login' : 'Create Account'}
          </p>
        </div>
      </div>
    );
}