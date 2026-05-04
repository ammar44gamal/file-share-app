'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

import NetworkBackground from '../components/ui/NetworkBackground';
import Modal from '../components/ui/Modal';
import AccountMenu from '../components/layout/AccountMenu';
import Sidebar from '../components/layout/Sidebar';
import AuthScreen from '../components/features/AuthScreen';
import AdminPanel from '../components/features/AdminPanel';
import GlobalSearch from '../components/features/GlobalSearch';
import FileExplorer from '../components/features/FileExplorer';
import ChatInterface from '../components/features/ChatInterface';

export default function DistributedFileHub() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 
  const [profileName, setProfileName] = useState('User');
  const [isAdmin, setIsAdmin] = useState(false);
  const [awaitingOTP, setAwaitingOTP] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Explorer State
  const [filesList, setFilesList] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderIsPublic, setFolderIsPublic] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // UI State
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [adminUserList, setAdminUserList] = useState<any[]>([]);
  const [viewingAdminPanel, setViewingAdminPanel] = useState(false);
  const [viewingComms, setViewingComms] = useState(false);
  const [viewingSearch, setViewingSearch] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Social/Chat State
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [unreadSenders, setUnreadSenders] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Refs
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modal, setModal] = useState<{
    show: boolean, title: string, message: string, onConfirm?: (val: string) => void, onRetry?: () => void, isPrompt?: boolean
  }>({ show: false, title: '', message: '', isPrompt: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser);
      if (event === 'PASSWORD_RECOVERY') handleChangePassword();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchFiles();
      fetchSocialData();
      checkUnreadMessages();
      if (isAdmin && viewingAdminPanel) fetchAdminStats();
    }
  }, [user, selectedFolder, viewingAdminPanel, viewingComms, viewingSearch, isAdmin]);

  useEffect(() => {
    if (activeChat) {
        fetchMessages();
        markMessagesAsRead(activeChat.friend_id);
    }
  }, [activeChat]);

  useEffect(() => {
    if (!user) return;
    const dbChannel = supabase
      .channel('realtime:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const msg = payload.new;
        if (activeChat && ((msg.sender_id === user.id && msg.receiver_id === activeChat.friend_id) || (msg.sender_id === activeChat.friend_id && msg.receiver_id === user.id))) {
          setMessages((prev) => [...prev, msg]);
        }
        if (msg.receiver_id === user.id) {
            if (activeChat?.friend_id === msg.sender_id && viewingComms) markMessagesAsRead(msg.sender_id);
            else checkUnreadMessages();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload: any) => {
        setMessages((prev) => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(dbChannel); };
  }, [user, activeChat, viewingComms]);

  const showAlert = (title: string, message: string, retryAction?: () => void) => {
    setModal({ show: true, title, message, isPrompt: false, onRetry: retryAction });
  };
  const showPrompt = (title: string, message: string, onConfirm: (val: string) => void) => {
    setModal({ show: true, title, message, isPrompt: true, onConfirm: (val: string) => onConfirm(val) });
  };
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const fetchProfile = async (currentUser: any) => {
    const { data, error } = await supabase.from('profiles').select('username, is_admin').eq('id', currentUser.id).single();
    const isMasterEmail = currentUser?.email === 'ammargamal44s@gmail.com';
    setIsAdmin(!!(data?.is_admin || isMasterEmail));
    setProfileName(data?.username || currentUser.email.split('@')[0]);
  };

  const fetchAdminStats = async () => {
    const { data } = await supabase.from('admin_user_stats').select('*').order('last_login', { ascending: false });
    setAdminUserList(data || []);
  };

  const fetchFolders = async () => {
    let query = supabase.from('folders').select('*').order('name');
    if (!isAdmin) query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    const { data } = await query;
    setFolders(data || []);
  };

  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false });
    if (selectedFolder) query = query.eq('folder_id', selectedFolder);
    else query = query.is('folder_id', null);
    if (!isAdmin) query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    const { data } = await query;
    setFilesList(data || []);
  };

  const performGlobalSearch = async (q: string) => {
      setGlobalSearchQuery(q);
      if (!q.trim()) return setGlobalSearchResults([]);
      const { data, error } = await supabase.from('files').select('*').eq('is_public', true).ilike('file_name', `%${q}%`).order('created_at', { ascending: false }).limit(50);
      if (!error && data) setGlobalSearchResults(data);
  };

  const fetchSocialData = async () => {
    if (!user) return;
    const { data: fData, error } = await supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (error || !fData) return;
    const otherUserIds = fData.map(f => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    if (otherUserIds.length === 0) { setFriendRequests([]); setFriends([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', otherUserIds);
    const profileMap = (profiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.username }), {});
    setFriendRequests(fData.filter(f => f.status === 'pending' && f.receiver_id === user.id).map(f => ({ id: f.id, requester_id: f.requester_id, username: profileMap[f.requester_id] || 'Unknown Node' })));
    setFriends(fData.filter(f => f.status === 'accepted').map(f => {
        const friendId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
        return { friendship_id: f.id, friend_id: friendId, username: profileMap[friendId] || 'Unknown Node' };
    }));
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    const { data, error } = await supabase.from('profiles').select('id, username').ilike('username', `%${searchQuery}%`).neq('id', user.id).limit(10);
    if (error) showAlert('Error', error.message); else setSearchResults(data || []);
  };

  const sendFriendRequest = async (receiverId: string) => {
    const { error } = await supabase.from('friendships').insert([{ requester_id: user.id, receiver_id: receiverId, status: 'pending' }]);
    if (error) showAlert('Error', error.message); 
    else { showAlert('Success', 'Connection request transmitted.'); fetchSocialData(); }
  };

  const handleRequestAction = async (id: string, action: 'accept' | 'decline') => {
    if (action === 'accept') await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    else await supabase.from('friendships').delete().eq('id', id);
    fetchSocialData();
  };

  const checkUnreadMessages = async () => {
    if (!user) return;
    const { data } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('is_read', false);
    if (data) setUnreadSenders(Array.from(new Set(data.map(m => m.sender_id))));
  };

  const markMessagesAsRead = async (friendId: string) => {
    if (!user) return;
    await supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id).eq('sender_id', friendId).eq('is_read', false);
    checkUnreadMessages();
  };

  const fetchMessages = async () => {
    if (!user || !activeChat) return;
    const { data } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.friend_id}),and(sender_id.eq.${activeChat.friend_id},receiver_id.eq.${user.id})`).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (user && activeChat) {
        supabase.channel(`chat-${[user.id, activeChat.friend_id].sort().join('-')}`).send({ type: 'broadcast', event: 'typing', payload: { sender_id: user.id } });
    }
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          mediaRecorder.onstop = async () => {
              if (audioChunksRef.current.length === 0) return;
              const fileName = `Voice Note.webm`;
              const filePath = `chat-audio-${Date.now()}.${Math.random().toString(36).substring(7)}.webm`;
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const audioFile = new File([audioBlob], fileName, { type: 'audio/webm' });
              
              const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, audioFile);
              if (!uploadError && user && activeChat) {
                  await supabase.from('messages').insert([{ 
                      sender_id: user.id, receiver_id: activeChat.friend_id, content: '', 
                      file_path: filePath, file_name: fileName, is_read: false,
                      reply_to_id: replyTo ? replyTo.id : null 
                  }]);
                  setReplyTo(null);
              }
              stream.getTracks().forEach(track => track.stop()); 
          };
          mediaRecorder.start(); setIsRecording(true);
      } catch (err) { showAlert("Microphone Error", "Could not access microphone."); }
  };

  const stopRecordingAndSend = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const cancelRecording = () => { if (mediaRecorderRef.current && isRecording) { setIsRecording(false); mediaRecorderRef.current.stop(); } };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !chatFile) || !user || !activeChat) return;
    let filePath = null; let fileName = null;
    if (chatFile) {
      fileName = chatFile.name;
      filePath = `chat-${Date.now()}.${fileName.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(filePath, chatFile);
    }
    
    await supabase.from('messages').insert([{ 
        sender_id: user.id, receiver_id: activeChat.friend_id, 
        content: newMessage.trim(), file_path: filePath, file_name: fileName, 
        is_read: false, reply_to_id: replyTo ? replyTo.id : null 
    }]);

    setNewMessage(''); setChatFile(null); setReplyTo(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = "";
  };

  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); window.location.reload(); };
  const handleChangePassword = () => { /* reuse your modal logic */ };

  const handleDownload = async (path: string, name: string) => {
    const { data } = await supabase.storage.from('user-files').download(path);
    if (data) { const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
  };

  const handleAuth = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (isSignUp) {
          await supabase.auth.signUp({ email, password, options: { data: { custom_username: username } } });
          setAwaitingOTP(true);
      } else {
          await supabase.auth.signInWithPassword({ email, password });
      }
  };

  const handleVerifyOTP = async (e?: React.FormEvent) => {
      e?.preventDefault();
      await supabase.auth.verifyOtp({ email, token: otpCode, type: 'signup' });
      setAwaitingOTP(false);
  };

  if (!user) return (
      <>
          <Modal modal={modal} setModal={setModal} showPassword={showPassword} setShowPassword={setShowPassword} />
          <AuthScreen {...{modal, setModal, isSignUp, setIsSignUp, email, setEmail, password, setPassword, username, setUsername, showPassword, setShowPassword, handleAuth, handleForgotPassword: () => {}, awaitingOTP, setAwaitingOTP, otpCode, setOtpCode, handleVerifyOTP}} />
      </>
  );

  return (
    <div className="flex h-[100dvh] bg-black text-white font-sans selection:bg-white selection:text-black relative overflow-hidden">
      <Modal modal={modal} setModal={setModal} showPassword={showPassword} setShowPassword={setShowPassword} />
      <Sidebar {...{isSidebarOpen, setIsSidebarOpen, setSelectedFolder, setViewingAdminPanel, setViewingComms, setViewingSearch, selectedFolder, viewingAdminPanel, viewingComms, viewingSearch, unreadSenders, friendRequests, isAdmin, folders, user, handleFolderDelete: () => {}, editingFolderId, setEditingFolderId, editingFolderName, setEditingFolderName, handleRenameFolder: () => {}, newFolderName, setNewFolderName, folderIsPublic, setFolderIsPublic, createFolder: () => {}}} />

      <main className="flex-1 overflow-y-auto relative flex flex-col h-full w-full">
        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden absolute top-4 left-4 z-30 w-10 h-10 bg-[#111] border border-[#333] rounded-lg flex items-center justify-center text-white">≡</button>
        <AccountMenu {...{showAccountMenu, setShowAccountMenu, profileName, userEmail: user.email, handleChangePassword, handleLogout}} />

        <div className="relative pt-16 md:pt-10 px-6 md:px-8 pb-5 md:pb-6 border-b border-[#222]/50 bg-gradient-to-b from-[#0a0a0a] to-black shrink-0">
            <NetworkBackground />
            <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1.5">
                    {viewingSearch ? 'Global Search' : viewingComms ? 'Connections Log' : viewingAdminPanel ? 'Network Registry' : (selectedFolder ? folders.find(f=>f.id===selectedFolder)?.name : 'Root Explorer')}
                </h2>
            </div>
        </div>

        <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-y-auto">
            {viewingSearch ? (
                <GlobalSearch {...{globalSearchQuery, performGlobalSearch, globalSearchResults, formatBytes, handleDownload}} />
            ) : viewingComms ? (
                <ChatInterface 
                    isVisible={true}
                    showAlert={showAlert}
                    {...{searchQuery, setSearchQuery, handleSearchUsers, searchResults, sendFriendRequest, friendRequests, handleRequestAction, friends, activeChat, setActiveChat, unreadSenders, messages, setMessages, user, handleDownload, isTyping, newMessage, handleTyping, chatFile, setChatFile, chatFileInputRef, handleSendMessage, isRecording, startRecording, stopRecordingAndSend, cancelRecording, chatScrollRef, replyTo, setReplyTo}} 
                />
            ) : viewingAdminPanel ? (
                <AdminPanel adminUserList={adminUserList} />
            ) : (
                <FileExplorer {...{isLockedForUser: false, currentFolder: folders.find(f=>f.id===selectedFolder), fileInputRef, files, setFiles, handleUpload: () => {}, uploading, isPublic, setIsPublic, filesList, formatBytes, handleDownload, user, canManageFolder: true, toggleFilePrivacy: () => {}, handleDeleteFile: () => {}}} />
            )}
        </div>
      </main>
    </div>
  );
}