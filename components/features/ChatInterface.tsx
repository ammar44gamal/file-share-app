'use client';

import NetworkBackground from '../ui/NetworkBackground';
import FileThumbnail from '../ui/FileThumbnail';
import VoiceNotePlayer from '../ui/VoiceNotePlayer';

export default function ChatInterface({
    searchQuery, setSearchQuery, handleSearchUsers, searchResults, sendFriendRequest,
    friendRequests, handleRequestAction, friends, activeChat, setActiveChat, unreadSenders,
    messages, user, handleDownload, isTyping, newMessage, handleTyping, chatFile, setChatFile,
    chatFileInputRef, handleSendMessage, isRecording, startRecording, stopRecordingAndSend,
    cancelRecording, chatScrollRef
}: any) {
    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 h-full">
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 md:gap-6 h-full">
                
                {/* LEFT COLUMN: SEARCH & REQUESTS */}
                <div className="space-y-4 md:space-y-6 flex-shrink-0">
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

                {/* RIGHT COLUMN: FRIENDS LIST & LIVE CHAT WINDOW */}
                {/* Changed: Switched from fixed pixel height to Viewport Height (vh) so it dynamically fills the screen */}
                <div className="lg:col-span-2 bg-[#111]/80 backdrop-blur-md border border-[#333] p-3 md:p-4 rounded-xl shadow-2xl flex flex-col h-[65vh] md:h-[75vh] lg:h-[80vh] min-h-[500px]">
                    <h3 className="font-bold text-base mb-3 text-white hidden md:block pl-1">Connected Friends</h3>
                    
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
                                {/* CHAT HEADER */}
                                <div className="px-3 py-2 border-b border-[#222] bg-[#111] z-10 flex justify-between items-center shrink-0">
                                    <div>
                                        <p className="text-green-500 text-[8px] font-bold uppercase tracking-widest">Secure Channel</p>
                                        <p className="text-white font-bold text-xs leading-tight">{activeChat.username}</p>
                                    </div>
                                    <button onClick={() => setActiveChat(null)} className="text-[#888] hover:text-white text-[10px] font-bold px-2 py-1 border border-[#333] rounded hover:bg-[#333]">✕</button>
                                </div>

                                {/* CHAT MESSAGES */}
                                {/* Changed: Tighter spacing (space-y-1.5) and less padding */}
                                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-2 md:p-3 space-y-1.5 z-10">
                                    {messages.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-[#444] text-[10px] font-bold uppercase tracking-widest italic text-center px-4">
                                            No messages yet. Begin transmission.
                                        </div>
                                    ) : (
                                        messages.map((msg: any) => {
                                            const isMine = msg.sender_id === user.id;
                                            const isVoiceNote = msg.file_name === 'Voice Note.webm';
                                            
                                            return (
                                                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                    {/* Changed: Smaller bubbles (px-2.5 py-1.5) and restricted max-width to 60% */}
                                                    <div className={`max-w-[85%] md:max-w-[60%] rounded-xl px-2.5 py-1.5 shadow-md ${isMine ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#222] text-slate-200 rounded-bl-none'}`}>
                                                        
                                                        {/* Changed: Text size shrunk to text-xs */}
                                                        {msg.content && <p className="text-xs whitespace-pre-wrap break-words leading-snug">{msg.content}</p>}
                                                        
                                                        {/* SMART FILE/AUDIO RENDERER */}
                                                        {msg.file_name && (
                                                            <div className={`mt-1 flex flex-col gap-1 p-1 rounded-lg border ${isMine ? 'bg-blue-700/50 border-blue-500/30' : 'bg-[#111] border-[#444]'}`}>
                                                                {isVoiceNote ? (
                                                                    <VoiceNotePlayer path={msg.file_path} isMine={isMine} />
                                                                ) : (
                                                                    <FileThumbnail path={msg.file_path} fileName={msg.file_name} isChat={true} />
                                                                )}
                                                                
                                                                {!isVoiceNote && (
                                                                    <div className="flex items-center justify-between gap-2 px-1 mt-0.5">
                                                                        <span className="text-[9px] truncate max-w-[80px] md:max-w-[120px] font-medium opacity-80">{msg.file_name}</span>
                                                                        <button onClick={() => handleDownload(msg.file_path, msg.file_name)} className="text-[9px] font-bold shrink-0 bg-black/30 hover:bg-black/50 px-1.5 py-0.5 rounded transition">💾 Save</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {/* WHATSAPP STYLE READ RECEIPTS */}
                                                        <span className={`text-[7px] block mt-0.5 flex items-center ${isMine ? 'justify-end gap-1 opacity-90' : 'justify-start opacity-60'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            {isMine && (
                                                                <span className={`text-[9px] tracking-tighter ${msg.is_read ? 'text-cyan-300 font-black' : 'text-white/60'}`}>
                                                                    ✓✓
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    {/* TYPING INDICATOR */}
                                    {isTyping && (
                                        <div className="flex justify-start">
                                            <div className="bg-[#222] text-[#888] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl rounded-bl-none animate-pulse">
                                                {activeChat.username} is typing...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* CHAT INPUT FORM */}
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
            </div>
        </div>
    );
}