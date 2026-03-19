'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// High-Tech "Node Network" Canvas Animation
const NetworkBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: { x: number, y: number, vx: number, vy: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const numParticles = Math.floor(canvas.width / 25);
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
        });
      }
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - dist / 100})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });
      animationFrameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full z-0 opacity-20 pointer-events-none fade-in duration-1000"
      style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)' }}
    />
  );
};

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

  // NAVIGATION & UI STATE
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [adminUserList, setAdminUserList] = useState<any[]>([]);
  const [viewingAdminPanel, setViewingAdminPanel] = useState(false);
  const [viewingComms, setViewingComms] = useState(false);

  // COMMS / SOCIAL STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);
  
  // NEW: CHAT MESSAGES STATE
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<{
    show: boolean, title: string, message: string, onConfirm?: (val: string) => void, onRetry?: () => void, isPrompt?: boolean
  }>({ show: false, title: '', message: '', isPrompt: false });
  const [modalInput, setModalInput] = useState('');

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
      if (isAdmin && viewingAdminPanel) fetchAdminStats();
    }
  }, [user, selectedFolder, viewingAdminPanel, viewingComms, isAdmin]);

  // NEW: FETCH MESSAGES WHEN CHAT OPENS
  useEffect(() => {
    if (activeChat) fetchMessages();
  }, [activeChat]);

  // NEW: REALTIME SUPABASE LISTENER
  useEffect(() => {
    if (!user || !activeChat) return;
    
    const channel = supabase
      .channel('realtime:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = payload.new;
        // Only append if it belongs to the current conversation
        if (
          (msg.sender_id === user.id && msg.receiver_id === activeChat.friend_id) ||
          (msg.sender_id === activeChat.friend_id && msg.receiver_id === user.id)
        ) {
          setMessages((prev) => [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, activeChat]);

  // NEW: AUTO-SCROLL TO BOTTOM OF CHAT
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 3. UI HELPERS
  const showAlert = (title: string, message: string, retryAction?: () => void) => {
    setModal({ show: true, title, message, isPrompt: false, onRetry: retryAction });
  };

  const showPrompt = (title: string, message: string, onConfirm: (val: string) => void) => {
    setModalInput('');
    setModal({ show: true, title, message, isPrompt: true, onConfirm: (val: string) => onConfirm(val) });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 4. DATA FETCHING
  const fetchProfile = async (currentUser: any) => {
    const { data, error } = await supabase.from('profiles').select('username, is_admin').eq('id', currentUser.id).single();
    if (error) console.error("Profile Fetch Error:", error.message);

    const isMasterEmail = currentUser?.email === 'ammargamal44s@gmail.com';
    const status = !!(data?.is_admin || isMasterEmail);
    setIsAdmin(status);
    if (data?.username) setProfileName(data.username); 
    else setProfileName(currentUser.email.split('@')[0]);
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

    let sizeQuery = supabase.from('files').select('folder_id, file_size');
    if (!isAdmin) sizeQuery = sizeQuery.or(`is_public.eq.true,user_id.eq.${user.id}`);
    const { data: sizeData } = await sizeQuery;
    
    if (sizeData) {
        const sizes: Record<string, number> = {};
        sizeData.forEach(f => {
            if (f.folder_id) sizes[f.folder_id] = (sizes[f.folder_id] || 0) + (f.file_size || 0);
        });
        setFolderSizes(sizes);
    }
  };

  // 5. SOCIAL / COMMS LOGIC
  const fetchSocialData = async () => {
    if (!user) return;
    
    const { data: fData, error } = await supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (error || !fData) return;

    const otherUserIds = fData.map(f => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    if (otherUserIds.length === 0) {
        setFriendRequests([]);
        setFriends([]);
        return;
    }

    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', otherUserIds);
    const profileMap = (profiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p.username }), {});

    const pending = fData.filter(f => f.status === 'pending' && f.receiver_id === user.id).map(f => ({
        id: f.id, requester_id: f.requester_id, username: profileMap[f.requester_id] || 'Unknown Node'
    }));

    const accepted = fData.filter(f => f.status === 'accepted').map(f => {
        const friendId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
        return { friendship_id: f.id, friend_id: friendId, username: profileMap[friendId] || 'Unknown Node' };
    });

    setFriendRequests(pending);
    setFriends(accepted);
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    const { data, error } = await supabase.from('profiles')
        .select('id, username')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);
    if (error) showAlert('Error', error.message);
    else setSearchResults(data || []);
  };

  const sendFriendRequest = async (receiverId: string) => {
    const { error } = await supabase.from('friendships').insert([{ requester_id: user.id, receiver_id: receiverId, status: 'pending' }]);
    if (error) {
        if (error.code === '23505') showAlert('Notice', 'Connection request already exists with this node.');
        else showAlert('Error', error.message);
    } else {
        showAlert('Success', 'Connection request transmitted.');
        setSearchResults([]);
        setSearchQuery('');
        fetchSocialData();
    }
  };

  const handleRequestAction = async (id: string, action: 'accept' | 'decline') => {
    if (action === 'accept') await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    else await supabase.from('friendships').delete().eq('id', id);
    fetchSocialData();
  };

  // NEW: FETCH CHAT MESSAGES
  const fetchMessages = async () => {
    if (!user || !activeChat) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${activeChat.friend_id}),and(sender_id.eq.${activeChat.friend_id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) console.error("Messages Fetch Error:", error.message);
    else setMessages(data || []);
  };

  // NEW: SEND CHAT MESSAGE (Text and/or File)
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !chatFile) || !user || !activeChat) return;

    let filePath = null;
    let fileName = null;

    if (chatFile) {
      const ext = chatFile.name.split('.').pop();
      filePath = `chat-${Date.now()}-${Math.random().toString(36).substring(2,9)}.${ext}`;
      fileName = chatFile.name;
      const { error: uploadError } = await supabase.storage.from('user-files').upload(filePath, chatFile);
      if (uploadError) return showAlert("Upload Error", uploadError.message);
    }

    const { error } = await supabase.from('messages').insert([{
      sender_id: user.id,
      receiver_id: activeChat.friend_id,
      content: newMessage.trim(),
      file_path: filePath,
      file_name: fileName
    }]);

    if (error) showAlert("Send Error", error.message);
    else {
      setNewMessage('');
      setChatFile(null);
      if (chatFileInputRef.current) chatFileInputRef.current.value = "";
    }
  };

  // 6. CORE ACTIONS
  const handleAuth = async () => {
    if (isSignUp) {
      if (!username) return showAlert("Notice", "Please enter a Username.");
      const { data: isAvailable } = await supabase.rpc('check_username_available', { requested_username: username });
      if (isAvailable === false) return showAlert("Notice", "That username is already taken. Please try another one.");
      
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { custom_username: username } } });
      if (error) return showAlert("Error", error.message);
      showAlert("Success", "Verification email sent! Check your inbox.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return showAlert("Error", error.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return showAlert("Notice", "Please enter your email address first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) showAlert("Error", error.message);
    else showAlert("Success", "Recovery link sent to your email!");
  };

  const handleChangePassword = () => {
    showPrompt("Security Update", "New password (min 6 chars):", async (val) => {
        if(!val) return;
        const { error } = await supabase.auth.updateUser({ password: val });
        if (error) showAlert("Error", error.message, () => handleChangePassword());
        else showAlert("Success", "Credentials updated.");
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload(); 
  };

  const createFolder = async () => {
    if (!newFolderName || !user) return;
    const { error } = await supabase.from('folders').insert([{ 
        name: newFolderName, user_id: user.id, is_public: folderIsPublic, owner_username: profileName
    }]);
    if (error) showAlert("Database Error", error.message);
    else { setNewFolderName(''); fetchFolders(); }
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(fileName, file);
      const displayName = profileName || user.email.split('@')[0];
      
      const { error } = await supabase.from('files').insert([{ 
        file_name: file.name, file_size: file.size, storage_path: fileName,
        is_public: isPublic, owner_username: displayName, user_id: user.id, folder_id: selectedFolder
      }]);

      if (error) showAlert("Database Error", error.message);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = ""; 
      fetchFiles();
    } finally { setUploading(false); }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data } = await supabase.storage.from('user-files').download(path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
    }
  };

  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    showPrompt("Delete Folder", "Type 'DELETE' to confirm.", async (val) => {
        if(val.trim().toUpperCase() !== 'DELETE') return showAlert("Error", "Validation failed. Type 'DELETE'.", () => handleFolderDelete(e, folderId));
        const { error } = await supabase.from('folders').delete().eq('id', folderId);
        if (error) showAlert("Database Error", error.message);
        else { if (selectedFolder === folderId) setSelectedFolder(null); fetchFolders(); }
    });
  };

  const handleDeleteFile = async (id: string, path: string) => {
    showPrompt("Delete File", "Type 'CONFIRM' to wipe this file.", async (val) => {
        if (val.trim().toUpperCase() !== 'CONFIRM') return showAlert("Error", "Validation failed. Type 'CONFIRM'.", () => handleDeleteFile(id, path));
        await supabase.storage.from('user-files').remove([path]);
        const { error } = await supabase.from('files').delete().eq('id', id);
        if (error) showAlert("Database Error", error.message);
        else fetchFiles();
    });
  };

  const toggleFolderStatus = async (folderId: string, column: string, currentStatus: boolean) => {
    const { error } = await supabase.from('folders').update({ [column]: !currentStatus }).eq('id', folderId);
    if (error) showAlert("Database Error", error.message);
    else fetchFolders();
  };

  const toggleFilePrivacy = async (fileId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('files').update({ is_public: !currentStatus }).eq('id', fileId);
    if (error) showAlert("Database Error", error.message);
    else fetchFiles();
  };

  // 7. PERMISSIONS LOGIC
  const currentFolder = folders.find(f => f.id === selectedFolder);
  const canManageFolder = currentFolder?.user_id === user?.id || isAdmin;
  const isLockedForUser = selectedFolder && currentFolder?.is_locked && !canManageFolder;

  // 8. RENDER: NOT LOGGED IN
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6 relative overflow-hidden">
        <NetworkBackground />
        
        {modal.show && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-sm w-full shadow-2xl text-center">
                    <h3 className="text-xl font-bold mb-4 italic text-white">{modal.title}</h3>
                    <p className="text-sm text-[#888] mb-6">{modal.message}</p>
                    <button 
                        onClick={() => setModal({ ...modal, show: false })} 
                        className={`w-full py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors ${modal.title === "Success" || modal.title === "Notice" ? "bg-white text-black hover:bg-[#ccc]" : "bg-red-600 text-white hover:bg-red-700"}`}
                    >
                        {modal.title === "Success" || modal.title === "Notice" ? "OK" : "Try Again"}
                    </button>
                </div>
            </div>
        )}
        <div className="bg-[#111]/80 backdrop-blur-xl border border-[#333] p-10 rounded-2xl shadow-2xl w-full max-w-sm z-10">
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tight italic">FileHub Access</h2>
          {isSignUp && <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black/50 border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setUsername(e.target.value)} />}
          <input type="email" value={email} placeholder="Email" className="w-full p-4 mb-4 bg-black/50 border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setEmail(e.target.value)} />
          <div className="relative mb-8">
            <input type={showPassword ? "text" : "password"} value={password} placeholder="Password" className="w-full p-4 bg-black/50 border border-[#333] text-white rounded-lg focus:border-white outline-none pr-12" onChange={e => setPassword(e.target.value)} />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444] hover:text-white transition">{showPassword ? "👁️" : "👁️‍🗨️"}</button>
          </div>
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-xs">{isSignUp ? 'Sign Up' : 'Log In'}</button>
          {!isSignUp && <p onClick={handleForgotPassword} className="text-center mt-4 text-[10px] text-[#444] hover:text-white cursor-pointer transition uppercase tracking-widest font-bold">Forgot Password?</p>}
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-sm text-[#888] cursor-pointer hover:text-white transition">{isSignUp ? 'Back to Login' : 'Create Account'}</p>
        </div>
      </div>
    );
  }

  // 9. RENDER: MAIN DASHBOARD
  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      
      {modal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-sm w-full shadow-2xl">
                <h3 className="text-xl font-bold mb-4 tracking-tight italic">{modal.title}</h3>
                <p className="text-sm text-[#888] mb-6 leading-relaxed">{modal.message}</p>
                {modal.isPrompt && (
                  <div className="relative mb-6">
                    <input autoFocus type={modal.title === "Security Update" && !showPassword ? "password" : "text"} value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full p-3 bg-black border border-[#333] rounded-lg text-white outline-none focus:border-white pr-10" />
                    {modal.title === "Security Update" && <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] text-xs">{showPassword ? "👁️" : "👁️‍🗨️"}</button>}
                  </div>
                )}
                <div className="flex gap-4">
                    <button onClick={() => {
                        const retryAction = modal.onRetry; const confirmAction = modal.onConfirm; const currentInput = modalInput;
                        setModal({ ...modal, show: false });
                        if ((modal.title.includes("Error") || modal.title === "Database Error") && retryAction) setTimeout(() => retryAction(), 100);
                        else if (modal.isPrompt && confirmAction) confirmAction(currentInput);
                    }} className={`flex-1 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors ${modal.title.includes("Error") ? "bg-red-600 text-white" : "bg-white text-black"}`}>{modal.title.includes("Error") ? "Try Again" : "Confirm"}</button>
                    <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 border border-[#333] py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest text-[#444] hover:text-white">Cancel</button>
                </div>
            </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 bg-black border-r border-[#222] p-6 flex flex-col z-20 bg-black/90">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-black">F</div>
          <h1 className="font-bold text-lg tracking-tight">FileHub</h1>
        </div>
        
        <nav className="flex-1 space-y-1 overflow-y-auto pr-2">
          <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false); setViewingComms(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${!selectedFolder && !viewingAdminPanel && !viewingComms ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>Dashboard</button>
          
          <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false); setViewingComms(true);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-2 ${viewingComms ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>💬 Comms</button>

          {isAdmin && (
            <button onClick={() => {setSelectedFolder(null); setViewingComms(false); setViewingAdminPanel(true);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-4 ${viewingAdminPanel ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-500 hover:text-white border border-blue-900/30'}`}>🛠️ Admin</button>
          )}
          
          <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
          {folders.map(folder => (
            <button key={folder.id} onClick={() => {setSelectedFolder(folder.id); setViewingAdminPanel(false); setViewingComms(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm flex items-center justify-between transition ${selectedFolder === folder.id && !viewingComms && !viewingAdminPanel ? 'text-white font-bold bg-[#111]' : 'text-[#888] hover:text-white'}`}>
              <span className="truncate pr-4">📂 {folder.name}</span>
              {(folder.user_id === user.id || isAdmin) && <span onClick={(e) => handleFolderDelete(e, folder.id)} className="text-[10px] hover:text-red-500 cursor-pointer">✕</span>}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-[#222]">
          <input type="text" placeholder="Folder name" className="w-full text-xs p-3 bg-black border border-[#333] rounded-lg mb-2 text-white outline-none focus:border-white" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={folderIsPublic} onChange={e => setFolderIsPublic(e.target.checked)} id="fvis" className="rounded bg-black border-[#333]" />
            <label htmlFor="fvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">PUBLIC GROUP</label>
          </div>
          <button onClick={createFolder} className="w-full py-2.5 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-[#ccc]">NEW FOLDER</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        
        {/* ACCOUNT MENU */}
        <div className="absolute top-12 right-12 z-50">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="w-10 h-10 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white transition-all overflow-hidden shadow-lg font-bold">
              {profileName[0]?.toUpperCase()}
          </button>
          
          {showAccountMenu && (
            <div className="absolute right-0 mt-4 w-64 bg-[#111] border border-[#333] rounded-xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-black text-2xl font-bold mb-4">{profileName[0]?.toUpperCase()}</div>
              <h3 className="text-lg font-bold text-white mb-1">Hi, {profileName}!</h3>
              <p className="text-[10px] text-[#444] mb-6 truncate px-2">{user.email}</p>
              <div className="space-y-2">
                <button onClick={handleChangePassword} className="w-full py-2.5 text-[10px] font-bold border border-[#222] rounded-lg hover:bg-[#1a1a1a] transition uppercase tracking-widest">CHANGE PASSWORD</button>
                <div className="pt-2"><button onClick={handleLogout} className="w-full py-2.5 text-[10px] font-bold bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition uppercase tracking-widest">LOGOUT</button></div>
              </div>
            </div>
          )}
        </div>

        {/* HEADER SECTION WITH THE NETWORK WAVE BACKGROUND */}
        <div className="relative pt-16 px-12 pb-8 border-b border-[#222]/50 bg-gradient-to-b from-[#0a0a0a] to-black">
            <NetworkBackground />
            
            <div className="relative z-10">
                {viewingComms ? (
                    <h2 className="text-4xl font-bold tracking-tight text-white mb-2">Secure Comms Link</h2>
                ) : viewingAdminPanel ? (
                    <h2 className="text-4xl font-bold tracking-tight text-white mb-2">Network Registry</h2>
                ) : (
                    <>
                        <h2 className="text-4xl font-bold tracking-tight text-white mb-2">{currentFolder ? currentFolder.name : 'Root Explorer'}</h2>
                        {currentFolder && (
                            <div className="mt-4 flex items-center gap-4">
                                <p className="text-[#888] text-sm italic">Owner: <span className="text-white font-bold">{currentFolder.owner_username}</span></p>
                                {canManageFolder && (
                                    <div className="flex gap-4 border-l border-[#333] pl-4">
                                        <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_public', currentFolder.is_public)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border transition hover:opacity-80 ${currentFolder.is_public ? 'border-green-900 bg-green-500/10 text-green-500' : 'border-red-900 bg-red-500/10 text-red-500'}`}>{currentFolder.is_public ? '🌐 Public' : '🔒 Private'}</button>
                                        <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_locked', currentFolder.is_locked)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border transition hover:opacity-80 ${currentFolder.is_locked ? 'border-amber-900 bg-amber-500/10 text-amber-500' : 'border-[#333] bg-[#111] text-[#888]'}`}>{currentFolder.is_locked ? '🚫 Locked' : '🔓 Unlocked'}</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>

        {/* MAIN BODY CONTENT */}
        <div className="p-12">
            
            {/* VIEW LOGIC: COMMS UI & CHAT ENGINE */}
            {viewingComms ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* LEFT COLUMN: SEARCH & REQUESTS */}
                        <div className="space-y-8">
                            <div className="bg-[#111]/80 backdrop-blur-md border border-[#333] p-6 rounded-xl shadow-2xl">
                                <h3 className="font-bold text-lg mb-4 text-white">Find Nodes</h3>
                                <div className="flex gap-2 mb-4">
                                    <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Enter exact username..." className="flex-1 bg-black border border-[#333] text-white text-xs p-3 rounded-lg focus:border-white outline-none"/>
                                    <button onClick={handleSearchUsers} className="bg-white text-black font-bold text-[10px] px-4 rounded-lg uppercase tracking-widest hover:bg-[#ccc] transition">Scan</button>
                                </div>
                                <div className="space-y-2">
                                    {searchResults.map(r => (
                                        <div key={r.id} className="flex items-center justify-between bg-black p-3 rounded border border-[#222]">
                                            <span className="text-xs font-bold text-slate-200">{r.username}</span>
                                            <button onClick={() => sendFriendRequest(r.id)} className="text-[10px] font-bold text-blue-500 border border-blue-900/50 bg-blue-500/10 px-3 py-1.5 rounded hover:bg-blue-500/20 uppercase tracking-widest transition">Connect</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-[#111]/80 backdrop-blur-md border border-[#333] p-6 rounded-xl shadow-2xl">
                                <h3 className="font-bold text-lg mb-4 text-white flex items-center justify-between">
                                    Incoming Connections 
                                    {friendRequests.length > 0 && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">{friendRequests.length}</span>}
                                </h3>
                                {friendRequests.length === 0 ? <p className="text-xs text-[#666] italic">No pending requests.</p> : (
                                    <div className="space-y-2">
                                        {friendRequests.map(req => (
                                            <div key={req.id} className="flex items-center justify-between bg-black p-3 rounded border border-[#222]">
                                                <span className="text-xs font-bold text-slate-200">{req.username}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleRequestAction(req.id, 'accept')} className="text-[10px] font-bold text-green-500 hover:text-green-400 uppercase tracking-widest transition">Accept</button>
                                                    <button onClick={() => handleRequestAction(req.id, 'decline')} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest transition">Reject</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: FRIENDS LIST & LIVE CHAT WINDOW */}
                        <div className="lg:col-span-2 bg-[#111]/80 backdrop-blur-md border border-[#333] p-6 rounded-xl shadow-2xl flex flex-col h-[600px]">
                            <h3 className="font-bold text-lg mb-4 text-white">Connected Nodes</h3>
                            
                            <div className="flex gap-3 overflow-x-auto pb-4 border-b border-[#222] mb-4 scrollbar-hide">
                                {friends.length === 0 ? <p className="text-xs text-[#666] italic">No established connections. Scan for nodes to connect.</p> : (
                                    friends.map(f => (
                                        <button key={f.friendship_id} onClick={() => setActiveChat(f)} className={`flex-shrink-0 px-4 py-2 rounded-lg border text-xs font-bold transition ${activeChat?.friendship_id === f.friendship_id ? 'bg-white text-black border-white' : 'bg-black text-[#888] border-[#333] hover:border-white hover:text-white'}`}>
                                            {f.username}
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="flex-1 bg-black rounded-lg border border-[#222] flex flex-col relative overflow-hidden">
                                {!activeChat ? (
                                    <div className="flex-1 flex flex-col items-center justify-center relative">
                                        <NetworkBackground />
                                        <p className="text-[#444] text-xs font-bold uppercase tracking-widest italic z-10">Select a node to establish secure channel</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* CHAT HEADER */}
                                        <div className="p-4 border-b border-[#222] bg-[#111] z-10 flex justify-between items-center">
                                            <div>
                                                <p className="text-green-500 text-[10px] font-bold uppercase tracking-widest">Secure Channel Established</p>
                                                <p className="text-white font-bold text-sm">{activeChat.username}</p>
                                            </div>
                                            <button onClick={() => setActiveChat(null)} className="text-[#888] hover:text-white text-xs font-bold px-2 py-1 border border-[#333] rounded hover:bg-[#333]">✕ Close</button>
                                        </div>

                                        {/* CHAT MESSAGES */}
                                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 z-10">
                                            {messages.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-[#444] text-xs font-bold uppercase tracking-widest italic">
                                                    No messages yet. Begin transmission.
                                                </div>
                                            ) : (
                                                messages.map(msg => {
                                                    const isMine = msg.sender_id === user.id;
                                                    return (
                                                        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                            <div className={`max-w-[70%] rounded-xl p-3 shadow-md ${isMine ? 'bg-blue-600 text-white rounded-br-none' : 'bg-[#222] text-slate-200 rounded-bl-none'}`}>
                                                                {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                                                                {msg.file_name && (
                                                                    <div className={`mt-2 flex items-center gap-3 p-2.5 rounded-lg border ${isMine ? 'bg-blue-700/50 border-blue-500/30' : 'bg-[#111] border-[#444]'}`}>
                                                                        <span className="text-xs truncate font-medium">{msg.file_name}</span>
                                                                        <button onClick={() => handleDownload(msg.file_path, msg.file_name)} className="text-xs shrink-0 bg-black/30 hover:bg-black/50 p-1.5 rounded transition">💾 Download</button>
                                                                    </div>
                                                                )}
                                                                <span className={`text-[8px] opacity-60 block mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
                                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>

                                        {/* CHAT INPUT FORM */}
                                        <form onSubmit={handleSendMessage} className="p-4 bg-[#111] border-t border-[#222] z-10 flex gap-3 items-center">
                                            <div className="flex-1 bg-black border border-[#333] rounded-lg flex items-center pr-2 focus-within:border-white transition">
                                                <input 
                                                    type="text" 
                                                    value={newMessage} 
                                                    onChange={(e) => setNewMessage(e.target.value)} 
                                                    placeholder="Type message..." 
                                                    className="w-full bg-transparent text-white text-sm p-3 outline-none"
                                                />
                                                <input type="file" ref={chatFileInputRef} onChange={e => setChatFile(e.target.files?.[0] || null)} className="hidden" id="chat-file" />
                                                <label htmlFor="chat-file" className={`cursor-pointer px-3 text-sm hover:text-white transition flex items-center gap-2 ${chatFile ? 'text-green-500 font-bold' : 'text-[#666]'}`} title={chatFile ? chatFile.name : "Attach file"}>
                                                    📎 {chatFile && <span className="text-[10px] truncate max-w-[100px]">{chatFile.name}</span>}
                                                </label>
                                            </div>
                                            <button type="submit" disabled={(!newMessage.trim() && !chatFile)} className="bg-white text-black font-bold px-6 py-3 rounded-lg text-xs uppercase tracking-widest hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg">
                                                Send
                                            </button>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            // VIEW LOGIC: ADMIN PANEL
            ) : viewingAdminPanel ? (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-[#080808] border border-[#222] rounded-xl overflow-hidden shadow-2xl">
                <table className="w-full text-left text-xs text-white">
                    <thead className="bg-[#111] text-[#444] uppercase tracking-widest font-bold border-b border-[#222]">
                        <tr><th className="p-4">Identity</th><th className="p-4">Email Channel</th><th className="p-4">Joined</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                    {adminUserList.map(u => (
                        <tr key={u.id} className="hover:bg-[#111] transition duration-300">
                        <td className="p-4 font-bold">{u.identity_name || 'Anonymous Node'}</td>
                        <td className="p-4 text-[#888]">{u.email_address}</td>
                        <td className="p-4 text-[#444] italic">{new Date(u.joined_date).toLocaleDateString()}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
            
            // VIEW LOGIC: FILE EXPLORER
            ) : (
            <>
                {!isLockedForUser ? (
                    <section className="bg-[#111]/80 backdrop-blur-md border border-[#333] rounded-2xl p-10 mb-16 relative shadow-2xl">
                        <h3 className="text-xl font-bold mb-4">Deploy Assets</h3>
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="flex-1 flex items-center gap-4 w-full">
                                <input type="file" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#888] file:mr-6 file:py-2.5 file:px-6 file:rounded-lg file:border file:border-[#333] file:bg-black file:text-white cursor-pointer hover:file:bg-white hover:file:text-black transition file:transition" />
                                {file && <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="px-4 py-2.5 text-[10px] font-bold border border-red-900/30 text-red-500 rounded-lg uppercase tracking-widest hover:bg-red-500/10">CLEAR</button>}
                            </div>
                            <button onClick={handleUpload} disabled={uploading || !file} className="w-full md:w-auto bg-white text-black px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#ccc] transition disabled:opacity-50 disabled:cursor-not-allowed">{uploading ? 'Wait...' : 'Distribute'}</button>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="pvis" className="rounded bg-black border-[#333] cursor-pointer" />
                            <label htmlFor="pvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer hover:text-white transition">PUBLIC GROUP</label>
                        </div>
                    </section>
                ) : (
                    <div className="bg-amber-500/10 border border-amber-900/30 p-8 rounded-2xl mb-16 text-center shadow-lg">
                        <p className="text-amber-500 text-sm font-bold uppercase tracking-widest">Node Locked by {currentFolder?.owner_username}.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filesList.map(f => (
                    <div key={f.id} className="group bg-[#080808] p-6 rounded-xl border border-[#222] hover:border-white transition-all relative shadow-lg hover:shadow-2xl">
                    <div className="absolute top-4 right-4"><span className={`text-[8px] font-bold px-2 py-1 rounded-full border uppercase tracking-widest ${f.is_public ? 'bg-green-500/10 text-green-500 border-green-900/50' : 'bg-amber-500/10 text-amber-500 border-amber-900/50'}`}>{f.is_public ? 'Public' : 'Private'}</span></div>
                    
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-start mb-4 pt-2">
                            <div className="w-12 h-12 bg-[#111] border border-[#222] rounded-lg flex items-center justify-center text-white font-bold text-[10px] uppercase italic transition-all group-hover:bg-white group-hover:text-black shadow-inner">{f.file_name.split('.').pop()}</div>
                        </div>
                        
                        <h4 className="font-bold text-sm truncate mb-1 text-slate-200" title={f.file_name}>{f.file_name}</h4>
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#444] uppercase mb-4"><span className="truncate pr-2">{f.owner_username}</span><span className="shrink-0 text-[#666]">{formatBytes(f.file_size)}</span></div>
                        
                        <div className="mt-auto pt-4 border-t border-[#222] flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="flex-1 py-2 bg-[#111] border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm">💾</button>
                            
                            {(user.id === f.user_id || canManageFolder) && (
                                <>
                                <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`flex-1 py-2 border border-[#222] rounded flex justify-center hover:text-white hover:border-[#444] transition text-xs shadow-sm ${f.is_public ? 'text-blue-900 hover:bg-blue-900/20' : 'text-amber-900 hover:bg-amber-900/20'}`}>{f.is_public ? '🌐' : '🔒'}</button>
                                <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="flex-1 py-2 border border-[#222] rounded flex justify-center hover:text-red-500 hover:border-red-900/50 hover:bg-red-500/10 transition text-xs text-[#444] shadow-sm">🗑️</button>
                                </>
                            )}
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            </>
            )}
        </div>
      </main>
    </div>
  );
}