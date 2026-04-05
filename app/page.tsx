'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Import our new cleanly separated components
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
  // CORE STATE
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 
  const [profileName, setProfileName] = useState('User');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // FILE/FOLDER STATE
  const [filesList, setFilesList] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({}); 
  const [newFolderName, setNewFolderName] = useState('');
  const [folderIsPublic, setFolderIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);

  // FOLDER RENAMING STATE
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // NAVIGATION & UI STATE
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [adminUserList, setAdminUserList] = useState<any[]>([]);
  const [viewingAdminPanel, setViewingAdminPanel] = useState(false);
  const [viewingComms, setViewingComms] = useState(false);
  const [viewingSearch, setViewingSearch] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // GLOBAL SEARCH STATE
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);

  // COMMS / SOCIAL STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  
  // CHAT MESSAGES & NOTIFICATIONS STATE
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [unreadSenders, setUnreadSenders] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // VOICE RECORDING STATE
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modal, setModal] = useState<{
    show: boolean, title: string, message: string, onConfirm?: (val: string) => void, onRetry?: () => void, isPrompt?: boolean
  }>({ show: false, title: '', message: '', isPrompt: false });

  // 1. SESSION INITIALIZATION
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser);
      if (event === 'PASSWORD_RECOVERY') handleChangePassword();
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. DATA SYNCHRONIZATION
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

  // REALTIME SUPABASE LISTENER
  useEffect(() => {
    if (!user) return;
    const dbChannel = supabase
      .channel('realtime:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        if (activeChat && ((msg.sender_id === user.id && msg.receiver_id === activeChat.friend_id) || (msg.sender_id === activeChat.friend_id && msg.receiver_id === user.id))) {
          setMessages((prev) => [...prev, msg]);
        }
        if (msg.receiver_id === user.id) {
            if (activeChat?.friend_id === msg.sender_id && viewingComms) markMessagesAsRead(msg.sender_id);
            else checkUnreadMessages();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(dbChannel); };
  }, [user, activeChat, viewingComms]);

  // Typing Indicator Listener
  useEffect(() => {
    if (!user || !activeChat) return;
    const roomName = `chat-${[user.id, activeChat.friend_id].sort().join('-')}`;
    const typingChannel = supabase.channel(roomName)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.sender_id === activeChat.friend_id) {
            setIsTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(typingChannel); };
  }, [user, activeChat]);

  // 3. UI HELPERS
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

  // 4. DATA FETCHING
  const fetchProfile = async (currentUser: any) => {
    const { data, error } = await supabase.from('profiles').select('username, is_admin').eq('id', currentUser.id).single();
    if (error) console.error("Profile Fetch Error:", error.message);
    const isMasterEmail = currentUser?.email === 'ammargamal44s@gmail.com';
    setIsAdmin(!!(data?.is_admin || isMasterEmail));
    setProfileName(data?.username || currentUser.email.split('@')[0]);
  };
  const fetchAdminStats = async () => {
    const { data } = await supabase.from('admin_user_stats').select('*');
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

  // 5. SOCIAL / COMMS LOGIC
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
    if (error) { if (error.code === '23505') showAlert('Notice', 'Connection request already exists with this node.'); else showAlert('Error', error.message); } 
    else { showAlert('Success', 'Connection request transmitted.'); setSearchResults([]); setSearchQuery(''); fetchSocialData(); }
  };
  const handleRequestAction = async (id: string, action: 'accept' | 'decline') => {
    if (action === 'accept') await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    else await supabase.from('friendships').delete().eq('id', id);
    fetchSocialData();
  };
  const checkUnreadMessages = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('is_read', false);
    if (!error && data) setUnreadSenders(Array.from(new Set(data.map(m => m.sender_id))));
  };
  const markMessagesAsRead = async (friendId: string) => {
    if (!user) return;
    await supabase.from('messages').update({ is_read: true }).eq('receiver_id', user.id).eq('sender_id', friendId).eq('is_read', false);
    checkUnreadMessages();
  };
  const fetchMessages = async () => {
    if (!user || !activeChat) return;
    const { data, error } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.friend_id}),and(sender_id.eq.${activeChat.friend_id},receiver_id.eq.${user.id})`).order('created_at', { ascending: true });
    if (!error) setMessages(data || []);
  };
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (user && activeChat) supabase.channel(`chat-${[user.id, activeChat.friend_id].sort().join('-')}`).send({ type: 'broadcast', event: 'typing', payload: { sender_id: user.id } });
  };

  // AUDIO RECORDING LOGIC
  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
          mediaRecorder.onstop = async () => {
              if (audioChunksRef.current.length === 0) return;
              const audioFile = new File([new Blob(audioChunksRef.current, { type: 'audio/webm' })], `Voice Note.webm`, { type: 'audio/webm' });
              const filePath = `chat-audio-${Date.now()}-${Math.random().toString(36).substring(2,9)}.webm`;
              const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, audioFile);
              if (!uploadError && user && activeChat) {
                  await supabase.from('messages').insert([{ sender_id: user.id, receiver_id: activeChat.friend_id, content: '', file_path: filePath, file_name: 'Voice Note.webm', is_read: false }]);
              }
              stream.getTracks().forEach(track => track.stop()); 
          };
          mediaRecorder.start();
          setIsRecording(true);
      } catch (err) { showAlert("Microphone Error", "Could not access microphone."); }
  };
  const stopRecordingAndSend = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };
  const cancelRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = () => { mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop()); };
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !chatFile) || !user || !activeChat) return;
    let filePath = null; let fileName = null;
    if (chatFile) {
      fileName = chatFile.name;
      filePath = `chat-${Date.now()}-${Math.random().toString(36).substring(2,9)}.${fileName.split('.').pop()}`;
      const { error } = await supabase.storage.from('user-files').upload(filePath, chatFile);
      if (error) return showAlert("Upload Error", error.message);
    }
    const { error } = await supabase.from('messages').insert([{ sender_id: user.id, receiver_id: activeChat.friend_id, content: newMessage.trim(), file_path: filePath, file_name: fileName, is_read: false }]);
    if (error) showAlert("Send Error", error.message);
    else { setNewMessage(''); setChatFile(null); if (chatFileInputRef.current) chatFileInputRef.current.value = ""; }
  };

  // 6. CORE ACTIONS
  const handleAuth = async () => {
    if (isSignUp) {
      if (!username) return showAlert("Notice", "Please enter a Username.");
      const { data: isAvailable } = await supabase.rpc('check_username_available', { requested_username: username });
      if (isAvailable === false) return showAlert("Notice", "That username is already taken.");
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { custom_username: username } } });
      if (error) return showAlert("Error", error.message);
      showAlert("Success", "Verification email sent!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return showAlert("Error", error.message);
    }
  };
  const handleForgotPassword = async () => {
    if (!email) return showAlert("Notice", "Please enter your email address first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) showAlert("Error", error.message); else showAlert("Success", "Recovery link sent!");
  };
  const handleChangePassword = () => {
    showPrompt("Security Update", "New password (min 6 chars):", async (val) => {
        if(!val) return;
        const { error } = await supabase.auth.updateUser({ password: val });
        if (error) showAlert("Error", error.message, () => handleChangePassword()); else showAlert("Success", "Credentials updated.");
    });
  };
  const handleLogout = async () => { await supabase.auth.signOut(); localStorage.clear(); window.location.reload(); };

  const createFolder = async () => {
    if (!newFolderName || !user) return;
    const { error } = await supabase.from('folders').insert([{ name: newFolderName, user_id: user.id, is_public: folderIsPublic, owner_username: profileName }]);
    if (error) showAlert("Database Error", error.message); else { setNewFolderName(''); fetchFolders(); }
  };
  const handleRenameFolder = async (folderId: string, newName: string) => {
      if (!newName.trim()) return setEditingFolderId(null);
      const { error } = await supabase.from('folders').update({ name: newName.trim() }).eq('id', folderId);
      if (error) showAlert("Database Error", error.message); else { setEditingFolderId(null); fetchFolders(); }
  };
  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(fileName, file);
      const { error } = await supabase.from('files').insert([{ file_name: file.name, file_size: file.size, storage_path: fileName, is_public: isPublic, owner_username: profileName || user.email.split('@')[0], user_id: user.id, folder_id: selectedFolder }]);
      if (error) showAlert("Database Error", error.message);
      setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; fetchFiles();
    } finally { setUploading(false); }
  };
  const handleDownload = async (path: string, name: string) => {
    const { data } = await supabase.storage.from('user-files').download(path);
    if (data) { const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
  };
  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    showPrompt("Delete Folder", "Type 'DELETE' to confirm.", async (val) => {
        if(val.trim().toUpperCase() !== 'DELETE') return showAlert("Error", "Validation failed.");
        const { error } = await supabase.from('folders').delete().eq('id', folderId);
        if (error) showAlert("Database Error", error.message); else { if (selectedFolder === folderId) setSelectedFolder(null); fetchFolders(); }
    });
  };
  const handleDeleteFile = async (id: string, path: string) => {
    showPrompt("Delete File", "Type 'CONFIRM' to wipe.", async (val) => {
        if (val.trim().toUpperCase() !== 'CONFIRM') return showAlert("Error", "Validation failed.");
        await supabase.storage.from('user-files').remove([path]);
        const { error } = await supabase.from('files').delete().eq('id', id);
        if (error) showAlert("Database Error", error.message); else fetchFiles();
    });
  };
  const toggleFolderStatus = async (folderId: string, column: string, currentStatus: boolean) => {
    const { error } = await supabase.from('folders').update({ [column]: !currentStatus }).eq('id', folderId);
    if (error) showAlert("Database Error", error.message); else fetchFolders();
  };
  const toggleFilePrivacy = async (fileId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('files').update({ is_public: !currentStatus }).eq('id', fileId);
    if (error) showAlert("Database Error", error.message); else fetchFiles();
  };

  // 7. RENDER LOGIC
  const currentFolder = folders.find(f => f.id === selectedFolder);
  const canManageFolder = currentFolder?.user_id === user?.id || isAdmin;
  const isLockedForUser = selectedFolder && currentFolder?.is_locked && !canManageFolder;

  if (!user) return <AuthScreen {...{modal, setModal, isSignUp, setIsSignUp, email, setEmail, password, setPassword, username, setUsername, showPassword, setShowPassword, handleAuth, handleForgotPassword}} />;

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-white selection:text-black relative overflow-hidden">
      
      <Modal modal={modal} setModal={setModal} showPassword={showPassword} setShowPassword={setShowPassword} />
      
      <Sidebar {...{isSidebarOpen, setIsSidebarOpen, setSelectedFolder, setViewingAdminPanel, setViewingComms, setViewingSearch, selectedFolder, viewingAdminPanel, viewingComms, viewingSearch, unreadSenders, friendRequests, isAdmin, folders, user, handleFolderDelete, editingFolderId, setEditingFolderId, editingFolderName, setEditingFolderName, handleRenameFolder, newFolderName, setNewFolderName, folderIsPublic, setFolderIsPublic, createFolder}} />

      <main className="flex-1 overflow-y-auto relative flex flex-col h-full w-full">
        
        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden absolute top-4 left-4 z-30 w-10 h-10 bg-[#111] border border-[#333] rounded-lg flex items-center justify-center text-white hover:border-white transition-colors">
            <span className="text-xl leading-none -mt-1">≡</span>
        </button>

        <AccountMenu {...{showAccountMenu, setShowAccountMenu, profileName, userEmail: user.email, handleChangePassword, handleLogout}} />

        {/* HEADER SECTION */}
        <div className="relative pt-20 md:pt-16 px-6 md:px-12 pb-8 border-b border-[#222]/50 bg-gradient-to-b from-[#0a0a0a] to-black shrink-0">
            <NetworkBackground />
            <div className="relative z-10 pl-2 md:pl-0">
                {viewingSearch ? <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">Global Search</h2> 
                : viewingComms ? <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">Connections Log</h2> 
                : viewingAdminPanel ? <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">Network Registry</h2> 
                : (
                    <>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2 truncate max-w-[80%] md:max-w-full">{currentFolder ? currentFolder.name : 'Root Explorer'}</h2>
                        {currentFolder && (
                            <div className="mt-4 flex flex-wrap items-center gap-3 md:gap-4">
                                <p className="text-[#888] text-xs md:text-sm italic">Owner: <span className="text-white font-bold">{currentFolder.owner_username}</span></p>
                                {canManageFolder && (
                                    <div className="flex gap-2 md:gap-4 md:border-l border-[#333] md:pl-4">
                                        <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_public', currentFolder.is_public)} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 md:px-3 rounded border transition hover:opacity-80 ${currentFolder.is_public ? 'border-green-900 bg-green-500/10 text-green-500' : 'border-red-900 bg-red-500/10 text-red-500'}`}>{currentFolder.is_public ? '🌐 Public' : '🔒 Private'}</button>
                                        <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_locked', currentFolder.is_locked)} className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 md:px-3 rounded border transition hover:opacity-80 ${currentFolder.is_locked ? 'border-amber-900 bg-amber-500/10 text-amber-500' : 'border-[#333] bg-[#111] text-[#888]'}`}>{currentFolder.is_locked ? '🚫 Locked' : '🔓 Unlocked'}</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>

        {/* MAIN CONTENT ROUTING */}
        <div className="p-4 md:p-12 flex-1 overflow-y-auto">
            {viewingSearch ? <GlobalSearch {...{globalSearchQuery, performGlobalSearch, globalSearchResults, formatBytes, handleDownload}} />
            : viewingComms ? <ChatInterface {...{searchQuery, setSearchQuery, handleSearchUsers, searchResults, sendFriendRequest, friendRequests, handleRequestAction, friends, activeChat, setActiveChat, unreadSenders, messages, user, handleDownload, isTyping, newMessage, handleTyping, chatFile, setChatFile, chatFileInputRef, handleSendMessage, isRecording, startRecording, stopRecordingAndSend, cancelRecording, chatScrollRef}} />
            : viewingAdminPanel ? <AdminPanel adminUserList={adminUserList} />
            : <FileExplorer {...{isLockedForUser, currentFolder, fileInputRef, file, setFile, handleUpload, uploading, isPublic, setIsPublic, filesList, formatBytes, handleDownload, user, canManageFolder, toggleFilePrivacy, handleDeleteFile}} />}
        </div>
      </main>
    </div>
  );
}