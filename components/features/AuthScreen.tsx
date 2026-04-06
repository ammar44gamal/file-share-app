'use client';

import NetworkBackground from '../ui/NetworkBackground';

export default function AuthScreen({
    isSignUp, setIsSignUp, email, setEmail, password, setPassword, 
    username, setUsername, showPassword, setShowPassword, handleAuth, handleForgotPassword,
    awaitingOTP, setAwaitingOTP, otpCode, setOtpCode, handleVerifyOTP
}: any) {

    return (
        <div className="min-h-[100dvh] bg-black flex items-center justify-center p-4 relative overflow-hidden font-sans text-white">
            <NetworkBackground />
            
            <div className="bg-[#111]/80 backdrop-blur-xl border border-[#333] p-8 md:p-10 rounded-2xl shadow-2xl max-w-md w-full z-10 animate-in fade-in zoom-in duration-500">
                
                <div className="flex justify-center mb-8">
                    <div className="w-12 h-12 bg-white text-black flex items-center justify-center font-black text-2xl rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                        F
                    </div>
                </div>

                {awaitingOTP ? (
                    <form onSubmit={handleVerifyOTP} className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="text-center space-y-2 mb-6">
                            <h2 className="text-2xl font-bold tracking-tight">Verify Device</h2>
                            {/* CHANGED: Text updated to 8-digit */}
                            <p className="text-[#888] text-xs">Enter the 8-digit security code sent to <span className="text-white">{email}</span></p>
                        </div>

                        <div className="space-y-4">
                            <input 
                                type="text" 
                                maxLength={8} // CHANGED: Allow 8 characters
                                value={otpCode} 
                                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} 
                                placeholder="00000000" // CHANGED: 8 zeros
                                className="w-full bg-black border border-[#333] focus:border-white text-white p-4 rounded-xl outline-none transition text-center text-3xl tracking-[0.3em] font-mono font-bold"
                                required 
                            />
                        </div>

                        {/* CHANGED: Disable unless exactly 8 digits are typed */}
                        <button type="submit" disabled={otpCode.length !== 8} className="w-full bg-white text-black font-black p-3.5 rounded-xl uppercase tracking-widest hover:bg-[#ddd] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                            Authorize
                        </button>
                        
                        <div className="text-center mt-4">
                            <button type="button" onClick={() => setAwaitingOTP(false)} className="text-[#666] text-xs hover:text-white transition font-bold uppercase tracking-wider">
                                ← Back to Sign In
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-5 animate-in slide-in-from-left-8 duration-300">
                        <div className="text-center space-y-1 mb-6">
                            <h2 className="text-2xl font-bold tracking-tight">{isSignUp ? 'Establish Node' : 'System Login'}</h2>
                            <p className="text-[#888] text-xs">{isSignUp ? 'Join the distributed network' : 'Authenticate to access your files'}</p>
                        </div>

                        <div className="space-y-4">
                            {isSignUp && (
                                <input 
                                    type="text" 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)} 
                                    placeholder="Unique Username" 
                                    className="w-full bg-black border border-[#333] focus:border-white text-white p-3 rounded-lg outline-none transition text-sm"
                                />
                            )}
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                placeholder="Email Address" 
                                className="w-full bg-black border border-[#333] focus:border-white text-white p-3 rounded-lg outline-none transition text-sm"
                                required 
                            />
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    placeholder="Secure Password" 
                                    className="w-full bg-black border border-[#333] focus:border-white text-white p-3 rounded-lg outline-none transition text-sm pr-10"
                                    required 
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white text-xs font-bold transition">
                                    {showPassword ? "HIDE" : "SHOW"}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-white text-black font-black p-3.5 rounded-xl uppercase tracking-widest hover:bg-[#ddd] transition shadow-[0_0_15px_rgba(255,255,255,0.1)] mt-2">
                            {isSignUp ? 'Initialize' : 'Access'}
                        </button>

                        <div className="flex flex-col items-center gap-3 pt-4 border-t border-[#222]">
                            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-[#888] text-xs hover:text-white transition">
                                {isSignUp ? 'Already have a node? ' : 'Need access? '}
                                <span className="font-bold underline underline-offset-4 decoration-[#444] hover:decoration-white text-white">{isSignUp ? 'Sign In' : 'Sign Up'}</span>
                            </button>
                            
                            {!isSignUp && (
                                <button type="button" onClick={handleForgotPassword} className="text-[#666] text-[10px] hover:text-white transition uppercase tracking-widest font-bold">
                                    Forgot Password?
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}