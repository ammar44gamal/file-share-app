'use client';

import FileThumbnail from '../ui/FileThumbnail';

export default function FileExplorer({
    isLockedForUser, currentFolder, fileInputRef, file, setFile, handleUpload, uploading,
    isPublic, setIsPublic, filesList, formatBytes, handleDownload, user, canManageFolder,
    toggleFilePrivacy, handleDeleteFile
}: any) {
    return (
        <>
            {!isLockedForUser ? (
                <section className="bg-[#111]/80 backdrop-blur-md border border-[#333] rounded-2xl p-6 md:p-10 mb-8 md:mb-16 relative shadow-2xl">
                    <h3 className="text-lg md:text-xl font-bold mb-4">Deploy Assets</h3>
                    <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
                        <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 w-full">
                            <input type="file" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#888] file:mr-4 md:file:mr-6 file:py-2.5 file:px-4 md:file:px-6 file:rounded-lg file:border file:border-[#333] file:bg-black file:text-white cursor-pointer hover:file:bg-white hover:file:text-black transition file:transition" />
                            {file && <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="w-full sm:w-auto px-4 py-2.5 text-[10px] font-bold border border-red-900/30 text-red-500 rounded-lg uppercase tracking-widest hover:bg-red-500/10">CLEAR</button>}
                        </div>
                        <button onClick={handleUpload} disabled={uploading || !file} className="w-full sm:w-auto bg-white text-black px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#ccc] transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0">{uploading ? 'Wait...' : 'Distribute'}</button>
                    </div>
                    <div className="mt-6 md:mt-4 flex items-center gap-2">
                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="pvis" className="rounded bg-black border-[#333] cursor-pointer" />
                        <label htmlFor="pvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer hover:text-white transition">PUBLIC GROUP</label>
                    </div>
                </section>
            ) : (
                <div className="bg-amber-500/10 border border-amber-900/30 p-6 md:p-8 rounded-2xl mb-8 md:mb-16 text-center shadow-lg">
                    <p className="text-amber-500 text-xs md:text-sm font-bold uppercase tracking-widest">Node Locked by {currentFolder?.owner_username}.</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
            {filesList.map((f: any) => (
                <div key={f.id} className="group bg-[#080808] p-5 md:p-6 rounded-xl border border-[#222] hover:border-white transition-all relative shadow-lg hover:shadow-2xl">
                <div className="absolute top-4 right-4"><span className={`text-[8px] font-bold px-2 py-1 rounded-full border uppercase tracking-widest ${f.is_public ? 'bg-green-500/10 text-green-500 border-green-900/50' : 'bg-amber-500/10 text-amber-500 border-amber-900/50'}`}>{f.is_public ? 'Public' : 'Private'}</span></div>
                
                <div className="flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4 pt-2">
                        <FileThumbnail path={f.storage_path} fileName={f.file_name} />
                    </div>
                    
                    <h4 className="font-bold text-sm truncate mb-1 text-slate-200 mt-2" title={f.file_name}>{f.file_name}</h4>
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#444] uppercase mb-4"><span className="truncate pr-2">{f.owner_username}</span><span className="shrink-0 text-[#666]">{formatBytes(f.file_size)}</span></div>
                    
                    <div className="mt-auto pt-4 border-t border-[#222] flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="flex-1 py-2 md:py-3 bg-[#111] border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm">💾 Download</button>
                        
                        {(user.id === f.user_id || canManageFolder) && (
                            <>
                            <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`flex-1 py-2 md:py-3 border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm ${f.is_public ? 'text-blue-900 hover:bg-blue-900/20' : 'text-amber-900 hover:bg-amber-900/20'}`}>{f.is_public ? '🌐' : '🔒'}</button>
                            <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="flex-1 py-2 md:py-3 border border-[#222] rounded flex justify-center hover:text-red-500 hover:border-red-900/50 hover:bg-red-500/10 transition text-xs text-[#444] shadow-sm">🗑️</button>
                            </>
                        )}
                    </div>
                </div>
                </div>
            ))}
            </div>
        </>
    );
}