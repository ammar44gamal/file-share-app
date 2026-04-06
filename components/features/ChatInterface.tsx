'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

import NetworkBackground from '../ui/NetworkBackground';
import FileThumbnail from '../ui/FileThumbnail';
import VoiceNotePlayer from '../ui/VoiceNotePlayer';

export default function ChatInterface({
    isVisible, searchQuery, setSearchQuery, handleSearchUsers, searchResults, sendFriendRequest,
    friendRequests, handleRequestAction, friends, activeChat, setActiveChat, unreadSenders,
    messages, setMessages, user, handleDownload, isTyping, newMessage, handleTyping, chatFile, setChatFile,
    chatFileInputRef, handleSendMessage, isRecording, startRecording, stopRecordingAndSend,
    cancelRecording, chatScrollRef, replyTo, setReplyTo, showAlert 
}: any) {

    const [previewData, setPreviewData] = useState<{ url: string, name: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{id: string, path: string | null} | null>(null);
    const [reactingTo, setReactingTo] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [leftView, setLeftView] = useState<'chats' | 'contacts'>('chats');
    const [pinnedChats, setPinnedChats] = useState<string[]>([]);
    const [lastActivity, setLastActivity] = useState<Record<string, number>>({});

    const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<any>(null);

    // ==========================================
    // ADVANCED WEBRTC CALLING STATE
    // ==========================================
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [isVideoCall, setIsVideoCall] = useState(false);
    const [activeCallFriendId, setActiveCallFriendId] = useState<string | null>(null);
    
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{ startX: number, startY: number, initX: number, initY: number } | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

    // CHANGED: We now have TWO audio refs! One for receiving, one for dialing out.
    const ringtoneRef = useRef<HTMLAudioElement>(null);
    const ringbackRef = useRef<HTMLAudioElement>(null);

    const myName = user?.user_metadata?.custom_username || user?.email?.split('@')[0] || 'Unknown Node';

    const prevMessagesLength = useRef(0);
    const isLoadingHistory = useRef(false);
    const prevUnread = useRef<string[]>([]);

    useEffect(() => {
        const savedPins = localStorage.getItem('filehub_pinned_chats');
        if (savedPins) setPinnedChats(JSON.parse(savedPins));
        const savedActivity = localStorage.getItem('filehub_chat_activity');
        if (savedActivity) setLastActivity(JSON.parse(savedActivity));
    }, []);

    useEffect(() => {
        setTimeout(() => {
            if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }, 10);
    }, [messages, activeChat, isTyping, chatScrollRef]);

    useEffect(() => {
        isLoadingHistory.current = true;
        const timer = setTimeout(() => { isLoadingHistory.current = false; }, 1000);
        return () => clearTimeout(timer);
    }, [activeChat?.friend_id]);

    useEffect(() => {
        if (isLoadingHistory.current) { prevMessagesLength.current = messages.length; return; }
        if (messages.length > prevMessagesLength.current && activeChat) {
            setLastActivity(prev => {
                const updated = { ...prev, [activeChat.friend_id]: Date.now() };
                localStorage.setItem('filehub_chat_activity', JSON.stringify(updated));
                return updated;
            });
        }
        prevMessagesLength.current = messages.length;
    }, [messages, activeChat]);

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

    useEffect(() => {
        let interval: any;
        if (callStatus === 'connected') interval = setInterval(() => setCallDuration(p => p + 1), 1000);
        else setCallDuration(0);
        return () => clearInterval(interval);
    }, [callStatus]);

    useEffect(() => {
        if (!isVisible && callStatus !== 'idle') setIsMinimized(true);
    }, [isVisible, callStatus]);

    // CHANGED: Split the logic for Receiver (Ringtone) vs Caller (Ringback)
    useEffect(() => {
        // Handle Receiver Ringtone
        if (callStatus === 'ringing' && ringtoneRef.current) {
            ringtoneRef.current.play().catch(e => console.log("Audio autoplay blocked by browser:", e));
        } else if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current.currentTime = 0;
        }

        // Handle Caller Ringback Tone
        if (callStatus === 'calling' && ringbackRef.current) {
            ringbackRef.current.play().catch(e => console.log("Audio autoplay blocked by browser:", e));
        } else if (ringbackRef.current) {
            ringbackRef.current.pause();
            ringbackRef.current.currentTime = 0;
        }
    }, [callStatus]);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!isMinimized) return;
        dragRef.current = { startX: e.clientX, startY: e.clientY, initX: pipPos.x, initY: pipPos.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isMinimized || !dragRef.current) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPipPos({ x: dragRef.current.initX + dx, y: dragRef.current.initY + dy });
    };
    const handlePointerUp = (e: React.PointerEvent) => {
        dragRef.current = null;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    // ==========================================
    // BULLETPROOF WEBRTC SIGNALING LOGIC
    // ==========================================
    useEffect(() => {
        if (!user) return;
        const channel = supabase.channel('webrtc-global')
            .on('broadcast', { event: 'call-signal' }, async (payload: any) => {
                const data = payload.payload;
                if (data.target_id !== user.id) return;

                if (data.type === 'offer') {
                    setIncomingCall({ caller_id: data.sender_id, caller_name: data.caller_name, offer: data.offer, isVideo: data.isVideo });
                    setCallStatus('ringing');
                    setActiveCallFriendId(data.sender_id);
                    setIsVideoCall(data.isVideo);
                } 
                else if (data.type === 'answer') {
                    if (peerConnectionRef.current) {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                        setCallStatus('connected');
                        
                        for (const candidate of pendingCandidates.current) {
                            try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) { console.log(e); }
                        }
                        pendingCandidates.current = [];
                    }
                } 
                else if (data.type === 'candidate') {
                    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                        try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e) { console.log(e); }
                    } else {
                        pendingCandidates.current.push(data.candidate);
                    }
                } 
                else if (data.type === 'reject') {
                    cleanupCall();
                    if (showAlert) showAlert("Call Declined", "The user declined your call.");
                    insertCallLog(data.isVideo ? '❌ Missed Video Call' : '❌ Missed Voice Call', data.sender_id);
                } else if (data.type === 'cancel') {
                    cleanupCall();
                    if (showAlert) showAlert("Call Canceled", "The caller hung up before you answered.");
                } else if (data.type === 'end') {
                    cleanupCall();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, showAlert]);

    const sendSignal = (type: string, target_id: string, extraData: any = {}) => {
        supabase.channel('webrtc-global').send({
            type: 'broadcast',
            event: 'call-signal',
            payload: { type, target_id, sender_id: user.id, ...extraData }
        });
    };

    const insertCallLog = async (text: string, targetId: string) => {
        await supabase.from('messages').insert([{ sender_id: user.id, receiver_id: targetId, content: text, is_read: false }]);
    };

    const cleanupCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        
        setCallStatus('idle');
        setIncomingCall(null);
        setActiveCallFriendId(null);
        setIsMinimized(false);
        setIsMuted(false);
        setIsVideoOff(false);
        setPipPos({ x: 0, y: 0 }); 
        pendingCandidates.current = [];
    };

    const createPeerConnection = (targetId: string) => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        
        pc.onicecandidate = (event) => {
            if (event.candidate) sendSignal('candidate', targetId, { candidate: event.candidate });
        };
        
        pc.ontrack = (event) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        };
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
        }
        
        peerConnectionRef.current = pc;
        return pc;
    };

    const startCall = async (isVideo: boolean) => {
        if (!activeChat) return;
        setIsVideoCall(isVideo);
        setActiveCallFriendId(activeChat.friend_id);
        setCallStatus('calling');
        pendingCandidates.current = [];
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const pc = createPeerConnection(activeChat.friend_id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignal('offer', activeChat.friend_id, { offer, caller_name: myName, isVideo });
        } catch (err) {
            if (showAlert) showAlert("Device Error", "Could not access microphone or camera.");
            cleanupCall();
        }
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        setCallStatus('connected');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.isVideo, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const pc = createPeerConnection(incomingCall.caller_id);
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
            
            for (const candidate of pendingCandidates.current) {
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) { console.log(e); }
            }
            pendingCandidates.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            sendSignal('answer', incomingCall.caller_id, { answer });
        } catch (err) {
            if (showAlert) showAlert("Device Error", "Could not access microphone or camera.");
            rejectCall();
        }
    };

    const rejectCall = () => {
        if (incomingCall) sendSignal('reject', incomingCall.caller_id);
        cleanupCall();
    };

    const cancelCall = () => {
        if (activeCallFriendId) {
            sendSignal('cancel', activeCallFriendId);
            insertCallLog(isVideoCall ? '❌ Canceled Video Call' : '❌ Canceled Voice Call', activeCallFriendId);
        }
        cleanupCall();
    };

    const endCall = () => {
        if (activeCallFriendId) {
            sendSignal('end', activeCallFriendId);
            insertCallLog(isVideoCall ? `📹 Video Call - ${formatDuration(callDuration)}` : `📞 Voice Call - ${formatDuration(callDuration)}`, activeCallFriendId);
        }
        cleanupCall();
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!isMuted);
        }
    };
    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    const togglePin = (friendId: string) => {
        setPinnedChats(prev => {
            const isPinned = prev.includes(friendId);
            let newPins = [];
            if (isPinned) newPins = prev.filter(id => id !== friendId);
            else if (prev.length < 3) newPins = [...prev, friendId];
            else { if(showAlert) showAlert("Notice", "You can only pin up to 3 chats."); return prev; }
            localStorage.setItem('filehub_pinned_chats', JSON.stringify(newPins));
            return newPins;
        });
    };

    const sortedFriends = [...friends].sort((a, b) => {
        const aPinned = pinnedChats.includes(a.friend_id);
        const bPinned = pinnedChats.includes(b.friend_id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aUnread = unreadSenders.includes(a.friend_id);
        const bUnread = unreadSenders.includes(b.friend_id);
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;

        const aTime = lastActivity[a.friend_id] || 0;
        const bTime = lastActivity[b.friend_id] || 0;
        if (aTime === bTime) return a.username.localeCompare(b.username); 
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

    const executeForward = async (friendId: string) => {
        if (!forwardingMessage) return;
        const { error } = await supabase.from('messages').insert([{
            sender_id: user.id, receiver_id: friendId, content: forwardingMessage.content,
            file_path: forwardingMessage.file_path, file_name: forwardingMessage.file_name, is_read: false, is_forwarded: true
        }]);
        if (error && showAlert) showAlert("Error", "Failed to forward message: " + error.message);
        setForwardingMessage(null);
    };

    const parseReactions = (reactions: any) => {
        if (!reactions) return {};
        if (typeof reactions === 'string') { try { return JSON.parse(reactions); } catch (e) { return {}; } }
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
        <>
            {/* CHANGED: We now have two separate audio players loaded from your public folder */}
            <audio ref={ringtoneRef} src="/ringtone.mp3" loop preload="auto" />
            <audio ref={ringbackRef} src="/ringback.mp3" loop preload="auto" />
            
            {/* MAIN CHAT UI - Hidden if !isVisible so you can look at folders! */}
            <div className={`${isVisible ? 'flex' : 'hidden'} animate-in slide-in-from-bottom-4 duration-500 h-full relative bg-transparent md:bg-black/50 md:backdrop-blur-xl md:border border-[#222] rounded-xl shadow-2xl overflow-hidden flex-col md:flex-row`}>
                
                {/* LEFT SIDEBAR */}
                <div className={`w-full md:w-72 lg:w-80 flex-col border-r border-[#222] bg-transparent shrink-0 h-full ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-[#222] flex justify-between items-center bg-transparent">
                        <h2 className="font-bold text-white text-sm tracking-wide">{leftView === 'chats' ? 'Messages' : 'Network Nodes'}</h2>
                        <button onClick={() => setLeftView(leftView === 'chats' ? 'contacts' : 'chats')} className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-white bg-[#111] border border-[#333] hover:bg-[#222] px-2.5 py-1.5 rounded transition">
                            {leftView === 'chats' ? '+ Add' : '← Back'}
                        </button>
                    </div>
                    {leftView === 'chats' && (
                        <div className="flex-1 overflow-y-auto scrollbar-hide bg-transparent">
                            {friends.length === 0 ? ( <div className="p-6 text-center text-xs text-[#666] italic">No established connections. Click '+ Add' to find users.</div> ) : (
                                sortedFriends.map((f: any) => {
                                    const isPinned = pinnedChats.includes(f.friend_id);
                                    const isUnread = unreadSenders.includes(f.friend_id);
                                    const isActive = activeChat?.friendship_id === f.friendship_id;
                                    return (
                                        <div key={f.friendship_id} onClick={() => setActiveChat(f)} className={`group flex items-center gap-3 p-3 cursor-pointer border-b border-[#222]/50 transition ${isActive ? 'bg-[#111] border-l-2 border-l-white' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}>
                                            <div className="w-11 h-11 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-slate-200 font-bold text-lg shrink-0 relative">
                                                {f.username.charAt(0).toUpperCase()}
                                                {isUnread && <span className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#111]"></span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h4 className={`text-[13px] truncate ${isUnread ? 'font-bold text-white' : 'text-slate-200'}`}>{f.username}</h4>
                                                    <button onClick={(e) => { e.stopPropagation(); togglePin(f.friend_id); }} className={`text-[10px] p-1 rounded-full transition ${isPinned ? 'text-blue-500 opacity-100' : 'text-[#555] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[#333]'}`} title={isPinned ? "Unpin Chat" : "Pin Chat"}>📌</button>
                                                </div>
                                                <p className={`text-[11px] truncate ${isUnread ? 'text-blue-400 font-medium' : 'text-[#666]'}`}>{isUnread ? 'New encrypted message' : 'Tap to view channel...'}</p>
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
                            <div className="px-4 py-3 border-b border-[#222] bg-transparent z-10 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveChat(null)} className="md:hidden text-[#888] hover:text-white pr-2 border-r border-[#333]">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><polyline points="12 19 5 12 12 5"></polyline></svg>
                                    </button>
                                    <div className="w-9 h-9 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-slate-200 font-bold shrink-0">
                                        {activeChat.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm leading-tight">{activeChat.username}</p>
                                        <p className="text-green-500 text-[9px] font-bold uppercase tracking-widest">End-to-End Encrypted</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 md:gap-3">
                                    <button onClick={() => startCall(false)} className="text-[#888] hover:text-green-500 bg-[#111] p-2 rounded-full border border-[#333] hover:border-green-500/50 transition shadow-lg" title="Voice Call">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </button>
                                    <button onClick={() => startCall(true)} className="text-[#888] hover:text-blue-500 bg-[#111] p-2 rounded-full border border-[#333] hover:border-blue-500/50 transition shadow-lg" title="Video Call">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                                    </button>
                                </div>
                            </div>

                            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 md:p-6 space-y-1.5 z-10 relative bg-transparent scroll-smooth">
                                
                                {reactingTo && <div className="fixed inset-0 z-[40]" onClick={() => setReactingTo(null)}></div>}
                                {messageMenuOpen && <div className="fixed inset-0 z-[40]" onClick={() => setMessageMenuOpen(null)}></div>}

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
                                        const repliedMsg = msg.reply_to_id ? messages.find((m: any) => m.id === msg.reply_to_id) : null;

                                        const isCallLog = msg.content && (msg.content.startsWith('📞') || msg.content.startsWith('📹') || msg.content.startsWith('❌'));
                                        
                                        if (isCallLog) {
                                            return (
                                                <div key={msg.id} className="flex justify-center mb-4 mt-2">
                                                    <div className="bg-[#111] border border-[#333] px-4 py-1.5 rounded-full flex items-center gap-2 shadow-md">
                                                        <span className={`text-[11px] font-medium ${msg.content.startsWith('❌') ? 'text-red-400' : 'text-slate-300'}`}>{msg.content}</span>
                                                        <span className="text-[9px] text-[#666] border-l border-[#333] pl-2">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            );
                                        }

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
                                            <div key={msg.id} id={`msg-${msg.id}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'} group items-center gap-2 relative mb-5 ${(reactingTo === msg.id || messageMenuOpen === msg.id) ? 'z-[50]' : 'z-10'}`}>
                                                
                                                {reactingTo === msg.id && (
                                                    <div className={`absolute bottom-[calc(100%+4px)] ${isMine ? 'right-0' : 'left-0'} z-[70] bg-[#111] border border-[#333] rounded-full shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex items-center px-3 py-2 gap-2 animate-in zoom-in-95 duration-200`}>
                                                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                                                            <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReact(msg.id, emoji, msg.reactions); }} className="hover:scale-125 hover:-translate-y-1 transition-all text-xl focus:outline-none">{emoji}</button>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className={`opacity-100 md:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200 shrink-0 z-10 ${isMine ? 'order-1' : 'order-2'}`}>
                                                    <button onClick={() => setReactingTo(msg.id)} className="text-[#888] hover:text-white bg-[#111] border border-[#333] hover:bg-[#222] rounded-full p-1.5 flex items-center justify-center shadow-lg transition-colors" title="React">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                                                    </button>
                                                    
                                                    <div className="relative">
                                                        <button onClick={() => setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id)} className="text-[#888] hover:text-white bg-[#111] border border-[#333] hover:bg-[#222] rounded-full p-1.5 flex items-center justify-center shadow-lg transition-colors" title="Menu">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                        </button>
                                                        
                                                        {messageMenuOpen === msg.id && (
                                                            <div className={`absolute ${isMine ? 'right-0' : 'left-0'} bottom-full mb-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl z-[80] w-36 overflow-hidden flex flex-col text-left animate-in fade-in zoom-in-95 origin-bottom`}>
                                                                <button onClick={() => { setReplyTo(msg); setMessageMenuOpen(null); }} className="px-4 py-2.5 text-xs text-white hover:bg-[#333] flex items-center gap-2 transition">↩ Reply</button>
                                                                <button onClick={() => { setForwardingMessage(msg); setMessageMenuOpen(null); }} className="px-4 py-2.5 text-xs text-white hover:bg-[#333] flex items-center gap-2 transition">➦ Forward</button>
                                                                {isMine && (
                                                                    <button onClick={() => { setConfirmDelete({id: msg.id, path: msg.file_path}); setMessageMenuOpen(null); }} className="px-4 py-2.5 text-xs text-red-500 hover:bg-[#333] flex items-center gap-2 border-t border-[#333] transition">🗑 Delete</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className={`max-w-[85%] md:max-w-[60%] rounded-xl px-3 py-2 shadow-md z-10 relative ${isMine ? 'order-2 bg-blue-600 text-white rounded-br-none' : 'order-1 bg-[#0a0a0a] border border-[#222] text-slate-200 rounded-bl-none'}`}>
                                                    
                                                    {msg.is_forwarded && (
                                                        <div className="flex items-center gap-1 text-[9px] text-white/60 mb-1 italic font-medium">
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 10 20 15 15 20"></polyline><path d="M4 4v7a4 4 0 0 0 4 4h12"></path></svg>
                                                            Forwarded
                                                        </div>
                                                    )}

                                                    {msg.reply_to_id && (
                                                        <div onClick={() => document.getElementById('msg-' + msg.reply_to_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className={`border-l-4 ${isMine ? 'bg-black/20 border-white/50 hover:bg-black/30' : 'bg-[#1a1a1a] border-blue-500 hover:bg-[#222]'} p-1.5 mb-1.5 rounded shadow-sm text-left cursor-pointer transition`}>
                                                            <p className={`text-[10px] font-bold mb-0.5 ${isMine ? 'text-white' : 'text-blue-400'}`}>{repliedMsg ? (repliedMsg.sender_id === user.id ? 'You' : activeChat.username) : 'Message'}</p>
                                                            <p className="text-[11px] text-white/70 truncate">{repliedMsg?.content || (repliedMsg?.file_name ? `📎 ${repliedMsg.file_name}` : 'Message unavailable')}</p>
                                                        </div>
                                                    )}
                                                    
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
                                                        {isMine && ( <span className={`tracking-tighter ${msg.is_read ? 'text-[#38bdf8] font-black' : 'text-white opacity-50 font-bold'}`}>✓✓</span> )}
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

                            <form onSubmit={handleSendMessage} className="p-3 bg-transparent border-t border-[#222] z-10 flex flex-col gap-2 shrink-0">
                                
                                {replyTo && (
                                    <div className="flex items-center justify-between bg-[#111] border-l-4 border-blue-500 p-2 rounded-xl mx-1 shadow-inner animate-in slide-in-from-bottom-2">
                                        <div className="flex-1 min-w-0 pl-2">
                                            <p className="text-[11px] text-blue-400 font-bold">{replyTo.sender_id === user.id ? 'You' : activeChat.username}</p>
                                            <p className="text-[12px] text-[#aaa] truncate">{replyTo.content || (replyTo.file_name ? `📎 ${replyTo.file_name}` : 'Voice Note')}</p>
                                        </div>
                                        <button type="button" onClick={() => setReplyTo(null)} className="text-[#666] hover:text-white w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#333] transition">✕</button>
                                    </div>
                                )}

                                <div className="flex gap-2 items-center w-full">
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
                                        <button type="button" onClick={stopRecordingAndSend} className="bg-red-600 text-white font-bold px-4 py-3 rounded-xl text-[11px] uppercase tracking-widest hover:bg-red-500 transition shadow-lg shrink-0">Send</button>
                                    ) : (
                                        <>
                                            <button type="button" onClick={startRecording} className="bg-[#111] border border-[#333] text-white hover:bg-[#222] p-3 rounded-xl transition shrink-0" title="Voice Note">🎤</button>
                                            <button type="submit" disabled={(!newMessage.trim() && !chatFile)} className="bg-white text-black font-bold px-5 py-3 rounded-xl text-[11px] uppercase tracking-widest hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shrink-0">Send</button>
                                        </>
                                    )}
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {/* ========================================== */}
            {/* DRAGGABLE PICTURE-IN-PICTURE WEBRTC UI */}
            {/* ========================================== */}
            {callStatus !== 'idle' && (
                <div 
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={isMinimized ? { transform: `translate(${pipPos.x}px, ${pipPos.y}px)` } : {}}
                    className={`z-[1000] transition-all duration-300 ${isMinimized ? 'fixed bottom-6 right-6 w-48 md:w-56 h-32 md:h-40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-[#444] bg-[#050505] overflow-hidden cursor-grab active:cursor-grabbing touch-none' : 'absolute inset-0 bg-[#050505] rounded-xl flex flex-col items-center justify-center overflow-hidden animate-in fade-in zoom-in-95'}`}
                >
                    
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black pointer-events-none"></div>
                    
                    <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="absolute top-3 left-3 z-50 bg-black/50 hover:bg-black/80 border border-[#444] text-white p-1.5 rounded-full backdrop-blur transition shadow-lg cursor-pointer">
                        {isMinimized ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>}
                    </button>

                    <video ref={remoteVideoRef} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${(callStatus === 'connected' && isVideoCall) ? 'opacity-100' : 'opacity-0'}`} />
                    
                    {/* Local Video - Bumped up to bottom-32 so it doesn't overlap action buttons */}
                    <div className={`absolute ${isMinimized ? 'bottom-2 right-2 w-12 h-16 border-[#444]' : 'bottom-32 right-6 w-32 h-48 border-[#333]'} bg-black border rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] z-20 transition-all duration-500 ${(isVideoCall && !isVideoOff && (callStatus === 'connected' || callStatus === 'calling')) ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    </div>

                    <div className={`z-10 flex flex-col items-center justify-center transition-opacity duration-500 ${(callStatus === 'connected' && isVideoCall && !isMinimized) ? 'opacity-0' : 'opacity-100'} ${isMinimized ? 'h-full pt-4' : 'mb-12'}`}>
                        <div className={`${isMinimized ? 'w-10 h-10 text-lg mb-1.5' : 'w-28 h-28 text-5xl mb-6 border-2'} rounded-full bg-[#111] border-[#333] flex items-center justify-center text-slate-200 font-bold shadow-[0_0_50px_rgba(0,0,0,0.5)] relative pointer-events-none`}>
                            {activeChat?.username?.charAt(0).toUpperCase() || incomingCall?.caller_name?.charAt(0).toUpperCase()}
                            {callStatus === 'ringing' && <span className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-50"></span>}
                        </div>
                        <h2 className={`text-white font-bold tracking-tight pointer-events-none ${isMinimized ? 'text-xs mb-0.5' : 'text-3xl mb-2'}`}>
                            {activeChat?.username || incomingCall?.caller_name}
                        </h2>
                        
                        <p className={`text-[#888] font-bold pointer-events-none ${isMinimized ? 'text-[8px]' : 'text-xs uppercase tracking-widest animate-pulse'}`}>
                            {callStatus === 'calling' ? `Requesting Secure ${isVideoCall ? 'Video' : 'Voice'} Call...` : callStatus === 'ringing' ? `Incoming Encrypted ${isVideoCall ? 'Video' : 'Voice'} Call...` : formatDuration(callDuration)}
                        </p>
                    </div>

                    <div className={`z-20 flex items-center justify-center gap-3 md:gap-6 absolute inset-x-0 ${isMinimized ? 'bottom-2' : 'bottom-10 md:bottom-12'}`}>
                        {callStatus === 'ringing' ? (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); rejectCall(); }} className={`${isMinimized ? 'w-8 h-8' : 'w-16 h-16'} bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition hover:scale-110 shadow-[0_0_20px_rgba(220,38,38,0.4)] text-white cursor-pointer`}>
                                    <svg width={isMinimized ? 14 : 28} height={isMinimized ? 14 : 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); acceptCall(); }} className={`${isMinimized ? 'w-8 h-8' : 'w-16 h-16'} bg-green-600 rounded-full flex items-center justify-center hover:bg-green-500 transition hover:scale-110 shadow-[0_0_20px_rgba(22,163,74,0.4)] text-white animate-bounce cursor-pointer`}>
                                    <svg width={isMinimized ? 14 : 28} height={isMinimized ? 14 : 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </button>
                            </>
                        ) : (
                            <>
                                {isVideoCall && (
                                    <button onClick={(e) => { e.stopPropagation(); toggleVideo(); }} className={`${isMinimized ? 'w-8 h-8' : 'w-14 h-14'} bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition text-white border border-white/20 cursor-pointer ${isVideoOff ? 'text-red-400 bg-red-900/20' : ''}`}>
                                        {isVideoOff ? <svg width={isMinimized ? 12 : 20} height={isMinimized ? 12 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width={isMinimized ? 12 : 20} height={isMinimized ? 12 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>}
                                    </button>
                                )}
                                
                                <button onClick={(e) => { e.stopPropagation(); callStatus === 'calling' ? cancelCall() : endCall(); }} className={`${isMinimized ? 'w-10 h-10' : 'w-16 h-16'} bg-red-600 rounded-full flex items-center justify-center hover:bg-red-500 transition hover:scale-110 shadow-[0_0_20px_rgba(220,38,38,0.4)] text-white cursor-pointer`}>
                                    <svg width={isMinimized ? 16 : 28} height={isMinimized ? 16 : 28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
                                </button>
                                
                                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className={`${isMinimized ? 'w-8 h-8' : 'w-14 h-14'} bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition text-white border border-white/20 cursor-pointer ${isMuted ? 'text-red-400 bg-red-900/20' : ''}`}>
                                    {isMuted ? <svg width={isMinimized ? 12 : 20} height={isMinimized ? 12 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> : <svg width={isMinimized ? 12 : 20} height={isMinimized ? 12 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* FORWARDING OVERLAY */}
            {forwardingMessage && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-[#333] rounded-xl p-5 w-full max-w-sm shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-[#333] pb-3">
                            <h3 className="text-white font-bold text-sm">Forward to...</h3>
                            <button onClick={() => setForwardingMessage(null)} className="text-[#888] hover:text-white bg-[#222] rounded-full w-6 h-6 flex items-center justify-center">✕</button>
                        </div>
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto scrollbar-hide">
                            {friends.map((f: any) => (
                                <button key={f.friend_id} onClick={() => executeForward(f.friend_id)} className="w-full flex items-center justify-between p-3 bg-[#1a1a1a] border border-[#222] hover:border-[#444] rounded-lg transition group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-white font-bold text-xs">
                                            {f.username.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white text-sm font-bold">{f.username}</span>
                                    </div>
                                    <span className="text-[#444] group-hover:text-blue-500 transition">➦</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* PREVIEW OVERLAY */}
            {previewData && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200 cursor-zoom-out" onClick={() => setPreviewData(null)}>
                    <button className="absolute top-6 right-6 text-white bg-[#222] border border-[#444] hover:bg-white hover:text-black rounded-full w-10 h-10 flex items-center justify-center font-bold transition shadow-lg z-10" onClick={() => setPreviewData(null)}>✕</button>
                    <img src={previewData.url} alt={previewData.name} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-[#333] cursor-default" onClick={(e) => e.stopPropagation()} />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#111] border border-[#333] text-white px-6 py-2.5 rounded-full text-xs font-bold shadow-lg pointer-events-none">{previewData.name}</div>
                </div>
            )}

            {/* DELETE OVERLAY */}
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
        </>
    );
}