'use client';

import { useState, useEffect } from 'react';

export default function Sidebar({
    isSidebarOpen, setIsSidebarOpen, setSelectedFolder, setViewingAdminPanel, setViewingComms,
    setViewingSearch, selectedFolder, viewingAdminPanel, viewingComms, viewingSearch, unreadSenders,
    friendRequests, isAdmin, folders, user, handleFolderDelete, editingFolderId, setEditingFolderId,
    editingFolderName, setEditingFolderName, handleRenameFolder, newFolderName, setNewFolderName,
    folderIsPublic, setFolderIsPublic, createFolder
}: any) {

    // PINNED FOLDERS STATE
    const [pinnedFolders, setPinnedFolders] = useState<string[]>([]);

    useEffect(() => {
        const savedPins = localStorage.getItem('filehub_pins');
        if (savedPins) setPinnedFolders(JSON.parse(savedPins));
    }, []);

    const togglePin = (folderId: string) => {
        let updatedPins = [];
        if (pinnedFolders.includes(folderId)) {
            updatedPins = pinnedFolders.filter(id => id !== folderId);
        } else {
            updatedPins = [...pinnedFolders, folderId];
        }
        setPinnedFolders(updatedPins);
        localStorage.setItem('filehub_pins', JSON.stringify(updatedPins));
    };

    // CATEGORIZE AND SORT FOLDERS
    const myFolders = folders.filter((f: any) => f.user_id === user?.id);
    const otherFolders = folders.filter((f: any) => f.user_id !== user?.id);

    const sortFolders = (list: any[]) => {
        return [...list].sort((a, b) => {
            const aPinned = pinnedFolders.includes(a.id);
            const bPinned = pinnedFolders.includes(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return a.name.localeCompare(b.name);
        });
    };

    // REUSABLE UI BLOCK FOR FOLDER ITEMS
    const renderFolderItem = (folder: any) => {
        const isActive = selectedFolder === folder.id && !viewingComms && !viewingAdminPanel && !viewingSearch;
        
        return (
            <div key={folder.id} className={`w-full text-left px-4 py-2 rounded-lg text-sm flex items-center justify-between transition group ${isActive ? 'text-white bg-[#111]' : 'text-[#888] hover:text-white'}`}>
                
                {editingFolderId === folder.id ? (
                    <input
                        autoFocus
                        type="text"
                        className="bg-black border border-[#444] text-white px-2 py-1 rounded w-full outline-none text-xs font-normal"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onBlur={() => handleRenameFolder(folder.id, editingFolderName)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName);
                            if (e.key === 'Escape') setEditingFolderId(null);
                        }}
                    />
                ) : (
                    <span 
                        className="truncate pr-2 cursor-pointer flex-1 py-1" 
                        onClick={() => {setSelectedFolder(folder.id); setViewingAdminPanel(false); setViewingComms(false); setViewingSearch(false); setIsSidebarOpen(false);}}
                        title={folder.name}
                    >
                        {pinnedFolders.includes(folder.id) ? '📍 ' : '📂 '} {folder.name}
                    </span>
                )}

                <div className={`flex items-center gap-2 transition-opacity shrink-0 ${isActive ? 'opacity-100' : 'opacity-100 md:opacity-0 group-hover:opacity-100'}`}>
                    <span onClick={(e) => { e.stopPropagation(); togglePin(folder.id); }} className={`text-[10px] cursor-pointer p-1 transition ${pinnedFolders.includes(folder.id) ? 'text-amber-500' : 'hover:text-amber-500'}`} title={pinnedFolders.includes(folder.id) ? "Unpin Folder" : "Pin Folder"}>
                        {pinnedFolders.includes(folder.id) ? '📍' : '📌'}
                    </span>
                    
                    {(folder.user_id === user?.id || isAdmin) && editingFolderId !== folder.id && (
                        <>
                            <span onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditingFolderName(folder.name); }} className="text-[10px] hover:text-blue-500 cursor-pointer p-1" title="Rename">✏️</span>
                            <span onClick={(e) => handleFolderDelete(e, folder.id)} className="text-[10px] hover:text-red-500 cursor-pointer p-1" title="Delete">✕</span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />
            )}

            <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-50 w-80 bg-[#0a0a0a] md:bg-black/90 border-r border-[#222] p-6 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.5)] md:shadow-none`}>
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-black">F</div>
                        <h1 className="font-bold text-lg tracking-tight">FileHub</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-[#888] hover:text-white text-xl">✕</button>
                </div>
                
                {/* CHANGED: Replaced default scrollbar with custom ultra-thin dark scrollbar styling */}
                <nav className="flex-1 space-y-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#222] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#444] transition-colors">
                    <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false); setViewingComms(false); setViewingSearch(false); setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition flex items-center justify-between ${!selectedFolder && !viewingAdminPanel && !viewingComms && !viewingSearch ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>
                        <span>🏠 Main Dashboard</span>
                    </button>
                    
                    <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false); setViewingSearch(false); setViewingComms(true); setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-2 flex items-center justify-between ${viewingComms ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>
                        <span>💬 Chats</span>
                        {(unreadSenders.length > 0 || friendRequests.length > 0) && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
                    </button>
                    
                    <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false); setViewingComms(false); setViewingSearch(true); setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-2 flex items-center justify-between ${viewingSearch ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>
                        <span>🌐 Global Search</span>
                    </button>

                    {isAdmin && (
                        <button onClick={() => {setSelectedFolder(null); setViewingComms(false); setViewingSearch(false); setViewingAdminPanel(true); setIsSidebarOpen(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-4 ${viewingAdminPanel ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-500 hover:text-white border border-blue-900/30'}`}>🛠️ Admin</button>
                    )}
                    
                    {myFolders.length > 0 && (
                        <>
                            <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Your Folders</div>
                            {sortFolders(myFolders).map(folder => renderFolderItem(folder))}
                        </>
                    )}

                    {otherFolders.length > 0 && (
                        <>
                            <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
                            {sortFolders(otherFolders).map(folder => renderFolderItem(folder))}
                        </>
                    )}
                </nav>

                <div className="mt-auto pt-6 border-t border-[#222]">
                    <input type="text" placeholder="Folder name" className="w-full text-xs p-3 bg-black border border-[#333] rounded-lg mb-2 text-white outline-none focus:border-white" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                    <div className="flex items-center gap-2 mb-4 pl-1">
                        <input type="checkbox" checked={folderIsPublic} onChange={e => setFolderIsPublic(e.target.checked)} id="fvis" className="rounded bg-black border-[#333]" />
                        <label htmlFor="fvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">PUBLIC FOLDER</label>
                    </div>
                    <button onClick={createFolder} className="w-full py-2.5 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-[#ccc] transition">CREATE FOLDER</button>
                </div>
            </aside>
        </>
    );
}