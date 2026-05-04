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
    const [leftView, setLeftView] = useState<'chats' | 'search' | 'requests'>('chats');
    const [pinnedChats, setPinnedChats] = useState<string[]>([]);
    const [lastActivity, setLastActivity] = useState<Record<string, number>>({});
    const [messageMenuOpen, setMessageMenuOpen] = useState<string | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<any>(null);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    // WebRTC
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
    const ringtoneRef = useRef<HTMLAudioElement>(null);
    const ringbackRef = useRef<HTMLAudioElement>(null);

    const myName = user?.user_metadata?.custom_username || user?.email?.split('@')[0] || 'Unknown Node';

    // ==========================================
    // PRESENCE TRACKING: Only Online in Chats
    // ==========================================
    useEffect(() => {
        if (!user || !isVisible) return; 

        const presenceChannel = supabase.channel('global-presence', {
            config: { presence: { key: user.id } },
        });
        
        presenceChannel.on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            setOnlineUsers(Object.keys(state));
        }).subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({ online_at: new Date().toISOString() });
            }
        });
        
        return () => { supabase.removeChannel(presenceChannel); };
    }, [user, isVisible]);

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
        let interval: any;
        if (callStatus === 'connected') interval = setInterval(() => setCallDuration(p => p + 1), 1000);
        else setCallDuration(0);
        return () => clearInterval(interval);
    }, [callStatus]);

    useEffect(() => {
        if (callStatus === 'ringing' && ringtoneRef.current) ringtoneRef.current.play().catch(() => {});
        else ringtoneRef.current?.pause();
        if (callStatus === 'calling' && ringbackRef.current) ringbackRef.current.play().catch(() => {});
        else ringbackRef.current?.pause();
    }, [callStatus]);

    // WebRTC Signaling Logic
    useEffect(() => {
        if (!user) return;
        const channel = supabase.channel('webrtc-global')
            .on('broadcast', { event: 'call-signal' }, async (payload: any) => {
                const data = payload.payload;
                if (data.target_id !== user.id) return;

                if (data.type === 'offer') {
                    setIncomingCall({ caller_id: data.sender_id, caller_name: data.caller_name, offer: data.offer, isVideo: data.isVideo });
                    setCallStatus('ringing');
                    setIsVideoCall(data.isVideo);
                } 
                else if (data.type === 'answer') {
                    if (peerConnectionRef.current) {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                        setCallStatus('connected');
                        pendingCandidates.current.forEach(c => peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(c)));
                        pendingCandidates.current = [];
                    }
                } 
                else if (data.type === 'candidate') {
                    if (peerConnectionRef.current?.remoteDescription) peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    else pendingCandidates.current.push(data.candidate);
                } 
                else if (['reject', 'cancel', 'end'].includes(data.type)) cleanupCall();
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);

    const createPeerConnection = (targetId: string) => {
        const pc = new RTCPeerConnection({ 
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                {
                    urls: ['turn:filehub-webrtc.metered.live:80', 'turn:filehub-webrtc.metered.live:443', 'turns:filehub-webrtc.metered.live:443'],
                    username: 'd3e3032b901becb839b91bab',             
                    credential: 'e+/TAdE3L+M0zJsN'          
                }
            ] 
        });
        pc.onicecandidate = (e) => { if (e.candidate) sendSignal('candidate', targetId, { candidate: e.candidate }); };
        pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
        peerConnectionRef.current = pc; return pc;
    };

    const cleanupCall = () => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        peerConnectionRef.current?.close();
        setCallStatus('idle'); setIncomingCall(null);
    };

    const sendSignal = (type: string, target_id: string, extraData: any = {}) => {
        supabase.channel('webrtc-global').send({ type: 'broadcast', event: 'call-signal', payload: { type, target_id, sender_id: user.id, ...extraData } });
    };

    const startCall = async (isVideo: boolean) => {
        if (!activeChat) return;
        setCallStatus('calling'); setIsVideoCall(isVideo);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const pc = createPeerConnection(activeChat.friend_id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal('offer', activeChat.friend_id, { offer, caller_name: myName, isVideo });
        } catch { showAlert("Error", "Media access failed."); cleanupCall(); }
    };

    const acceptCall = async () => {
        setCallStatus('connected');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.isVideo, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            const pc = createPeerConnection(incomingCall.caller_id);
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal('answer', incomingCall.caller_id, { answer });
        } catch { cleanupCall(); }
    };

    const parseReactions = (r: any) => { try { return typeof r === 'string' ? JSON.parse(r) : (r || {}); } catch { return {}; } };

    return (
        <>
            <audio ref={ringtoneRef} src="/ringtone.mp3" loop preload="auto" />
            <audio ref={ringbackRef} src="/ringback.mp3" loop preload="auto" />
            
            <div className={`${isVisible ? 'flex' : 'hidden'} h-full relative bg-transparent md:bg-black/50 md:backdrop-blur-xl border-[#222] rounded-xl overflow-hidden flex-col md:flex-row`}>
                <div className={`w-full md:w-72 flex-col border-r border-[#222] shrink-0 h-full ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-[#222] flex justify-between items-center">
                        <h2 className="font-bold text-white text-sm">{leftView === 'chats' ? 'Messages' : 'Network Nodes'}</h2>
                        <button onClick={() => setLeftView(leftView==='chats'?'search':'chats')} className="text-[10px] bg-[#111] px-2 py-1 rounded">{leftView==='chats'?'+ Add':'Back'}</button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {leftView === 'chats' ? friends.map((f: any) => (
                            <div key={f.friendship_id} onClick={() => setActiveChat(f)} className={`p-3 cursor-pointer border-b border-[#222]/50 ${activeChat?.friend_id === f.friend_id ? 'bg-[#111]' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center relative">
                                        {f.username[0].toUpperCase()}
                                        {onlineUsers.includes(f.friend_id) && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />}
                                    </div>
                                    <span className="text-sm">{f.username}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="p-4">
                                <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Username..." className="w-full bg-[#111] p-2 rounded border border-[#333] text-sm" />
                                <button onClick={handleSearchUsers} className="w-full mt-2 bg-white text-black text-xs font-bold py-2 rounded">Scan</button>
                                {searchResults.map((r:any)=>(
                                    <div key={r.id} className="mt-2 flex justify-between items-center p-2 bg-[#0a0a0a] rounded border border-[#222]">
                                        <span className="text-xs">{r.username}</span>
                                        <button onClick={()=>sendFriendRequest(r.id)} className="text-[9px] text-blue-400">Connect</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={`flex-1 flex flex-col h-full bg-transparent ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
                    {!activeChat ? <div className="flex-1 flex items-center justify-center"><NetworkBackground /><p className="text-[#666] text-xs z-10">Select a node to begin</p></div> : (
                        <>
                            <div className="p-4 border-b border-[#222] flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveChat(null)} className="md:hidden">←</button>
                                    <span className="font-bold">{activeChat.username}</span>
                                    <span className={`text-[9px] ${onlineUsers.includes(activeChat.friend_id) ? 'text-green-500' : 'text-[#444]'}`}>●</span>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => startCall(false)}>📞</button>
                                    <button onClick={() => startCall(true)}>📹</button>
                                </div>
                            </div>
                            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map((msg: any) => {
                                    const isMine = msg.sender_id === user.id;
                                    return (
                                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-3 rounded-xl ${isMine ? 'bg-blue-600 rounded-br-none' : 'bg-[#111] border border-[#222] rounded-bl-none'}`}>
                                                {msg.reply_to_id && <div className="text-[10px] opacity-50 border-l-2 pl-2 mb-1">Replying...</div>}
                                                <p className="text-sm">{msg.content}</p>
                                                {msg.file_name && <div className="mt-2 bg-black/20 p-2 rounded text-[10px]">{msg.file_name}</div>}
                                                <span className="text-[8px] opacity-40 mt-1 block">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <form onSubmit={handleSendMessage} className="p-4 border-t border-[#222] flex gap-2">
                                <input value={newMessage} onChange={handleTyping} placeholder="Encrypted message..." className="flex-1 bg-[#111] p-3 rounded-xl text-sm border border-[#333] focus:border-white outline-none" />
                                <button type="button" onClick={isRecording?stopRecordingAndSend:startRecording} className={`p-3 rounded-xl ${isRecording?'bg-red-600':'bg-[#111]'}`}>{isRecording?'🛑':'🎤'}</button>
                                <button type="submit" className="bg-white text-black px-4 rounded-xl text-xs font-bold">SEND</button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            {callStatus !== 'idle' && (
                <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center">
                    <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                    <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-10 right-10 w-32 h-48 border-2 border-white/20 rounded-xl object-cover" />
                    <div className="z-10 text-center">
                        <div className="w-24 h-24 bg-[#222] rounded-full mx-auto mb-4 flex items-center justify-center text-3xl font-bold">
                            {(incomingCall?.caller_name || activeChat?.username || '?')[0].toUpperCase()}
                        </div>
                        <h2 className="text-2xl font-bold">{incomingCall?.caller_name || activeChat?.username}</h2>
                        <p className="text-xs text-blue-400 mt-2 uppercase tracking-widest">{callStatus}...</p>
                    </div>
                    <div className="absolute bottom-20 flex gap-8">
                        {callStatus === 'ringing' ? (
                            <>
                                <button onClick={acceptCall} className="w-16 h-16 bg-green-600 rounded-full">✓</button>
                                <button onClick={cleanupCall} className="w-16 h-16 bg-red-600 rounded-full">✕</button>
                            </>
                        ) : <button onClick={cleanupCall} className="w-16 h-16 bg-red-600 rounded-full">✕</button>}
                    </div>
                </div>
            )}
        </>
    );
}