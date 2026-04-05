'use client';

import { useState } from 'react';

export default function Modal({
    modal,
    setModal,
    showPassword,
    setShowPassword,
}: {
    modal: { show: boolean, title: string, message: string, onConfirm?: (val: string) => void, onRetry?: () => void, isPrompt?: boolean };
    setModal: (val: any) => void;
    showPassword?: boolean;
    setShowPassword?: (val: boolean) => void;
}) {
    const [modalInput, setModalInput] = useState('');

    if (!modal.show) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] border border-[#333] p-6 md:p-8 rounded-2xl max-w-sm w-full shadow-2xl">
                <h3 className="text-xl font-bold mb-4 tracking-tight italic">{modal.title}</h3>
                <p className="text-sm text-[#888] mb-6 leading-relaxed">{modal.message}</p>
                
                {modal.isPrompt && (
                  <div className="relative mb-6">
                    <input 
                        autoFocus 
                        type={modal.title === "Security Update" && !showPassword ? "password" : "text"} 
                        value={modalInput} 
                        onChange={(e) => setModalInput(e.target.value)} 
                        className="w-full p-3 bg-black border border-[#333] rounded-lg text-white outline-none focus:border-white pr-10" 
                    />
                    {modal.title === "Security Update" && setShowPassword && (
                        <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] text-xs">
                            {showPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                    )}
                  </div>
                )}
                
                <div className="flex gap-4">
                    <button onClick={() => {
                        const retryAction = modal.onRetry; 
                        const confirmAction = modal.onConfirm; 
                        const currentInput = modalInput;
                        setModal({ ...modal, show: false });
                        
                        if (modal.title.toLowerCase().includes("error") && retryAction) {
                            setTimeout(() => retryAction(), 100);
                        } else if (modal.isPrompt && confirmAction) {
                            confirmAction(currentInput);
                        }
                    }} 
                    className={`flex-1 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors ${modal.title.toLowerCase().includes("error") ? "bg-red-600 text-white hover:bg-red-700" : "bg-white text-black hover:bg-[#ccc]"}`}>
                        {modal.title.toLowerCase().includes("error") ? "Try Again" : modal.isPrompt ? "Confirm" : "OK"}
                    </button>
                    
                    {(modal.isPrompt || modal.title.toLowerCase().includes("error")) && (
                        <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 border border-[#333] py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest text-[#444] hover:text-white">
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}