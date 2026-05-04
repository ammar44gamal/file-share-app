'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Adjust path if your Supabase client is elsewhere
import { Phone, Video, Mic, MicOff, VideoOff, PhoneOff, Paperclip, Send, X, File as FileIcon } from 'lucide-react';

export default function ChatInterface({ currentUser, activeChat }: { currentUser: any, activeChat: any }) {
    // --- STATE ---
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [chatFile, setChatFile] = useState<File | null>(null);
    
    // WebRTC State
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [incomingCallData, setIncomingCallData] = useState<any>(null);

    // --- REFS ---
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const chatFileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- EFFECT: Load Messages & Setup Signaling ---
    useEffect(() => {
        if (!activeChat) return;

        // Load history
        const fetchMessages = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                .order('created_at', { ascending: true });
            if (data) setMessages(data);
        };
        fetchMessages();

        // Subscribe to real-time chat messages
        const messageChannel = supabase.channel('chat_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
                setMessages(prev => [...prev, payload.new]);
            }).subscribe();

        // Subscribe to WebRTC Signaling Channel
        const webrtcChannel = supabase.channel('webrtc-global')
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.targetId !== currentUser.id) return; // Not for us

                if (payload.type === 'offer') {
                    setIncomingCallData(payload);
                    setCallStatus('ringing');
                } 
                else if (payload.type === 'answer') {
                    if (peerConnectionRef.current) {
                        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
                        setCallStatus('connected');
                    }
                } 
                else if (payload.type === 'candidate') {
                    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                        try {
                            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
                        } catch (e) { console.error("Error adding candidate:", e); }
                    } else {
                        // The "Trickle ICE" Race Condition Fix
                        pendingCandidates.current.push(payload.candidate);
                    }
                }
                else if (payload.type === 'end-call') {
                    endCall();
                }
            }).subscribe();

        return () => {
            messageChannel.unsubscribe();
            webrtcChannel.unsubscribe();
        };
    }, [activeChat, currentUser.id]);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // --- WEBRTC CORE LOGIC ---
    const sendSignal = async (type: string, targetId: string, payload: any) => {
        await supabase.channel('webrtc-global').send({
            type: 'broadcast',
            event: 'signal',
            payload: { type, targetId, callerId: currentUser.id, ...payload }
        });
    };

    const createPeerConnection = (targetId: string) => {
        const pc = new RTCPeerConnection({ 
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }, // Plan A: Direct Connection
                {
                    // Plan B: Bulletproof Metered.ca TURN Relay for Strict 4G/5G Networks
                    urls: [
                        'turn:filehub-webrtc.metered.live:80',
                        'turn:filehub-webrtc.metered.live:443',
                        'turns:filehub-webrtc.metered.live:443'
                    ],
                    username: 'd3e3032b901becb839b91bab',             
                    credential: 'e+/TAdE3L+M0zJsN'          
                }
            ] 
        });
        
        // Debugger to confirm TURN server bypasses 4G firewalls
        pc.oniceconnectionstatechange = () => {
            console.log("ICE Connection State:", pc.iceConnectionState);
        };
        
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal('candidate', targetId, { candidate: event.candidate });
            }
        };
        
        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }
        
        peerConnectionRef.current = pc;
        return pc;
    };

    const startCall = async (isVideo: boolean) => {
        try {
            setCallStatus('calling');
            const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            localStreamRef.current = stream;
            
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const pc = createPeerConnection(activeChat.id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            sendSignal('offer', activeChat.id, { offer });
        } catch (error) {
            console.error("Error accessing media devices.", error);
            setCallStatus('idle');
        }
    };

    const acceptCall = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const pc = createPeerConnection(incomingCallData.callerId);
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            sendSignal('answer', incomingCallData.callerId, { answer });
            setCallStatus('connected');

            // Process queued candidates
            pendingCandidates.current.forEach(async (candidate) => {
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } 
                catch (e) { console.error(e); }
            });
            pendingCandidates.current = []; // Clear queue

        } catch (error) {
            console.error("Error accepting call", error);
        }
    };

    const endCall = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        if (callStatus !== 'idle') {
            sendSignal('end-call', activeChat ? activeChat.id : incomingCallData?.callerId, {});
        }
        setCallStatus('idle');
        setIncomingCallData(null);
    };

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoMuted(!videoTrack.enabled);
            }
        }
    };

    // --- CHAT MESSAGING LOGIC ---
    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() && !chatFile) return;

        let fileUrl = null;
        if (chatFile) {
            const fileExt = chatFile.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const { data, error } = await supabase.storage.from('user-files').upload(`chat/${fileName}`, chatFile);
            if (data) {
                const { data: publicUrlData } = supabase.storage.from('user-files').getPublicUrl(`chat/${fileName}`);
                fileUrl = publicUrlData.publicUrl;
            }
            setChatFile(null);
        }

        await supabase.from('messages').insert([{
            sender_id: currentUser.id,
            receiver_id: activeChat.id,
            content: inputText,
            file_url: fileUrl
        }]);

        setInputText('');
    };

    // --- UI RENDER ---
    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0a] text-white relative">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#111] bg-opacity-70 backdrop-blur-xl">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold">
                        {activeChat?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <h2 className="text-xl font-semibold">{activeChat?.username || 'Select a Chat'}</h2>
                </div>
                
                {activeChat && callStatus === 'idle' && (
                    <div className="flex space-x-4">
                        <button onClick={() => startCall(false)} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition">
                            <Phone size={20} />
                        </button>
                        <button onClick={() => startCall(true)} className="p-2 bg-blue-600 rounded-full hover:bg-blue-500 transition">
                            <Video size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Chat Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => {
                    const isMe = msg.sender_id === currentUser.id;
                    return (
                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${isMe ? 'bg-blue-600 rounded-br-none' : 'bg-gray-800 rounded-bl-none'}`}>
                                {msg.file_url && (
                                    <img src={msg.file_url} alt="attachment" className="mb-2 rounded-lg max-h-48 object-cover" />
                                )}
                                <p className="text-sm">{msg.content}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[#111] border-t border-gray-800">
                {chatFile && (
                    <div className="flex items-center mb-2 text-sm text-gray-400">
                        <FileIcon size={16} className="mr-2" /> {chatFile.name}
                        <button onClick={() => setChatFile(null)} className="ml-2 text-red-400 hover:text-red-300"><X size={16}/></button>
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                    <button type="button" onClick={() => chatFileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white transition rounded-full hover:bg-gray-800">
                        <Paperclip size={20} />
                    </button>
                    {/* Security Tip implemented: Restricting risky files */}
                    <input 
                        type="file" 
                        accept="image/*, audio/*, video/*, .pdf, .doc, .docx, .zip" 
                        ref={chatFileInputRef} 
                        onChange={e => setChatFile(e.target.files?.[0] || null)} 
                        className="hidden" 
                    />
                    <input 
                        type="text" 
                        value={inputText} 
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..." 
                        className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-full px-5 py-3 outline-none focus:border-blue-500 transition"
                    />
                    <button type="submit" className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition">
                        <Send size={20} />
                    </button>
                </form>
            </div>

            {/* WebRTC Call Overlay / PiP */}
            {callStatus !== 'idle' && (
                <div className={`absolute z-50 ${callStatus === 'connected' ? 'top-4 right-4 w-72 h-96 rounded-2xl overflow-hidden shadow-2xl border border-gray-700 cursor-move' : 'inset-0 bg-black/90 flex flex-col items-center justify-center backdrop-blur-md'}`}>
                    
                    {/* Ringing/Calling Screen */}
                    {(callStatus === 'ringing' || callStatus === 'calling') && (
                        <div className="flex flex-col items-center space-y-6">
                            <div className="w-24 h-24 bg-blue-600 rounded-full animate-pulse flex items-center justify-center text-4xl">
                                {callStatus === 'ringing' ? incomingCallData?.callerId?.charAt(0) : activeChat?.username?.charAt(0)}
                            </div>
                            <h3 className="text-2xl font-bold">{callStatus === 'ringing' ? 'Incoming Call...' : 'Calling...'}</h3>
                            
                            {callStatus === 'ringing' ? (
                                <div className="flex space-x-6 mt-8">
                                    <button onClick={acceptCall} className="p-4 bg-green-500 rounded-full hover:bg-green-400"><Phone size={28}/></button>
                                    <button onClick={endCall} className="p-4 bg-red-600 rounded-full hover:bg-red-500"><PhoneOff size={28}/></button>
                                </div>
                            ) : (
                                <button onClick={endCall} className="p-4 bg-red-600 rounded-full hover:bg-red-500 mt-8"><PhoneOff size={28}/></button>
                            )}
                        </div>
                    )}

                    {/* Connected Video Screen */}
                    {callStatus === 'connected' && (
                        <div className="relative w-full h-full bg-black group">
                            {/* Remote Video - CRUCIAL FIX: playsInline added for mobile */}
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            
                            {/* Local Video PiP - CRUCIAL FIX: playsInline added for mobile */}
                            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-20 h-28 object-cover rounded-lg border border-gray-600 shadow-lg" />
                            
                            {/* Call Controls Overlay */}
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <button onClick={toggleAudio} className={`p-3 rounded-full ${isAudioMuted ? 'bg-red-500' : 'bg-gray-800/80 hover:bg-gray-700'}`}>
                                    {isAudioMuted ? <MicOff size={20}/> : <Mic size={20}/>}
                                </button>
                                <button onClick={toggleVideo} className={`p-3 rounded-full ${isVideoMuted ? 'bg-red-500' : 'bg-gray-800/80 hover:bg-gray-700'}`}>
                                    {isVideoMuted ? <VideoOff size={20}/> : <Video size={20}/>}
                                </button>
                                <button onClick={endCall} className="p-3 bg-red-600 hover:bg-red-500 rounded-full">
                                    <PhoneOff size={20}/>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}