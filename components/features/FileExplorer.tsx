'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import FileThumbnail from '../ui/FileThumbnail';

export default function FileExplorer({
    // CHANGED: Expected props are now 'files' and 'setFiles'
    isLockedForUser, currentFolder, fileInputRef, files, setFiles, handleUpload, uploading,
    isPublic, setIsPublic, filesList, formatBytes, handleDownload, user, canManageFolder,
    toggleFilePrivacy, handleDeleteFile
}: any) {
    
    const [previewData, setPreviewData] = useState<{ url: string, name: string } | null>(null);

    const handlePreview = async (path: string, name: string) => {
        const { data } = await supabase.storage.from('user-files').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
            setPreviewData({ url: data.signedUrl, name });
        }
    };

    return (
        <>
            {!isLockedForUser ? (
                <section className="bg-[#111]/80 backdrop-blur-md border border-[#333] rounded-xl p-5 md:p-6 mb-6 md:mb-8 relative shadow-xl">
                    <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4">Deploy Assets</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4">
                        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 w-full">
                            
                            <div className="flex-1 relative w-full flex items-center gap-3 border border-dashed border-[#444] bg-black/40 hover:bg-black/80 rounded-lg p-1.5 transition group">
                                {/* CHANGED: Added 'multiple' attribute and updated onChange */}
                                <input 
                                    type="file" 
                                    multiple
                                    ref={fileInputRef} 
                                    onChange={e => setFiles(Array.from(e.target.files || []))} 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                    title=""
                                />
                                <div className="bg-black border border-[#333] text-white text-xs px-4 py-2 rounded-md font-medium group-hover:bg-white group-hover:text-black transition shrink-0">
                                    Choose Files
                                </div>
                                {/* CHANGED: Dynamic text handling based on number of files */}
                                <span className="text-xs text-[#888] truncate flex-1 pr-2">
                                    {files && files.length > 0 
                                        ? files.length === 1 
                                            ? files[0].name 
                                            : `${files.length} files selected for deployment` 
                                        : "No files chosen (you can drag & drop here)"}
                                </span>
                            </div>

                            {/* CHANGED: Disable logic checks the array length */}
                            {files && files.length > 0 && <button onClick={() => { setFiles([]); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="w-full sm:w-auto px-4 py-2.5 text-[10px] font-bold border border-red-900/30 text-red-500 rounded-lg uppercase tracking-widest hover:bg-red-500/10 z-20">CLEAR</button>}
                        </div>
                        <button onClick={handleUpload} disabled={uploading || !files || files.length === 0} className="w-full sm:w-auto bg-white text-black px-8 py-2.5 rounded-lg font-bold text-[11px] md:text-xs uppercase tracking-widest hover:bg-[#ccc] transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 z-20">
                            {uploading ? 'Wait...' : 'Distribute'}
                        </button>
                    </div>
                    <div className="mt-4 md:mt-3 flex items-center gap-2 pl-1">
                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="pvis" className="rounded bg-black border-[#333] cursor-pointer w-3 h-3" />
                        <label htmlFor="pvis" className="text-[9px] font-bold text-[#444] uppercase tracking-widest cursor-pointer hover:text-white transition">PUBLIC</label>
                    </div>
                </section>
            ) : (
                <div className="bg-amber-500/10 border border-amber-900/30 p-5 md:p-6 rounded-xl mb-6 md:mb-8 text-center shadow-md">
                    <p className="text-amber-500 text-xs font-bold uppercase tracking-widest">Folder Is Locked by {currentFolder?.owner_username}.</p>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
            {filesList.map((f: any) => {
                const isImage = f.file_name.match(/\.(jpeg|jpg|gif|png|webp)$/i);

                return (
                    <div key={f.id} className="group bg-[#080808] p-4 md:p-5 rounded-xl border border-[#222] hover:border-white transition-all relative shadow-lg hover:shadow-2xl">
                    <div className="absolute top-3 right-3"><span className={`text-[7px] md:text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${f.is_public ? 'bg-green-500/10 text-green-500 border-green-900/50' : 'bg-amber-500/10 text-amber-500 border-amber-900/50'}`}>{f.is_public ? 'Public' : 'Private'}</span></div>
                    
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3 pt-1">
                            <FileThumbnail path={f.storage_path} fileName={f.file_name} />
                        </div>
                        
                        <h4 className="font-bold text-xs md:text-sm truncate mb-1 text-slate-200 mt-1" title={f.file_name}>{f.file_name}</h4>
                        <div className="flex items-center justify-between text-[9px] font-bold text-[#444] uppercase mb-3"><span className="truncate pr-2">{f.owner_username}</span><span className="shrink-0 text-[#666]">{formatBytes(f.file_size)}</span></div>
                        
                        <div className="mt-auto pt-3 border-t border-[#222] flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                            {isImage && (
                                <button onClick={() => handlePreview(f.storage_path, f.file_name)} className="flex-1 py-1.5 md:py-2 bg-[#111] border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm" title="View Image">👁️</button>
                            )}
                            <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="flex-1 py-1.5 md:py-2 bg-[#111] border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm" title="Download">💾</button>
                            
                            {(user.id === f.user_id || canManageFolder) && (
                                <>
                                <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`flex-1 py-1.5 md:py-2 border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm ${f.is_public ? 'text-blue-900 hover:bg-blue-900/20' : 'text-amber-900 hover:bg-amber-900/20'}`} title={f.is_public ? "Make Private" : "Make Public"}>{f.is_public ? '🌐' : '🔒'}</button>
                                <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="flex-1 py-1.5 md:py-2 border border-[#222] rounded flex justify-center hover:text-red-500 hover:border-red-900/50 hover:bg-red-500/10 transition text-xs text-[#444] shadow-sm" title="Delete">🗑️</button>
                                </>
                            )}
                        </div>
                    </div>
                    </div>
                );
            })}
            </div>

            {previewData && (
                <div 
                    className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200 cursor-zoom-out" 
                    onClick={() => setPreviewData(null)}
                >
                    <button 
                        className="absolute top-6 right-6 text-white bg-[#222] border border-[#444] hover:bg-white hover:text-black rounded-full w-10 h-10 flex items-center justify-center font-bold transition shadow-lg z-10" 
                        onClick={() => setPreviewData(null)}
                        title="Close Preview"
                    >
                        ✕
                    </button>
                    <img 
                        src={previewData.url} 
                        alt={previewData.name} 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-[#333] cursor-default" 
                        onClick={(e) => e.stopPropagation()} 
                    />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#111] border border-[#333] text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg pointer-events-none">
                        {previewData.name}
                    </div>
                </div>
            )}
        </>
    );
}