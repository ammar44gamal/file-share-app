'use client';

import FileThumbnail from '../ui/FileThumbnail';

export default function GlobalSearch({
    globalSearchQuery,
    performGlobalSearch,
    globalSearchResults,
    formatBytes,
    handleDownload,
}: any) {
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#111]/80 backdrop-blur-md border border-[#333] p-4 md:p-6 rounded-xl shadow-2xl mb-8 flex flex-col md:flex-row gap-4">
                <input 
                    type="text" 
                    value={globalSearchQuery} 
                    onChange={(e) => performGlobalSearch(e.target.value)} 
                    placeholder="Search public network (e.g., pdf, image)..." 
                    className="flex-1 bg-black border border-[#333] text-white text-sm p-4 rounded-lg focus:border-white outline-none transition w-full"
                />
            </div>
            
            {globalSearchQuery.trim() && globalSearchResults.length === 0 ? (
                 <p className="text-center text-[#666] text-sm mt-12 italic">No public assets found matching your query.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                    {globalSearchResults.map((f: any) => (
                        <div key={f.id} className="group bg-[#080808] p-5 md:p-6 rounded-xl border border-[#222] hover:border-white transition-all relative shadow-lg hover:shadow-2xl">
                            <div className="absolute top-4 right-4">
                                <span className="text-[8px] font-bold px-2 py-1 rounded-full border uppercase tracking-widest bg-green-500/10 text-green-500 border-green-900/50">
                                    Public
                                </span>
                            </div>
                            
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4 pt-2">
                                    <FileThumbnail path={f.storage_path} fileName={f.file_name} />
                                </div>
                                
                                <h4 className="font-bold text-sm truncate mb-1 text-slate-200 mt-2" title={f.file_name}>{f.file_name}</h4>
                                <div className="flex items-center justify-between text-[10px] font-bold text-[#444] uppercase mb-4">
                                    <span className="truncate pr-2">{f.owner_username}</span>
                                    <span className="shrink-0 text-[#666]">{formatBytes(f.file_size)}</span>
                                </div>
                                
                                <div className="mt-auto pt-4 border-t border-[#222] flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                                    <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="flex-1 py-2 md:py-3 bg-[#111] border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm">
                                        💾 Download
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}