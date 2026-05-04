'use client';

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Went up exactly one folder

// Sub-components
import GlobalSearch from '../components/features/GlobalSearch';
import AdminPanel from '../components/features/AdminPanel';
import FileExplorer from '../components/features/FileExplorer';
import ChatInterface from '../components/features/ChatInterface';
import Sidebar from '../components/layout/Sidebar'; 

export default function DistributedFileHub() {
    // ==========================================
    // 1. GLOBAL APP & UI STATE
    // ==========================================
    const [user, setUser] = useState<any>(null); // Maps to 'user' in ChatInterface
    const [viewingSearch, setViewingSearch] = useState(false);
    const [viewingAdminPanel, setViewingAdminPanel] = useState(false);
    const [viewingComms, setViewingComms] = useState(false); // Maps to 'isVisible' in ChatInterface

    // File Explorer State
    const [files, setFiles] = useState<any[]>([]);
    const [currentFolder, setCurrentFolder] = useState<any>(null);
    const [isLockedForUser, setIsLockedForUser] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Global Search & Admin State
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
    const [adminUserList, setAdminUserList] = useState<any[]>([]);

    // ==========================================
    // 2. CHAT INTERFACE STATE (The 31 Props)
    // ==========================================
    const [activeChat, setActiveChat] = useState<any>(null);
    const [friends, setFriends] = useState<any[]>([]);
    const [friendRequests, setFriendRequests] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [unreadSenders, setUnreadSenders] = useState<string[]>([]);
    
    // Search & Chat Input State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatFile, setChatFile] = useState<File | null>(null);
    const [replyTo, setReplyTo] = useState<any>(null);
    
    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);

    // Refs
    const chatFileInputRef = useRef<HTMLInputElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // ==========================================
    // 3. INITIALIZATION & AUTH
    // ==========================================
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                // In a real app, you would load friends and requests here
            }
        };
        fetchUser();
    }, []);

    // ==========================================
    // 4. CHAT FUNCTIONS (Passed as Props)
    // ==========================================
    const showAlert = (title: string, message: string) => {
        alert(`${title}\n${message}`); // Replace with a custom toast if you have one
    };

    const handleSearchUsers = async () => {
        if (!searchQuery.trim()) return;
        const { data, error } = await supabase
            .from('users') // Adjust table name if different
            .select('id, username')
            .ilike('username', `%${searchQuery}%`)
            .limit(10);
        
        if (data) setSearchResults(data);
        if (error) console.error("Search Error:", error);
    };

    const sendFriendRequest = async (targetId: string) => {
        if (!user) return;
        await supabase.from('friend_requests').insert([{ sender_id: user.id, receiver_id: targetId, status: 'pending' }]);
        showAlert("Request Sent", "Your connection request has been sent.");
    };

    const handleRequestAction = async (requestId: string, action: 'accept' | 'decline') => {
        const status = action === 'accept' ? 'accepted' : 'declined';
        await supabase.from('friend_requests').update({ status }).eq('id', requestId);
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
    };

    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewMessage(e.target.value);
        // Add typing indicator broadcast logic here if needed
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!newMessage.trim() && !chatFile) || !user || !activeChat) return;

        let fileUrl = null;
        let finalFileName = null;

        if (chatFile) {
            finalFileName = chatFile.name;
            const fileExt = chatFile.name.split('.').pop();
            const storageName = `${Math.random()}.${fileExt}`;
            const { data } = await supabase.storage.from('user-files').upload(`chat/${storageName}`, chatFile);
            if (data) {
                const { data: urlData } = supabase.storage.from('user-files').getPublicUrl(`chat/${storageName}`);
                fileUrl = urlData.publicUrl;
            }
        }

        const msgPayload = {
            sender_id: user.id,
            receiver_id: activeChat.friend_id,
            content: newMessage,
            file_url: fileUrl, // Adjust these column names based on your DB schema
            file_name: finalFileName,
            file_path: fileUrl, 
            reply_to_id: replyTo ? replyTo.id : null,
            is_read: false
        };

        const { error } = await supabase.from('messages').insert([msgPayload]);
        if (!error) {
            setNewMessage('');
            setChatFile(null);
            setReplyTo(null);
        } else {
            console.error("Failed to send:", error);
        }
    };

    // Voice Note Logic
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            showAlert("Microphone Error", "Could not access the microphone.");
        }
    };

    const stopRecordingAndSend = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([audioBlob], `Voice Note - ${new Date().getTime()}.webm`, { type: 'audio/webm' });
                setChatFile(file);
                setIsRecording(false);
                // Immediately send after setting the file
                setTimeout(() => handleSendMessage(), 100); 
            };
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            audioChunksRef.current = [];
        }
    };

    // ==========================================
    // 5. FILE EXPLORER & SEARCH LOGIC
    // ==========================================
    const performGlobalSearch = async () => {
        // Implement your global file search logic here
    };

    const handleUpload = async (event: any) => {
        // Implement your file explorer upload logic here
    };

    const handleDownload = async (filePath: string, fileName: string) => {
        // Shared download logic for chat and file explorer
        if (!filePath) return;
        window.open(filePath, '_blank');
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    // ==========================================
    // 6. MAIN RENDER
    // ==========================================
    return (
        <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
            
            {/* Sidebar */}
            <Sidebar 
                setViewingSearch={setViewingSearch}
                setViewingAdminPanel={setViewingAdminPanel}
                setViewingComms={setViewingComms}
                // Add any other props your sidebar needs
            />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 h-full relative">
                <div className="p-0 md:p-4 lg:p-6 flex-1 overflow-y-auto relative h-full w-full">
                    
                    {viewingSearch && (
                        <GlobalSearch 
                            globalSearchQuery={globalSearchQuery} 
                            performGlobalSearch={performGlobalSearch} 
                            globalSearchResults={globalSearchResults} 
                            formatBytes={formatBytes} 
                            handleDownload={handleDownload} 
                        />
                    )}
                    
                    {viewingAdminPanel && (
                        <AdminPanel adminUserList={adminUserList} />
                    )}
                    
                    {!viewingSearch && !viewingAdminPanel && !viewingComms && (
                        <FileExplorer 
                            isLockedForUser={isLockedForUser} 
                            currentFolder={currentFolder} 
                            fileInputRef={fileInputRef} 
                            files={files} 
                            setFiles={setFiles} 
                            handleUpload={handleUpload} 
                            uploading={uploading} 
                        />
                    )}

                    {/* 
                        CHAT INTERFACE INTEGRATION
                        All 31 Props successfully passed down to fix TypeScript errors 
                    */}
                    <div className={`absolute inset-0 md:inset-4 lg:inset-6 z-50 ${viewingComms ? 'block' : 'hidden'}`}>
                        <ChatInterface 
                            isVisible={viewingComms}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            handleSearchUsers={handleSearchUsers}
                            searchResults={searchResults}
                            sendFriendRequest={sendFriendRequest}
                            friendRequests={friendRequests}
                            handleRequestAction={handleRequestAction}
                            friends={friends}
                            activeChat={activeChat}
                            setActiveChat={setActiveChat}
                            unreadSenders={unreadSenders}
                            messages={messages}
                            setMessages={setMessages}
                            user={user}
                            handleDownload={handleDownload}
                            isTyping={isTyping}
                            newMessage={newMessage}
                            handleTyping={handleTyping}
                            chatFile={chatFile}
                            setChatFile={setChatFile}
                            chatFileInputRef={chatFileInputRef}
                            handleSendMessage={handleSendMessage}
                            isRecording={isRecording}
                            startRecording={startRecording}
                            stopRecordingAndSend={stopRecordingAndSend}
                            cancelRecording={cancelRecording}
                            chatScrollRef={chatScrollRef}
                            replyTo={replyTo}
                            setReplyTo={setReplyTo}
                            showAlert={showAlert}
                        />
                    </div>

                </div>
            </main>
        </div>
    );
}