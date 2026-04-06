'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

import NetworkBackground from '../ui/NetworkBackground';
import FileThumbnail from '../ui/FileThumbnail';
import VoiceNotePlayer from '../ui/VoiceNotePlayer';

export default function ChatInterface({
    searchQuery, setSearchQuery, handleSearchUsers, searchResults, sendFriendRequest,
    friendRequests, handleRequestAction, friends, activeChat, setActiveChat, unreadSenders,
    messages, setMessages, user, handleDownload, isTyping, newMessage, handleTyping, chatFile, setChatFile,
    chatFileInputRef, handleSendMessage, isRecording, startRecording, stopRecordingAndSend,
    cancelRecording, chatScrollRef
}: any) {

    const [previewData, setPreviewData] = useState<{ url: string, name: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{id: string, path: string | null} | null>(null);
    
    // NEW: State to track which message we are currently reacting to
    const [reactingTo, setReactingTo] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setTimeout(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }, 10);
    }, [messages, activeChat, isTyping, chatScrollRef]);

    const handlePreview = async (path: string, name: string) => {
        const { data } = await supabase.storage.from('user-files').createSignedUrl(path, 3600);
        if (data?.signedUrl) {
            setPreviewData({ url: data.signedUrl, name });
        }
    };

    const executeDelete = async () => {
        if (!confirmDelete) return;
        const { id, path } = confirmDelete;

        setMessages((prev: any[]) => prev.map(m => m.id === id ? { ...m, is_deleted: true, content: '', file_name: null, file_path: null } : m));
        setConfirmDelete(null);

        if (path) {
            await supabase.storage.from('user-files').remove([path]);
        }
        await supabase.from('messages').update({
            content: '',
            file_name: null,
            file_path: null,
            is_deleted: true
        }).eq('id', id);
    };

    // NEW: Function to handle saving an emoji reaction
    const handleReact = async (msgId: string, emoji: string, currentReactions: any) => {
        const reactions = currentReactions || {};
        const newReactions = { ...reactions };

        // If you click the same emoji again, it removes it. Otherwise, it sets/changes it.
        if (newReactions[user.id] === emoji) {
            delete newReactions[user.id];
        } else {
            newReactions[user.id] = emoji;
        }

        // Optimistic UI Update so it feels instant
        setMessages((prev: any[]) => prev.map(m => m.id === msgId ? { ...m, reactions: newReactions } : m));
        setReactingTo(null);

        // Save to Database
        await supabase.from('messages').update({ reactions: newReactions }).eq('id', msgId);
    };

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 h-full relative">
            
            {/* NEW: Invisible overlay that closes the emoji menu if you click anywhere else on the screen */}
            {reactingTo && (
                <div className="fixed inset-0 z-[50]" onClick={() => setReactingTo(null)}></div>
            )}

            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6 h-full">
                
                <div className="lg:col-span-2 lg:order-2 bg-[#111]/80 backdrop-blur-md border border-[#333] p-3 md:p-4 rounded-xl shadow-2xl flex flex-col h-[65vh] md:h-[75vh] lg:h-[80vh] min-h-[500px]">
                    
                    <h3 className="font-bold text-base mb-3 text-white pl-1">Connected Friends</h3>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[#222] mb-2 scrollbar-hide shrink-0">
                        {friends.length === 0 ? <p className="text-[11px] text-[#666] italic pl-1">No established connections.</p> : (
                            friends.map((f: any) => (
                                <button key={f.friendship_id} onClick={() => setActiveChat(f)} className={`relative flex-shrink-0 px-3 py-1.5 rounded-md border text-[11px] font-bold transition ${activeChat?.friendship_id === f.friendship_id ? 'bg-white text-black border-white' : 'bg-black text-[#888] border-[#333] hover:border-white hover:text-white'}`}>
                                    {f.username}
                                    {unreadSenders.includes(f.friend_id) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>}
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex-1 bg-black rounded-lg border border-[#222] flex flex-col relative overflow-hidden h-full">
                        {!activeChat ? (
                            <div className="flex-1 flex flex-col items-center justify-center relative p-6 text-center">
                                <NetworkBackground />
                                <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest italic z-10">Select a node to establish secure channel</p>
                            </div>
                        ) : (
                            <>
                                <div className="px-3 py-2 border-b border-[#222] bg-[#111] z-10 flex justify-between items-center shrink-0">
                                    <div>
                                        <p className="text-green-500 text-[8px] font-bold uppercase tracking-widest">Secure Channel</p>
                                        <p className="text-white font-bold text-xs leading-tight">{activeChat.username}</p>
                                    </div>
                                    <button onClick={() => setActiveChat(null)} className="text-[#888] hover:text-white text-[10px] font-bold px-2 py-1 border border-[#333] rounded hover:bg-[#333]">✕</button>
                                </div>

                                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-2 md:p-3 space-y-1.5 z-10">
                                    {messages.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-[#444] text-[10px] font-bold uppercase tracking-widest italic text-center px-4">
                                            No messages yet. Begin transmission.
                                        </div>
                                    ) : (
                                        messages.map((msg: any) => {
                                            const isMine = msg.sender_id === user.id;
                                            
                                            if (msg.is_deleted) {
                                                return (
                                                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}>
                                                        <div className={`max-w-[85%] md:max-w-[60%] rounded-xl px-3 py-2 shadow-sm flex items-center gap-2 ${isMine ? 'bg-[#111] border border-[#222] text-[#666] rounded-br-none' : 'bg-[#0a0a0a] border border-[#222] text-[#666] rounded-bl-none'}`}>
                                                            <span className="text-[10px] opacity-50">🚫</span>
                                                            <p className="text-[11px] italic opacity-70">This message was deleted</p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const isVoiceNote = msg.file_name && msg.file_name.startsWith('Voice Note');
                                            const isImageFile = msg.file_name && msg.file_name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                            
                                            return (
                                                // CHANGED: Added mb-2.5 to give space for the floating reactions at the bottom
                                                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group items-center gap-2 relative mb-2.5`}>
                                                    
                                                    {/* NEW: The Emoji Picker Menu */}
                                                    {reactingTo === msg.id && (
                                                        <div className={`absolute top-0 -translate-y-[80%] ${isMine ? 'right-10' : 'left-10'} z-[60] bg-[#1a1a1a] border border-[#333] rounded-full shadow-2xl flex items-center px-2 py-1.5 gap-1.5 animate-in zoom-in-95 duration-200`}>
                                                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(e => (
                                                                <button key={e} onClick={() => handleReact(msg.id, e, msg.reactions)} className="hover:scale-125 hover:-translate-y-1 transition-all text-lg focus:outline-none">{e}</button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* NEW: The Action Buttons (Smile & Trash) */}
                                                    <div className={`opacity-100 md:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200 shrink-0 z-10 ${isMine ? 'order-1' : 'order-2'}`}>
                                                        <button 
                                                            onClick={() => setReactingTo(msg.id)} 
                                                            className="text-[#888] hover:text-white bg-[#111] border border-[#333] hover:bg-[#222] rounded-full p-1.5 flex items-center justify-center shadow-lg transition-colors" 
                                                            title="React to Message"
                                                        >
                                                            {/* Smiley Face SVG */}
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                                                        </button>
                                                        {isMine && (
                                                            <button 
                                                                onClick={() => setConfirmDelete({id: msg.id, path: msg.file_path})} 
                                                                className="text-red-500/70 hover:text-red-500 bg-[#111] border border-[#333] hover:border-red-500/50 rounded-full p-1.5 flex items-center justify-center shadow-lg transition-colors shrink-0" 
                                                                title="Delete Message"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className={`max-w-[85%] md:max-w-[60%] rounded-xl px-2.5 py-1.5 shadow-md z-10 relative ${isMine ? 'order-2 bg-blue-600 text-white rounded-br-none' : 'order-1 bg-[#222] text-slate-200 rounded-bl-none'}`}>
                                                        
                                                        {/* NEW: Render the active Reactions attached to the bottom of the bubble */}
                                                        {(msg.reactions && Object.keys(msg.reactions).length > 0) && (
                                                            <div className={`absolute -bottom-2 ${isMine ? 'left-2' : 'right-2'} bg-[#1a1a1a] border border-[#444] rounded-full px-1.5 py-0.5 text-[10px] shadow-sm flex items-center gap-0.5 z-20`}>
                                                                {/* Get unique emojis (in case multiple people clicked the same one) */}
                                                                {Array.from(new Set(Object.values(msg.reactions))).map((emoji: any, i) => (
                                                                    <span key={i} className="leading-none">{emoji}</span>
                                                                ))}
                                                                {/* Show a counter if more than 1 person reacted */}
                                                                {Object.keys(msg.reactions).length > 1 && <span className="text-[#888] text-[8px] font-bold ml-0.5 leading-none">{Object.keys(msg.reactions).length}</span>}
                                                            </div>
                                                        )}
                                                        
                                                        {msg.content && <p className="text-xs whitespace-pre-wrap break-words leading-snug">{msg.content}</p>}
                                                        
                                                        {msg.file_name && (
                                                            <div className={`mt-1 flex flex-col gap-1 p-1 rounded-lg border ${isMine ? 'bg-blue-700/50 border-blue-500/30' : 'bg-[#111] border-[#444]'}`}>
                                                                {isVoiceNote ? (
                                                                    <VoiceNotePlayer path={msg.file_path} isMine={isMine} />
                                                                ) : (
                                                                    <div 
                                                                        className={`overflow-hidden rounded ${isImageFile ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
                                                                        onClick={() => isImageFile && handlePreview(msg.file_path, msg.file_name)}
                                                                        title={isImageFile ? "Click to expand" : ""}
                                                                    >
                                                                        <FileThumbnail path={msg.file_path} fileName={msg.file_name} isChat={true} />
                                                                    </div>
                                                                )}
                                                                
                                                                {!isVoiceNote && (
                                                                    <div className="flex items-center justify-between gap-2 px-1 mt-0.5">
                                                                        <span className="text-[9px] truncate max-w-[80px] md:max-w-[120px] font-medium opacity-80">{msg.file_name}</span>
                                                                        <div className="flex gap-1 shrink-0">
                                                                            {isImageFile && (
                                                                                <button type="button" onClick={(e) => { e.stopPropagation(); handlePreview(msg.file_path, msg.file_name); }} className="text-[9px] font-bold bg-black/30 hover:bg-black/50 px-1.5 py-0.5 rounded transition">👁️</button>
                                                                            )}
                                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDownload(msg.file_path, msg.file_name); }} className="text-[9px] font-bold bg-black/30 hover:bg-black/50 px-1.5 py-0.5 rounded transition">💾</button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        <span className={`text-[7px] block mt-0.5 flex items-center ${isMine ? 'justify-end gap-1' : 'justify-start opacity-60'}`}>
                                                            <span className="opacity-90">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            {isMine && (
                                                                <span className={`text-[10px] tracking-tighter ${msg.is_read ? 'text-[#38bdf8] font-black' : 'text-black opacity-70 font-bold'}`}>
                                                                    ✓✓
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    {isTyping && (
                                        <div className="flex justify-start">
                                            <div className="bg-[#222] text-[#888] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl rounded-bl-none animate-pulse">
                                                {activeChat.username} is typing...
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <form onSubmit={handleSendMessage} className="p-2 bg-[#111] border-t border-[#222] z-10 flex gap-2 items-center shrink-0">
                                    {isRecording ? (
                                        <div className="flex-1 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center justify-between p-2 transition">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                                                <span className="text-red-500 text-[10px] font-bold tracking-widest uppercase">Rec...</span>
                                            </div>
                                            <button type="button" onClick={cancelRecording} className="text-red-400 hover:text-red-300 text-[9px] font-bold uppercase tracking-widest transition">Cancel ✕</button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 bg-black border border-[#333] rounded-lg flex items-center pr-1 focus-within:border-white transition">
                                            <input 
                                                type="text" 
                                                value={newMessage} 
                                                onChange={handleTyping}
                                                placeholder="Type message..." 
                                                className="w-full bg-transparent text-white text-xs p-2 outline-none"
                                            />
                                            <input type="file" ref={chatFileInputRef} onChange={e => setChatFile(e.target.files?.[0] || null)} className="hidden" id="chat-file" />
                                            <label htmlFor="chat-file" className={`cursor-pointer px-2 text-xs hover:text-white transition flex items-center gap-1 ${chatFile ? 'text-green-500 font-bold' : 'text-[#666]'}`} title={chatFile ? chatFile.name : "Attach file"}>
                                                📎 {chatFile && <span className="text-[8px] truncate max-w-[50px] hidden sm:inline-block">{chatFile.name}</span>}
                                            </label>
                                        </div>
                                    )}

                                    {isRecording ? (
                                        <button type="button" onClick={stopRecordingAndSend} className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-[9px] uppercase tracking-widest hover:bg-red-500 transition shadow-lg shrink-0">
                                            Send
                                        </button>
                                    ) : (
                                        <>
                                            <button type="button" onClick={startRecording} className="bg-[#222] text-white hover:bg-[#333] p-2 rounded-lg transition shrink-0" title="Voice Note">
                                                🎤
                                            </button>
                                            <button type="submit" disabled={(!newMessage.trim() && !chatFile)} className="bg-white text-black font-bold px-4 py-2 rounded-lg text-[9px] uppercase tracking-widest hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shrink-0">
                                                Send
                                            </button>
                                        </>
                                    )}
                                </form>
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-4 md:space-y-6 flex-shrink-0 lg:col-span-1 lg:order-1">
                    <div className="bg-[#111]/80 backdrop-blur-md border border-[#333] p-4 md:p-5 rounded-xl shadow-2xl">
                        <h3 className="font-bold text-base mb-3 text-white">Find Friends</h3>
                        <div className="flex gap-2 mb-3">
                            <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Enter exact username..." className="flex-1 bg-black border border-[#333] text-white text-xs p-2.5 rounded-lg focus:border-white outline-none w-full"/>
                            <button onClick={handleSearchUsers} className="bg-white text-black font-bold text-[10px] px-3 rounded-lg uppercase tracking-widest hover:bg-[#ccc] transition">Scan</button>
                        </div>
                        <div className="space-y-2">
                            {searchResults.map((r: any) => (
                                <div key={r.id} className="flex items-center justify-between bg-black p-2.5 rounded border border-[#222]">
                                    <span className="text-xs font-bold text-slate-200">{r.username}</span>
                                    <button onClick={() => sendFriendRequest(r.id)} className="text-[9px] font-bold text-blue-500 border border-blue-900/50 bg-blue-500/10 px-2 py-1 rounded hover:bg-blue-500/20 uppercase tracking-widest transition">Connect</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#111]/80 backdrop-blur-md border border-[#333] p-4 md:p-5 rounded-xl shadow-2xl">
                        <h3 className="font-bold text-base mb-3 text-white flex items-center justify-between">
                            Incoming Connections 
                            {friendRequests.length > 0 && <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full">{friendRequests.length}</span>}
                        </h3>
                        {friendRequests.length === 0 ? <p className="text-[11px] text-[#666] italic">No pending requests.</p> : (
                            <div className="space-y-2">
                                {friendRequests.map((req: any) => (
                                    <div key={req.id} className="flex items-center justify-between bg-black p-2.5 rounded border border-[#222]">
                                        <span className="text-xs font-bold text-slate-200">{req.username}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleRequestAction(req.id, 'accept')} className="text-[9px] font-bold text-green-500 hover:text-green-400 uppercase tracking-widest transition">Accept</button>
                                            <button onClick={() => handleRequestAction(req.id, 'decline')} className="text-[9px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest transition">Reject</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
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

            {confirmDelete && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-[#333] rounded-xl p-6 w-full max-w-xs md:max-w-sm shadow-2xl flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-red-500/10 text-red-500 flex items-center justify-center rounded-full mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">Delete Message</h3>
                        <p className="text-[#888] text-xs mb-6">Are you sure you want to delete this message for everyone? This cannot be undone.</p>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-[#333] text-[#888] hover:text-white hover:bg-[#222] transition font-bold text-xs uppercase tracking-widest">Cancel</button>
                            <button onClick={executeDelete} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition font-bold text-xs shadow-lg uppercase tracking-widest">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}