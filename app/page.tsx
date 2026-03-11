'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributedFileHub() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
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

  // MODAL STATE
  const [modal, setModal] = useState<{
    show: boolean, 
    title: string, 
    message: string, 
    onConfirm?: (val: string) => void, 
    onRetry?: () => void,
    isPrompt?: boolean
  }>({
    show: false, title: '', message: '', isPrompt: false
  });
  const [modalInput, setModalInput] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchFiles();
      if (isAdmin && viewingAdminPanel) fetchAdminStats();
    }
  }, [user, selectedFolder, viewingAdminPanel, isAdmin]);

  const showAlert = (title: string, message: string, retryAction?: () => void) => {
    setModal({ show: true, title, message, isPrompt: false, onRetry: retryAction });
  };

  const showPrompt = (title: string, message: string, onConfirm: (val: string) => void) => {
    setModalInput('');
    setModal({ show: true, title, message, isPrompt: true, onConfirm: (val: string) => onConfirm(val) });
  };

  const fetchProfile = async (currentUser: any) => {
    const { data } = await supabase.from('profiles').select('username, is_admin').eq('id', currentUser.id).single();
    const isMasterEmail = currentUser?.email === 'ammargamal44s@gmail.com';
    if (data && data.username) {
      setProfileName(data.username); 
      setIsAdmin(data.is_admin || isMasterEmail); 
    } else {
      setProfileName(currentUser.email.split('@')[0]);
      setIsAdmin(isMasterEmail);
    }
  };

  const fetchAdminStats = async () => {
    const { data } = await supabase.from('admin_user_stats').select('*');
    setAdminUserList(data || []);
  };

  const fetchFolders = async () => {
    const { data } = await supabase.from('folders').select('*').order('name');
    setFolders(data || []);
  };

  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false });
    if (selectedFolder) query = query.eq('folder_id', selectedFolder);
    else query = query.is('folder_id', null);
    const { data } = await query;
    setFilesList(data || []);
  };

  const toggleFilePrivacy = async (fileId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('files').update({ is_public: !currentStatus }).eq('id', fileId);
    if (!error) fetchFiles();
  };

  const toggleFolderStatus = async (folderId: string, column: string, currentStatus: boolean) => {
    await supabase.from('folders').update({ [column]: !currentStatus }).eq('id', folderId);
    fetchFolders();
  };

  const createFolder = async () => {
    if (!newFolderName || !user) return;
    await supabase.from('folders').insert([{ 
        name: newFolderName, 
        user_id: user.id, 
        is_public: folderIsPublic,
        owner_username: profileName
    }]);
    setNewFolderName('');
    fetchFolders();
  };

  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    showPrompt("Delete Folder", "Type 'DELETE' to confirm folder removal.", (val) => {
        if(val !== 'DELETE') {
            showAlert("Error", "Validation failed. Type 'DELETE' in all caps.", () => handleFolderDelete(e, folderId));
            return;
        }
        supabase.from('folders').delete().eq('id', folderId).then(() => {
            if (selectedFolder === folderId) setSelectedFolder(null);
            fetchFolders();
        });
    });
  };

  const handleAuth = async () => {
    if (isSignUp) {
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

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(fileName, file);
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      const displayName = profile?.username || user.email.split('@')[0];
      await supabase.from('files').insert([{ 
        file_name: file.name, file_size: file.size, storage_path: fileName,
        is_public: isPublic, owner_username: displayName, user_id: user.id, folder_id: selectedFolder
      }]);
      setFile(null);
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

  // UPDATED: Strict Validation with Retry Loop
  const handleDeleteFile = async (id: string, path: string) => {
    showPrompt("Delete File", "Type 'CONFIRM' to wipe this file.", async (val) => {
        if (val !== 'CONFIRM') {
            showAlert("Error", "Validation failed. Type 'CONFIRM' exactly.", () => handleDeleteFile(id, path));
            return;
        }
        await supabase.storage.from('user-files').remove([path]);
        await supabase.from('files').delete().eq('id', id);
        fetchFiles();
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload(); 
  };

  const handleChangePassword = () => {
    showPrompt("Security Update", "New password (min 6 chars):", async (val) => {
        if(!val) return;
        const { error } = await supabase.auth.updateUser({ password: val });
        if (error) showAlert("Error", error.message, () => handleChangePassword());
        else showAlert("Success", "Credentials updated.");
    });
  };

  const currentFolder = folders.find(f => f.id === selectedFolder);
  const isFolderOwner = currentFolder?.user_id === user?.id;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        {modal.show && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-sm w-full shadow-2xl">
                    <h3 className="text-xl font-bold mb-4 italic text-white">{modal.title}</h3>
                    <p className="text-sm text-[#888] mb-6">{modal.message}</p>
                    <button onClick={() => setModal({ ...modal, show: false })} className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest">Try Again</button>
                </div>
            </div>
        )}
        <div className="bg-[#111] border border-[#333] p-10 rounded-2xl shadow-2xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tight italic">FileHub Access</h2>
          {isSignUp && (
            <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" value={email} placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setEmail(e.target.value)} />
          <input type="password" value={password} placeholder="Password" className="w-full p-4 mb-8 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-xs">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-sm text-[#888] cursor-pointer hover:text-white transition">
            {isSignUp ? 'Back to Login' : 'Create Account'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {modal.show && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#111] border border-[#333] p-8 rounded-2xl max-w-sm w-full shadow-2xl">
                <h3 className="text-xl font-bold mb-4 tracking-tight italic">{modal.title}</h3>
                <p className="text-sm text-[#888] mb-6 leading-relaxed">{modal.message}</p>
                {modal.isPrompt && (
                    <input autoFocus type="password" value={modalInput} onChange={(e) => setModalInput(e.target.value)} className="w-full p-3 bg-black border border-[#333] rounded-lg mb-6 text-white outline-none focus:border-white" />
                )}
                <div className="flex gap-4">
                    <button 
                        onClick={() => {
                            const retryAction = modal.onRetry;
                            const confirmAction = modal.onConfirm;
                            const currentInput = modalInput;
                            setModal({ ...modal, show: false });
                            if (modal.title === "Error" && retryAction) setTimeout(() => retryAction(), 100);
                            else if (modal.isPrompt && confirmAction) confirmAction(currentInput);
                        }} 
                        className={`flex-1 py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-colors ${
                            modal.title === "Error" ? "bg-red-600 text-white" : "bg-white text-black"
                        }`}
                    >
                        {modal.title === "Error" ? "Try Again" : "Confirm"}
                    </button>
                    <button onClick={() => setModal({ ...modal, show: false })} className="flex-1 border border-[#333] py-3 rounded-lg font-bold text-[10px] uppercase tracking-widest text-[#444] hover:text-white">Cancel</button>
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
          <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${!selectedFolder && !viewingAdminPanel ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>Dashboard</button>
          {isAdmin && (
            <button onClick={() => setViewingAdminPanel(true)} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-4 ${viewingAdminPanel ? 'bg-blue-600 text-white' : 'text-blue-500 border border-blue-900/30'}`}>🛠️ Admin</button>
          )}
          <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
          {folders.map(folder => (
            <button key={folder.id} onClick={() => {setSelectedFolder(folder.id); setViewingAdminPanel(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm flex items-center justify-between transition ${selectedFolder === folder.id ? 'text-white font-bold bg-[#111]' : 'text-[#888] hover:text-white'}`}>
              <span className="truncate pr-4">📂 {folder.name}</span>
              {folder.user_id === user.id && <span onClick={(e) => handleFolderDelete(e, folder.id)} className="text-[10px] hover:text-red-500">✕</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-[#222]">
          <input type="text" placeholder="Folder name" className="w-full text-xs p-3 bg-black border border-[#333] rounded-lg mb-2 text-white" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={folderIsPublic} onChange={e => setFolderIsPublic(e.target.checked)} id="fvis" className="rounded bg-black border-[#333]" />
            <label htmlFor="fvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">PUBLIC GROUP</label>
          </div>
          <button onClick={createFolder} className="w-full py-2.5 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest">NEW FOLDER</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 relative">
        <div className="absolute top-12 right-12 z-50">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="w-10 h-10 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white transition-all overflow-hidden shadow-lg"><span className="text-xs font-bold">{profileName[0]?.toUpperCase()}</span></button>
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

        {viewingAdminPanel ? (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <header className="mb-12"><h2 className="text-3xl font-bold tracking-tight text-white">Network Registry</h2></header>
            <div className="bg-[#080808] border border-[#222] rounded-xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#111] text-[#444] uppercase tracking-widest font-bold border-b border-[#222]"><tr><th className="p-4">Identity</th><th className="p-4">Email Channel</th><th className="p-4">Joined</th></tr></thead>
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
        ) : (
          <>
            <header className="mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-white">{currentFolder ? currentFolder.name : 'Root Explorer'}</h2>
              {currentFolder && (
                <div className="mt-2 flex items-center gap-4">
                    <p className="text-[#888] text-sm italic">Owner: <span className="text-white font-bold">{currentFolder.owner_username}</span></p>
                    {isFolderOwner && (
                        <div className="flex gap-4 border-l border-[#333] pl-4">
                            <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_public', currentFolder.is_public)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border ${currentFolder.is_public ? 'border-green-900 text-green-500' : 'border-red-900 text-red-500'}`}>
                                {currentFolder.is_public ? '🌐 Public' : '🔒 Private'}
                            </button>
                            <button onClick={() => toggleFolderStatus(currentFolder.id, 'is_locked', currentFolder.is_locked)} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border ${currentFolder.is_locked ? 'border-amber-900 text-amber-500' : 'border-[#333] text-[#888]'}`}>
                                {currentFolder.is_locked ? '🚫 Locked' : '🔓 Unlocked'}
                            </button>
                        </div>
                    )}
                </div>
              )}
            </header>

            {(!currentFolder?.is_locked || isFolderOwner) ? (
                <section className="bg-[#111] border border-[#333] rounded-2xl p-10 mb-16 relative shadow-2xl">
                    <h3 className="text-xl font-bold mb-4">Deploy Assets</h3>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 flex items-center gap-4 w-full">
                            <input type="file" key={file ? 'loaded' : 'empty'} onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#888] file:mr-6 file:py-2.5 file:px-6 file:rounded-lg file:border file:border-[#333] file:bg-black file:text-white" />
                            {file && <button onClick={() => setFile(null)} className="px-4 py-2.5 text-[10px] font-bold border border-red-900/30 text-red-500 rounded-lg uppercase tracking-widest">Clear</button>}
                        </div>
                        <button onClick={handleUpload} disabled={uploading || !file} className="w-full md:w-auto bg-white text-black px-10 py-3 rounded-lg font-bold text-xs uppercase tracking-widest">{uploading ? 'Wait' : 'Distribute'}</button>
                    </div>
                </section>
            ) : (
                <div className="bg-amber-500/10 border border-amber-900/30 p-8 rounded-2xl mb-16 text-center">
                    <p className="text-amber-500 text-sm font-bold uppercase tracking-widest">Node Locked by {currentFolder?.owner_username}.</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filesList.map(f => (
                <div key={f.id} className="group bg-[#080808] p-6 rounded-xl border border-[#222] hover:border-white transition-all relative">
                  <div className="absolute top-4 right-4"><span className={`text-[8px] font-bold px-2 py-1 rounded-full border uppercase tracking-widest ${f.is_public ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>{f.is_public ? 'Public' : 'Private'}</span></div>
                  <div className="flex justify-between items-start mb-6 pt-2">
                    <div className="w-12 h-12 bg-[#111] border border-[#222] rounded-lg flex items-center justify-center text-white font-bold text-[10px] uppercase italic transition-all group-hover:bg-white group-hover:text-black">{f.file_name.split('.').pop()}</div>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="text-[#444] hover:text-white transition">💾</button>
                       {(user.id === f.user_id || isFolderOwner) && (
                         <><button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`${f.is_public ? 'text-blue-900' : 'text-amber-900'} hover:text-white transition`}>{f.is_public ? '🌐' : '🔒'}</button>
                         <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="text-[#222] hover:text-red-500 transition">🗑️</button></>
                       )}
                    </div>
                  </div>
                  <h4 className="font-bold text-sm truncate mb-1 text-slate-200">{f.file_name}</h4>
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#333] uppercase"><span>{f.owner_username}</span><span>{(f.file_size/1024).toFixed(1)} KB</span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}