'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributedFileHub() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 
  
  const [filesList, setFilesList] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  
  const [newFolderName, setNewFolderName] = useState('');
  const [folderIsPublic, setFolderIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [profileName, setProfileName] = useState('User');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [adminUserList, setAdminUserList] = useState<any[]>([]);
  const [viewingAdminPanel, setViewingAdminPanel] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modal, setModal] = useState<{
    show: boolean, title: string, message: string, onConfirm?: (val: string) => void, onRetry?: () => void, isPrompt?: boolean
  }>({ show: false, title: '', message: '', isPrompt: false });
  const [modalInput, setModalInput] = useState('');

  // 1. SESSION & ADMIN SYNC
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        await fetchProfile(session.user);
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) await fetchProfile(currentUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. DATA REFRESH
  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchFiles();
      if (isAdmin && viewingAdminPanel) fetchAdminStats();
    }
  }, [user, selectedFolder, viewingAdminPanel, isAdmin]);

  const fetchProfile = async (currentUser: any) => {
    const { data } = await supabase.from('profiles').select('username, is_admin').eq('id', currentUser.id).single();
    const isMasterEmail = currentUser?.email === 'ammargamal44s@gmail.com';
    const status = !!(data?.is_admin || isMasterEmail);
    setIsAdmin(status);
    setProfileName(data?.username || currentUser.email.split('@')[0]);
  };

  const showAlert = (title: string, message: string, retryAction?: () => void) => {
    setModal({ show: true, title, message, isPrompt: false, onRetry: retryAction });
  };

  const showPrompt = (title: string, message: string, onConfirm: (val: string) => void) => {
    setModalInput('');
    setModal({ show: true, title, message, isPrompt: true, onConfirm: (val) => onConfirm(val) });
  };

  const fetchFolders = async () => {
    let query = supabase.from('folders').select('*').order('name');
    if (!isAdmin) {
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    }
    const { data } = await query;
    setFolders(data || []);
  };

  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false });
    if (selectedFolder) query = query.eq('folder_id', selectedFolder);
    else query = query.is('folder_id', null);

    if (!isAdmin) {
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    }
    const { data } = await query;
    setFilesList(data || []);
  };

  const handleAuth = async () => {
    if (isSignUp) {
      if (!username) return showAlert("Notice", "Please enter a Username.");
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return showAlert("Error", error.message);
      if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, username, is_admin: false }]);
      }
      showAlert("Success", "Verification email sent!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return showAlert("Error", error.message);
    }
  };

  const createFolder = async () => {
    if (!newFolderName || !user) return;
    const { error } = await supabase.from('folders').insert([{ 
        name: newFolderName, user_id: user.id, is_public: folderIsPublic, owner_username: profileName
    }]);
    if (error) showAlert("Error", error.message);
    else { setNewFolderName(''); fetchFolders(); }
  };

  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    showPrompt("Delete Folder", "Type 'DELETE' to confirm.", async (val) => {
        if(val.trim().toUpperCase() !== 'DELETE') {
            showAlert("Error", "Validation failed.", () => handleFolderDelete(e, folderId));
            return;
        }
        await supabase.from('folders').delete().eq('id', folderId);
        if (selectedFolder === folderId) setSelectedFolder(null);
        fetchFolders();
    });
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(fileName, file);
      await supabase.from('files').insert([{ 
        file_name: file.name, file_size: file.size, storage_path: fileName,
        is_public: isPublic, owner_username: profileName, user_id: user.id, folder_id: selectedFolder
      }]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = ""; 
      fetchFiles();
    } finally { setUploading(false); }
  };

  const handleDeleteFile = async (id: string, path: string) => {
    showPrompt("Delete File", "Type 'CONFIRM' to wipe this file.", async (val) => {
        if (val.trim().toUpperCase() !== 'CONFIRM') {
            showAlert("Error", "Validation failed.", () => handleDeleteFile(id, path));
            return;
        }
        await supabase.storage.from('user-files').remove([path]);
        await supabase.from('files').delete().eq('id', id);
        fetchFiles();
    });
  };

  const toggleFolderStatus = async (folderId: string, column: string, currentStatus: boolean) => {
    await supabase.from('folders').update({ [column]: !currentStatus }).eq('id', folderId);
    fetchFolders();
  };

  const toggleFilePrivacy = async (fileId: string, currentStatus: boolean) => {
    await supabase.from('files').update({ is_public: !currentStatus }).eq('id', fileId);
    fetchFiles();
  };

  const handleDownload = async (path: string, name: string) => {
    const { data } = await supabase.storage.from('user-files').download(path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
    }
  };

  const fetchAdminStats = async () => {
    const { data } = await supabase.from('admin_user_stats').select('*');
    setAdminUserList(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload(); 
  };

  const currentFolder = folders.find(f => f.id === selectedFolder);
  const canManageFolder = currentFolder?.user_id === user?.id || isAdmin;
  const isLockedForUser = selectedFolder && currentFolder?.is_locked && !isAdmin;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        <div className="bg-[#111] border border-[#333] p-10 rounded-2xl shadow-2xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-8 text-center text-white italic">FileHub Access</h2>
          {isSignUp && <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg outline-none" onChange={e => setUsername(e.target.value)} />}
          <input type="email" value={email} placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg outline-none" onChange={e => setEmail(e.target.value)} />
          <div className="relative mb-8">
            <input type={showPassword ? "text" : "password"} value={password} placeholder="Password" className="w-full p-4 bg-black border border-[#333] text-white rounded-lg outline-none pr-12" onChange={e => setPassword(e.target.value)} />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444]">{showPassword ? "👁️" : "👁️‍🗨️"}</button>
          </div>
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-xs">{isSignUp ? 'Sign Up' : 'Log In'}</button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-sm text-[#888] cursor-pointer hover:text-white transition">{isSignUp ? 'Back to Login' : 'Create Account'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans">
      {modal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-sm w-full">
                <h3 className="text-xl font-bold mb-4 italic">{modal.title}</h3>
                <p className="text-sm text-[#888] mb-6">{modal.message}</p>
                {modal.isPrompt && <input autoFocus type="text" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full p-3 bg-black border border-[#333] rounded-lg mb-6 text-white outline-none" />}
                <div className="flex gap-4">
                    <button onClick={() => {
                        const retry = modal.onRetry; const confirm = modal.onConfirm; const input = modalInput;
                        setModal({ ...modal, show: false });
                        if (modal.title.includes("Error") && retry) setTimeout(() => retry(), 100);
                        else if (modal.isPrompt && confirm) confirm(input);
                    }} className={`flex-1 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest ${modal.title.includes("Error") ? "bg-red-600" : "bg-white text-black"}`}>{modal.title.includes("Error") ? "Try Again" : "Confirm"}</button>
                    <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 border border-[#333] py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest text-[#444]">Cancel</button>
                </div>
            </div>
        </div>
      )}

      <aside className="w-64 bg-black border-r border-[#222] p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-black">F</div>
          <h1 className="font-bold text-lg tracking-tight">FileHub</h1>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${!selectedFolder && !viewingAdminPanel ? 'bg-[#111] text-white' : 'text-[#888]'}`}>Dashboard</button>
          {isAdmin && <button onClick={() => setViewingAdminPanel(true)} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-4 ${viewingAdminPanel ? 'bg-blue-600 text-white' : 'text-blue-500 border border-blue-900/30'}`}>🛠️ Admin</button>}
          <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
          {folders.map(folder => (
            <button key={folder.id} onClick={() => {setSelectedFolder(folder.id); setViewingAdminPanel(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm flex items-center justify-between transition ${selectedFolder === folder.id ? 'text-white bg-[#111]' : 'text-[#888]'}`}>
              <span className="truncate pr-4">📂 {folder.name}</span>
              {(folder.user_id === user.id || isAdmin) && <span onClick={(e) => handleFolderDelete(e, folder.id)} className="text-[10px] hover:text-red-500 cursor-pointer">✕</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-[#222]">
          <input type="text" placeholder="Folder name" className="w-full text-xs p-3 bg-black border border-[#333] rounded-lg mb-2 text-white outline-none" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={folderIsPublic} onChange={e => setFolderIsPublic(e.target.checked)} id="fvis" className="rounded bg-black border-[#333]" />
            <label htmlFor="fvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">PUBLIC GROUP</label>
          </div>
          <button onClick={createFolder} className="w-full py-2.5 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest">NEW FOLDER</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 relative">
        <div className="absolute top-12 right-12 z-50">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="w-10 h-10 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white shadow-lg font-bold">{profileName[0]?.toUpperCase()}</button>
          {showAccountMenu && (
            <div className="absolute right-0 mt-4 w-64 bg-[#111] border border-[#333] rounded-xl shadow-2xl p-6 text-center">
              <h3 className="text-lg font-bold text-white mb-1">Hi, {profileName}!</h3>
              <p className="text-[10px] text-[#444] mb-6">{user.email}</p>
              <button onClick={handleLogout} className="w-full py-2.5 text-[10px] font-bold bg-red-500/10 text-red-500 rounded-lg uppercase tracking-widest">LOGOUT</button>
            </div>
          )}
        </div>

        {viewingAdminPanel ? (
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-12">Network Registry</h2>
            <div className="bg-[#080808] border border-[#222] rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#111] text-[#444] uppercase tracking-widest border-b border-[#222]"><tr><th className="p-4">Identity</th><th className="p-4">Email</th><th className="p-4">Joined</th></tr></thead>
                <tbody className="divide-y divide-[#222]">
                  {adminUserList.map(u => (
                    <tr key={u.id} className="hover:bg-[#111]">
                      <td className="p-4 font-bold">{u.identity_name || 'Anonymous Node'}</td>
                      <td className="p-4 text-[#888]">{u.email_address}</td>
                      <td className="p-4 text-[#444]">{new Date(u.joined_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-16">
              <h2 className="text-3xl font-bold text-white">{currentFolder ? currentFolder.name : 'Root Explorer'}</h2>
              {currentFolder && (
                <div className="mt-2 flex items-center gap-4">
                  <p className="text-[#888] text-sm">Owner: <span className="text-white font-bold">{currentFolder.owner_username}</span></p>
                  {canManageFolder && (
                    <div className="flex gap-4 border-l border-[#333] pl-4">
                        <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_public', currentFolder.is_public)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border ${currentFolder.is_public ? 'border-green-900 text-green-500' : 'border-red-900 text-red-500'}`}>{currentFolder.is_public ? '🌐 Public' : '🔒 Private'}</button>
                        <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_locked', currentFolder.is_locked)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border ${currentFolder.is_locked ? 'border-amber-900 text-amber-500' : 'border-[#333] text-[#888]'}`}>{currentFolder.is_locked ? '🚫 Locked' : '🔓 Unlocked'}</button>
                    </div>
                  )}
                </div>
              )}
            </header>

            {!isLockedForUser ? (
                <section className="bg-[#111] border border-[#333] rounded-2xl p-10 mb-16 shadow-2xl">
                    <h3 className="text-xl font-bold mb-4">Deploy Assets</h3>
                    <div className="flex items-center gap-6">
                        <input type="file" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1 text-xs text-[#888] file:mr-6 file:py-2.5 file:px-6 file:rounded-lg file:bg-black file:text-white" />
                        <button onClick={handleUpload} disabled={uploading || !file} className="bg-white text-black px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-[#ccc]">{uploading ? 'Wait' : 'Distribute'}</button>
                    </div>
                </section>
            ) : (
                <div className="bg-amber-500/10 border border-amber-900/30 p-8 rounded-2xl mb-16 text-center text-amber-500 font-bold uppercase text-sm tracking-widest">Node Locked by {currentFolder?.owner_username}.</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filesList.map(f => (
                <div key={f.id} className="group bg-[#080808] p-6 rounded-xl border border-[#222] hover:border-white transition-all relative">
                  <div className="absolute top-4 right-4"><span className={`text-[8px] font-bold px-2 py-1 rounded-full border uppercase tracking-widest ${f.is_public ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{f.is_public ? 'Public' : 'Private'}</span></div>
                  <div className="flex flex-col h-full">
                    <div className="w-12 h-12 bg-[#111] border border-[#222] rounded-lg flex items-center justify-center text-white font-bold text-[10px] uppercase mb-4">{f.file_name.split('.').pop()}</div>
                    <h4 className="font-bold text-sm truncate mb-1 text-slate-200">{f.file_name}</h4>
                    <div className="flex items-center justify-between text-[10px] font-bold text-[#333] uppercase mb-4"><span>{f.owner_username}</span><span>{(f.file_size/1024).toFixed(1)} KB</span></div>
                    <div className="mt-auto pt-4 border-t border-[#222] flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="flex-1 py-2 bg-[#111] border border-[#222] rounded hover:text-white transition text-xs">💾</button>
                        {(user.id === f.user_id || canManageFolder) && (
                            <><button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`flex-1 py-2 border border-[#222] rounded hover:text-white transition text-xs ${f.is_public ? 'text-blue-900' : 'text-amber-900'}`}>{f.is_public ? '🌐' : '🔒'}</button>
                            <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="flex-1 py-2 border border-[#222] rounded hover:text-red-500 transition text-xs text-[#222]">🗑️</button></>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}