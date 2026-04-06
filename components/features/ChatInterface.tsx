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
    const [reactingTo, setReactingTo] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [leftView, setLeftView] = useState<'chats' | 'contacts'>('chats');
    const [pinnedChats, setPinnedChats] = useState<string[]>([]);
    const [lastActivity, setLastActivity] = useState<Record<string, number>>({});

    // NEW: Refs to safely track changes without triggering re-renders
    const prevMessagesLength = useRef(0);
    const prevActiveChatId = useRef<string | null>(null);
    const prevUnread = useRef<string[]>([]);

    useEffect(() => {
        const savedPins = localStorage.getItem('filehub_pinned_chats');
        if (savedPins) setPinnedChats(JSON.parse(savedPins));

        const savedActivity = localStorage.getItem('filehub_chat_activity');
        if (savedActivity) setLastActivity(JSON.parse(savedActivity));
    }, []);

    useEffect(() => {
        setTimeout(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }, 10);
    }, [messages, activeChat, isTyping, chatScrollRef]);

    // FIX 1: Only update timestamp when a NEW message arrives while in the chat, ignore normal clicks
    useEffect(() => {
        if (activeChat?.friend_id !== prevActiveChatId.current) {
            // Switched chats. Do NOT update time, just reset our trackers.
            prevActiveChatId.current = activeChat?.friend_id || null;
            prevMessagesLength.current = messages.length;
            return;
        }

        // If we are in the same chat and the message count went up, a new message was sent/received!
        if (messages.length > prevMessagesLength.current) {
            setLastActivity(prev => {
                const updated = { ...prev, [activeChat.friend_id]: Date.now() };
                localStorage.setItem('filehub_chat_activity', JSON.stringify(updated));
                return updated;
            });
        }
        prevMessagesLength.current = messages.length;
    }, [messages, activeChat]);

    // FIX 2: Only update timestamp for NEWLY unread incoming messages (stops unread chats from constantly jumping)
    useEffect(() => {
        const newlyUnread = unreadSenders.filter((id: string) => !prevUnread.current.includes(id));
        if (newlyUnread.length > 0) {
            setLastActivity(prev => {
                const updated = { ...prev };
                newlyUnread.forEach((id: string) => { updated[id] = Date.now(); });
                localStorage.setItem('filehub_chat_activity', JSON.stringify(updated));
                return updated;
            });
        }
        prevUnread.current = unreadSenders;
    }, [unreadSenders]);

    const togglePin = (friendId: string) => {
        setPinnedChats(prev => {
            const isPinned = prev.includes(friendId);
            let newPins = [];
            if (isPinned) {
                newPins = prev.filter(id => id !== friendId);
            } else if (prev.length < 3) {
                newPins = [...prev, friendId];
            } else {
                alert("You can only pin up to 3 chats.");
                return prev;
            }
            localStorage.setItem('filehub_pinned_chats', JSON.stringify(newPins));
            return newPins;
        });
    };

    // FIX 3: Removed "Forced Unread" sorting. Now it's purely Pinned -> Most Recent Time
    const sortedFriends = [...friends].sort((a, b) => {
        const aPinned = pinnedChats.includes(a.friend_id);
        const bPinned = pinnedChats.includes(b.friend_id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aTime = lastActivity[a.friend_id] || 0;
        const bTime = lastActivity[b.friend_id] || 0;
        
        if (aTime === bTime) return a.username.localeCompare(b.username); // Fallback to alphabetical if no messages
        return bTime - aTime; 
    });

    const handlePreview = async (path: string, name: string) => {
        const { data } = await supabase.storage.from('user-files').createSignedUrl(path, 3600);
        if (data?.signedUrl) setPreviewData({ url: data.signedUrl, name });
    };

    const executeDelete = async () => {
        if (!confirmDelete) return;
        const { id, path } = confirmDelete;
        setMessages((prev: any[]) => prev.map(m => m.id === id ? { ...m, is_deleted: true, content: '', file_name: null, file_path: null } : m));
        setConfirmDelete(null);
        if (path) await supabase.storage.from('user-files').remove([path]);
        await supabase.from('messages').update({ content: '', file_name: null, file_path: null, is_deleted: true }).eq('id', id);
    };

    const parseReactions = (reactions: any) => {
        if (!reactions) return {};
        if (typeof reactions === 'string') {
            try { return JSON.parse(reactions); } catch (e) { return {}; }
        }
        return reactions;
    };

    const handleReact = async (msgId: string, emoji: string, currentReactions: any) => {
        const reactions = parseReactions(currentReactions);
        const newReactions = { ...reactions };
        if (newReactions[user.id] === emoji) delete newReactions[user.id];
        else newReactions[user.id] = emoji; 
        setMessages((prev: any[]) => prev.map(m => m.id === msgId ? { ...m, reactions: newReactions } : m));
        setReactingTo(null);
        await supabase.from('messages').update({ reactions: newReactions }).eq('id', msgId);
    };

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 h-full relative bg-transparent md:bg-black/50 md:backdrop-blur-xl md:border border-[#222] rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* LEFT SIDEBAR */}
            <div className={`w-full md:w-72 lg:w-80 flex-col border-r border-[#222] bg-transparent shrink-0 h-full ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                
                <div className="p-4 border-b border-[#222] flex justify-between items-center bg-transparent">
                    <h2 className="font-bold text-white text-sm tracking-wide">
                        {leftView === 'chats' ? 'Messages' : 'Network Nodes'}
                    </h2>
                    <button 
                        onClick={() => setLeftView(leftView === 'chats' ? 'contacts' : 'chats')} 
                        className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-white bg-[#111] border border-[#333] hover:bg-[#222] px-2.5 py-1.5 rounded transition"
                    >
                        {leftView === 'chats' ? '+ Add' : '← Back'}
                    </button>
                </div>

                {leftView === 'chats' && (
                    <div className="flex-1 overflow-y-auto scrollbar-hide bg-transparent">
                        {friends.length === 0 ? (
                            <div className="p-6 text-center text-xs text-[#666] italic">No established connections. Click '+ Add' to find users.</div>
                        ) : (
                            sortedFriends.map((f: any) => {
                                const isPinned = pinnedChats.includes(f.friend_id);
                                const isUnread = unreadSenders.includes(f.friend_id);
                                const isActive = activeChat?.friendship_id === f.friendship_id;
                                
                                return (
                                    <div 
                                        key={f.friendship_id} 
                                        onClick={() => setActiveChat(f)} 
                                        className={`group flex items-center gap-3 p-3 cursor-pointer border-b border-[#222]/50 transition ${isActive ? 'bg-[#111] border-l-2 border-l-white' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                                    >
                                        <div className="w-11 h-11 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-slate-200 font-bold text-lg shrink-0 relative">
                                            {f.username.charAt(0).toUpperCase()}
                                            {isUnread && <span className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#111]"></span>}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <h4 className={`text-[13px] truncate ${isUnread ? 'font-bold text-white' : 'text-slate-200'}`}>{f.username}</h4>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); togglePin(f.friend_id); }} 
                                                    className={`text-[10px] p-1 rounded-full transition ${isPinned ? 'text-blue-500 opacity-100' : 'text-[#555] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[#333]'}`}
                                                    title={isPinned ? "Unpin Chat" : "Pin Chat"}
                                                >
                                                    📌
                                                </button>
                                            </div>
                                            <p className={`text-[11px] truncate ${isUnread ? 'text-blue-400 font-medium' : 'text-[#666]'}`}>
                                                {isUnread ? 'New encrypted message' : 'Tap to view channel...'}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                {leftView === 'contacts' && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-transparent">
                        <div>
                            <h3 className="text-[#666] text-[10px] font-bold uppercase tracking-widest mb-2">Find Friends</h3>
                            <div className="flex gap-2">
                                <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Enter exact username..." className="flex-1 bg-[#111] border border-[#333] text-white text-xs p-2.5 rounded-lg focus:border-white outline-none w-full"/>
                                <button onClick={handleSearchUsers} className="bg-white text-black font-bold text-[10px] px-3 rounded-lg uppercase tracking-widest hover:bg-[#ccc] transition">Scan</button>
                            </div>
                            <div className="space-y-2 mt-3">
                                {searchResults.map((r: any) => (
                                    <div key={r.id} className="flex items-center justify-between bg-[#0a0a0a] p-2.5 rounded border border-[#222]">
                                        <span className="text-xs font-bold text-slate-200">{r.username}</span>
                                        <button onClick={() => sendFriendRequest(r.id)} className="text-[9px] font-bold text-blue-500 border border-blue-900/50 bg-blue-500/10 px-2 py-1 rounded hover:bg-blue-500/20 uppercase tracking-widest transition">Connect</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[#666] text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center justify-between">
                                Incoming Requests
                                {friendRequests.length > 0 && <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-md">{friendRequests.length}</span>}
                            </h3>
                            {friendRequests.length === 0 ? <p className="text-[11px] text-[#444] italic">No pending requests.</p> : (
                                <div className="space-y-2">
                                    {friendRequests.map((req: any) => (
                                        <div key={req.id} className="flex items-center justify-between bg-[#0a0a0a] p-2.5 rounded border border-[#222]">
                                            <span className="text-xs font-bold text-slate-200">{req.username}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleRequestAction(req.id, 'accept')} className="text-[10px] p-1.5 rounded bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-black transition" title="Accept">✓</button>
                                                <button onClick={() => handleRequestAction(req.id, 'decline')} className="text-[10px] p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition" title="Reject">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MAIN CHAT AREA */}
            <div className={`flex-1 flex-col relative h-full bg-transparent ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
                
                {!activeChat ? (
                    <div className="flex-1 flex flex-col items-center justify-center relative p-6 text-center bg-transparent">
                        <NetworkBackground />
                        <div className="bg-[#050505]/80 backdrop-blur-md border border-[#222] py-2 px-4 rounded-full z-10">
                            <p className="text-[#888] text-[10px] font-bold uppercase tracking-widest">Select a node to view encrypted messages</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="px-4 py-3 border-b border-[#222] bg-transparent z-10 flex items-center gap-3 shrink-0">
                            <button onClick={() => setActiveChat(null)} className="md:hidden text-[#888] hover:text-white pr-2 border-r border-[#333]">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
                            </button>
                            
                            <div className="w-9 h-9 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-slate-200 font-bold shrink-0">
                                {activeChat.username.charAt(0).toUpperCase()}
                            </div>
                            
                            <div className="flex-1">
                                <p className="text-white font-bold text-sm leading-tight">{activeChat.username}</p>
                                <p className="text-green-500 text-[9px] font-bold uppercase tracking-widest">End-to-End Encrypted</p>
                            </div>
                        </div>

                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-1.5 z-10 relative bg-transparent">
                            
                            {reactingTo && (
                                <div className="fixed inset-0 z-[40]" onClick={() => setReactingTo(null)}></div>
                            )}

                            {messages.length === 0 ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="bg-[#0a0a0a] border border-[#222] py-2 px-4 rounded-xl text-[#666] text-[11px] font-medium text-center shadow-lg">
                                        End-to-end encrypted connection established.<br/>Messages cannot be intercepted by third parties.
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg: any) => {
                                    const isMine = msg.sender_id === user.id;
                                    const activeReactions = parseReactions(msg.reactions);
                                    const reactionCount = Object.keys(activeReactions).length;
                                    const uniqueEmojis = Array.from(new Set(Object.values(activeReactions)));

                                    if (msg.is_deleted) {
                                        return (
                                            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}>
                                                <div className={`max-w-[85%] md:max-w-[60%] rounded-xl px-3 py-2 shadow-sm flex items-center gap-2 ${isMine ? 'bg-[#111] border border-[#333] text-[#666] rounded-br-none' : 'bg-[#0a0a0a] border border-[#222] text-[#666] rounded-bl-none'}`}>
                                                    <span className="text-[10px] opacity-50">🚫</span>
                                                    <p className="text-[11px] italic opacity-70">This message was deleted</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const isVoiceNote = msg.file_name && msg.file_name.startsWith('Voice Note');
                                    const isImageFile = msg.file_name && msg.file_name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                    
                                    return (
                                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group items-center gap-2 relative mb-5 ${reactingTo === msg.id ? 'z-[50]' : 'z-10'}`}>
                                            
                                            {reactingTo === msg.id && (
                                                <div className={`absolute bottom-[calc(100%+4px)] ${isMine ? 'right-0' : 'left-0'} z-[70] bg-[#111] border border-[#333] rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex items-center px-3 py-2 gap-2 animate-in zoom-in-95 duration-200`}>
                                                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                                                        <button 
                                                            key={emoji} 
                                                            onClick={(e) => { e.stopPropagation(); handleReact(msg.id, emoji, msg.reactions); }} 
                                                            className="hover:scale-125 hover:-translate-y-1 transition-all text-xl focus:outline-none"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className={`opacity-100 md:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200 shrink-0 z-10 ${isMine ? 'order-1' : 'order-2'}`}>
                                                <button onClick={() => setReactingTo(msg.id)} className="text-[#888] hover:text-white bg-[#111] border border-[#333] hover:bg-[#222] rounded-full p-1.5 flex items-center justify-center shadow-lg transition-colors" title="React">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                                                </button>
                                                {isMine && (
                                                    <button onClick={() => setConfirmDelete({id: msg.id, path: msg.file_path})} className="text-red-500/70 hover:text-red-500 bg-[#111] border border-[#333] hover:border-red-500/50 rounded-full p-1.5 flex items-center justify-center shadow-lg transition-colors shrink-0" title="Delete">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                    </button>
                                                )}
                                            </div>

                                            <div className={`max-w-[85%] md:max-w-[60%] rounded-xl px-3 py-2 shadow-md z-10 relative ${isMine ? 'order-2 bg-blue-600 text-white rounded-br-none' : 'order-1 bg-[#0a0a0a] border border-[#222] text-slate-200 rounded-bl-none'}`}>
                                                
                                                {reactionCount > 0 && (
                                                    <div className={`absolute -bottom-3.5 right-2 ${isMine ? 'bg-[#050505]' : 'bg-[#050505]'} border-[3px] border-[#050505] rounded-full px-1.5 py-0.5 text-[12px] shadow-sm flex items-center justify-center gap-0.5 z-20`}>
                                                        {uniqueEmojis.map((emoji: any, i) => <span key={i} className="leading-none">{emoji}</span>)}
                                                        {reactionCount > 1 && <span className="text-[#aaa] text-[9px] font-bold ml-0.5 leading-none">{reactionCount}</span>}
                                                    </div>
                                                )}
                                                
                                                {msg.content && <p className="text-[13px] whitespace-pre-wrap break-words leading-snug">{msg.content}</p>}
                                                
                                                {msg.file_name && (
                                                    <div className={`mt-1.5 flex flex-col gap-1 p-1 rounded-lg border ${isMine ? 'bg-blue-700/50 border-blue-500/30' : 'bg-[#111] border-[#333]'}`}>
                                                        {isVoiceNote ? (
                                                            <VoiceNotePlayer path={msg.file_path} isMine={isMine} />
                                                        ) : (
                                                            <div className={`overflow-hidden rounded ${isImageFile ? 'cursor-pointer hover:opacity-90 transition' : ''}`} onClick={() => isImageFile && handlePreview(msg.file_path, msg.file_name)} title={isImageFile ? "Click to expand" : ""}>
                                                                <FileThumbnail path={msg.file_path} fileName={msg.file_name} isChat={true} />
                                                            </div>
                                                        )}
                                                        
                                                        {!isVoiceNote && (
                                                            <div className="flex items-center justify-between gap-2 px-1 mt-0.5">
                                                                <span className="text-[10px] truncate max-w-[150px] font-medium opacity-80">{msg.file_name}</span>
                                                                <div className="flex gap-1 shrink-0">
                                                                    {isImageFile && <button type="button" onClick={(e) => { e.stopPropagation(); handlePreview(msg.file_path, msg.file_name); }} className="text-[10px] font-bold bg-black/30 hover:bg-black/50 px-1.5 py-1 rounded transition">👁️</button>}
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDownload(msg.file_path, msg.file_name); }} className="text-[10px] font-bold bg-black/30 hover:bg-black/50 px-1.5 py-1 rounded transition">💾</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                <span className={`text-[9px] block mt-1 flex items-center ${isMine ? 'justify-end gap-1.5' : 'justify-start opacity-60'}`}>
                                                    <span className="opacity-80">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    {isMine && (
                                                        <span className={`tracking-tighter ${msg.is_read ? 'text-[#38bdf8] font-black' : 'text-white opacity-50 font-bold'}`}>✓✓</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-[#0a0a0a] border border-[#222] text-[#888] text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl rounded-bl-none animate-pulse shadow-sm">
                                        {activeChat.username} is typing...
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-3 bg-transparent border-t border-[#222] z-10 flex gap-2 items-center shrink-0">
                            {isRecording ? (
                                <div className="flex-1 bg-red-900/20 border border-red-500/50 rounded-xl flex items-center justify-between p-3 transition">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
                                        <span className="text-red-500 text-[11px] font-bold tracking-widest uppercase">Recording...</span>
                                    </div>
                                    <button type="button" onClick={cancelRecording} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest transition">Cancel ✕</button>
                                </div>
                            ) : (
                                <div className="flex-1 bg-[#111] border border-[#333] rounded-xl flex items-center pr-2 focus-within:border-white transition shadow-inner">
                                    <input 
                                        type="text" 
                                        value={newMessage} 
                                        onChange={handleTyping}
                                        placeholder="Type a message..." 
                                        className="w-full bg-transparent text-white text-sm p-3 outline-none"
                                    />
                                    <input type="file" ref={chatFileInputRef} onChange={e => setChatFile(e.target.files?.[0] || null)} className="hidden" id="chat-file" />
                                    <label htmlFor="chat-file" className={`cursor-pointer p-2 hover:bg-[#222] rounded-lg transition flex items-center gap-1 ${chatFile ? 'text-green-500 font-bold' : 'text-[#888]'}`} title={chatFile ? chatFile.name : "Attach file"}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                        {chatFile && <span className="text-[10px] truncate max-w-[60px] hidden sm:inline-block">{chatFile.name}</span>}
                                    </label>
                                </div>
                            )}

                            {isRecording ? (
                                <button type="button" onClick={stopRecordingAndSend} className="bg-red-600 text-white font-bold px-4 py-3 rounded-xl text-[11px] uppercase tracking-widest hover:bg-red-500 transition shadow-lg shrink-0">
                                    Send
                                </button>
                            ) : (
                                <>
                                    <button type="button" onClick={startRecording} className="bg-[#111] border border-[#333] text-white hover:bg-[#222] p-3 rounded-xl transition shrink-0" title="Voice Note">
                                        🎤
                                    </button>
                                    <button type="submit" disabled={(!newMessage.trim() && !chatFile)} className="bg-white text-black font-bold px-5 py-3 rounded-xl text-[11px] uppercase tracking-widest hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shrink-0">
                                        Send
                                    </button>
                                </>
                            )}
                        </form>
                    </>
                )}
            </div>

            {previewData && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200 cursor-zoom-out" onClick={() => setPreviewData(null)}>
                    <button className="absolute top-6 right-6 text-white bg-[#222] border border-[#444] hover:bg-white hover:text-black rounded-full w-10 h-10 flex items-center justify-center font-bold transition shadow-lg z-10" onClick={() => setPreviewData(null)}>✕</button>
                    <img src={previewData.url} alt={previewData.name} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-[#333] cursor-default" onClick={(e) => e.stopPropagation()} />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#111] border border-[#333] text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg pointer-events-none">{previewData.name}</div>
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