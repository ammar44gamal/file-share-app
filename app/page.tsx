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

  const fetchProfile = async (currentUser: any) => {
    const { data } = await supabase.from('profiles').select('username, is_admin').eq('id', currentUser.id).single();
    const isMasterEmail = currentUser?.email === 'ammargamal44s@gmail.com';
    if (data) {
      setProfileName(data.username);
      setIsAdmin(data.is_admin || isMasterEmail); 
    } else if (isMasterEmail) {
      setIsAdmin(true);
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

  const createFolder = async () => {
    if (!newFolderName || !user) return;
    await supabase.from('folders').insert([{ name: newFolderName, user_id: user.id, is_public: folderIsPublic }]);
    setNewFolderName('');
    fetchFolders();
  };

  const handleFolderDelete = async (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (!confirm("Delete folder and all files?")) return;
    await supabase.from('folders').delete().eq('id', folderId);
    if (selectedFolder === folderId) setSelectedFolder(null);
    fetchFolders();
  };

  const handleAuth = async () => {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert(error.message);
      if (data.user) await supabase.from('profiles').insert([{ id: data.user.id, username }]);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert(error.message);
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

  const handleDeleteFile = async (id: string, path: string) => {
    if (!confirm("Delete file?")) return;
    await supabase.storage.from('user-files').remove([path]);
    await supabase.from('files').delete().eq('id', id);
    fetchFiles();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload(); 
  };

  const handleChangePassword = async () => {
    const newPassword = prompt("Enter your new secure password:");
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else alert("Success.");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        <div className="bg-[#111] border border-[#333] p-10 rounded-2xl shadow-2xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tight">FileHub Access</h2>
          {isSignUp && (
            <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-8 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-xs">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-sm text-[#888] cursor-pointer hover:text-white transition">
            {isSignUp ? 'Already have an account? Login' : 'Create Account'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans">
      <aside className="w-64 bg-black border-r border-[#222] p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-black">F</div>
          <h1 className="font-bold text-lg tracking-tight">FileHub</h1>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${!selectedFolder && !viewingAdminPanel ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>
            Dashboard
          </button>
          {isAdmin && (
            <button onClick={() => setViewingAdminPanel(true)} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition mt-4 ${viewingAdminPanel ? 'bg-blue-600 text-white' : 'text-blue-500 hover:text-white border border-blue-900/30'}`}>
              🛠️ Admin
            </button>
          )}
          <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
          {folders.map(folder => (
            <div key={folder.id} className="group relative">
              <button onClick={() => {setSelectedFolder(folder.id); setViewingAdminPanel(false);}} className={`w-full text-left px-4 py-2 rounded-lg text-sm flex items-center justify-between transition ${selectedFolder === folder.id ? 'text-white font-bold bg-[#111]' : 'text-[#888] hover:text-white'}`}>
                <span className="truncate pr-4">📂 {folder.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${folder.is_public ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                  {user.id === folder.user_id && (
                    <span onClick={(e) => handleFolderDelete(e, folder.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 cursor-pointer text-sm">🗑️</span>
                  )}
                </div>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 relative">
        <div className="absolute top-12 right-12 z-50">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="w-10 h-10 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white transition-all overflow-hidden shadow-lg">
            <span className="text-xs font-bold">{profileName[0]?.toUpperCase()}</span>
          </button>
          {showAccountMenu && (
            <div className="absolute right-0 mt-4 w-64 bg-[#111] border border-[#333] rounded-xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-black text-2xl font-bold mb-4">{profileName[0]?.toUpperCase()}</div>
              <h3 className="text-lg font-bold text-white mb-1">Hi, {profileName}!</h3>
              <p className="text-[10px] text-[#444] mb-6 truncate px-2">{user.email}</p>
              <div className="space-y-2">
                <button onClick={handleChangePassword} className="w-full py-2.5 text-xs font-bold border border-[#222] rounded-lg hover:bg-[#1a1a1a] transition uppercase tracking-widest">Password</button>
                <div className="pt-2">
                  <button onClick={handleLogout} className="w-full py-2.5 text-xs font-bold bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition uppercase tracking-widest">Logout</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {viewingAdminPanel ? (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <header className="mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-white">Network Registry</h2>
              <p className="text-[#888] text-sm mt-1 italic">Master list of active nodes</p>
            </header>
            <div className="bg-[#080808] border border-[#222] rounded-xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs text-white">
                <thead className="bg-[#111] text-[#444] uppercase tracking-widest font-bold border-b border-[#222]">
                  <tr><th className="p-4">Identity</th><th className="p-4">Email Channel</th><th className="p-4">Joined</th></tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {adminUserList.map(u => (
                    <tr key={u.id} className="hover:bg-[#111] transition duration-300">
                      <td className="p-4 font-bold">{u.identity}</td>
                      <td className="p-4 text-[#888]">{u.email}</td>
                      <td className="p-4 text-[#444] italic">{new Date(u.joined).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <header className="mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-white">{selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Root Explorer'}</h2>
              <p className="text-[#888] text-sm mt-1 italic">Node v4.5 Active</p>
            </header>
            {/* Grid logic continues as before... */}
          </>
        )}
      </main>
    </div>
  );
}