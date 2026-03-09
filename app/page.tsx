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

  // New Identity Management States
  const [profileName, setProfileName] = useState('User');
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile(currentUser.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchFiles();
    }
  }, [user, selectedFolder]);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('username').eq('id', uid).single();
    if (data) setProfileName(data.username);
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
    const { error } = await supabase
      .from('files')
      .update({ is_public: !currentStatus })
      .eq('id', fileId);
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
    if (!confirm("Delete folder and all files inside?")) return;
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

  // --- IDENTITY MANAGEMENT ACTIONS ---

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload(); 
  };

  const handleChangePassword = async () => {
    const newPassword = prompt("Enter your new secure password:");
    if (!newPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) alert(error.message);
    else alert("Password updated successfully!");
  };

  const handlePermanentSignOut = async () => {
    const confirmDelete = confirm("CRITICAL: This will permanently delete your account and all your uploaded data. You will need to re-register to return. Proceed?");
    if (!confirmDelete) return;
    
    // Deleting the profile triggers the cascading delete for all files
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (!error) {
      alert("Identity and data purged from the network.");
      handleLogout();
    } else {
      alert("Purge failed. Check network status.");
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        <div className="bg-[#111] border border-[#333] p-12 rounded-[2rem] shadow-2xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tighter">FileHub Auth</h2>
          {isSignUp && (
            <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-8 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-[10px]">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-xs text-[#555] cursor-pointer hover:text-white transition uppercase font-black tracking-widest">
            {isSignUp ? 'Return to Login' : 'Create Account'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <aside className="w-72 bg-black border-r border-[#222] p-8 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-black">F</div>
          <h1 className="font-bold text-xl tracking-tight">FileHub</h1>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-4 py-3 rounded-xl text-sm transition ${!selectedFolder ? 'bg-[#111] border border-[#333] text-white' : 'text-[#888] hover:text-white'}`}>
            Global Dashboard
          </button>
          <div className="pt-8 pb-3 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
          {folders.map(folder => (
            <div key={folder.id} className="group relative">
              <button onClick={() => setSelectedFolder(folder.id)} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center justify-between transition ${selectedFolder === folder.id ? 'text-white font-bold bg-[#111]' : 'text-[#888] hover:text-white'}`}>
                <div className="flex items-center gap-2">
                  <span>📁</span>
                  <span className="truncate w-32">{folder.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${folder.is_public ? 'bg-green-500' : 'bg-amber-500'}`} title={folder.is_public ? "Public" : "Private"}></span>
                  {user.id === folder.user_id && (
                    <span onClick={(e) => handleFolderDelete(e, folder.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 cursor-pointer text-sm">🗑️</span>
                  )}
                </div>
              </button>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-[#222]">
          <input type="text" placeholder="New folder..." className="w-full text-xs p-3 bg-black border border-[#333] rounded-lg mb-3 outline-none focus:border-white" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={folderIsPublic} onChange={e => setFolderIsPublic(e.target.checked)} id="fvis" className="rounded bg-black border-[#333]" />
            <label htmlFor="fvis" className="text-[9px] font-bold text-[#444] uppercase tracking-widest cursor-pointer underline">Public Group</label>
          </div>
          <button onClick={createFolder} className="w-full py-3 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-[#ccc]">Create</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-16 relative">
        {/* TOP RIGHT IDENTITY MENU */}
        <div className="absolute top-10 right-10 z-50">
          <button 
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-10 h-10 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white transition-all overflow-hidden shadow-lg shadow-white/5"
          >
            <span className="text-xs font-black">{profileName[0]?.toUpperCase()}</span>
          </button>

          {showAccountMenu && (
            <div className="absolute right-0 mt-4 w-64 bg-[#111] border border-[#333] rounded-2xl shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center text-black text-2xl font-black mb-4">
                {profileName[0]?.toUpperCase()}
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Hi, {profileName}!</h3>
              <p className="text-[9px] text-[#444] font-black uppercase tracking-[0.2em] mb-6 truncate px-2">{user.email}</p>
              
              <div className="space-y-2">
                <button onClick={handleChangePassword} className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest border border-[#222] rounded-xl hover:bg-[#1a1a1a] transition">
                  Change Password
                </button>
                <button onClick={handleLogout} className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest border border-[#222] rounded-xl hover:bg-[#1a1a1a] transition">
                  Log Out
                </button>
                <div className="pt-4 mt-2 border-t border-[#222]">
                  <button onClick={handlePermanentSignOut} className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition">
                    Sign Out (Delete)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <header className="mb-16">
          <h2 className="text-4xl font-bold tracking-tighter">
            {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Root Directory'}
          </h2>
          <p className="text-[#444] text-[10px] font-bold uppercase tracking-[0.3em] mt-2 italic">Node v4.5 Active</p>
        </header>

        <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2.5rem] p-12 mb-20 shadow-2xl">
          <h3 className="text-lg font-bold mb-2">Deploy Data</h3>
          <p className="text-[#444] text-xs mb-10 font-medium">Replicating metadata across distributed nodes.</p>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#444] file:mr-6 file:py-2.5 file:px-8 file:rounded-lg file:border file:border-[#222] file:bg-black file:text-white hover:file:bg-[#111] cursor-pointer" />
            <button onClick={handleUpload} disabled={uploading || !file} className="w-full md:w-auto bg-white text-black px-12 py-4 rounded-xl font-bold text-xs hover:bg-[#ccc] transition uppercase tracking-widest">
              {uploading ? 'Wait' : 'Distribute'}
            </button>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="pvis" className="rounded bg-black border-[#333]" />
            <label htmlFor="pvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">Initial Visibility: {isPublic ? 'Global' : 'Secret'}</label>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filesList.map(f => (
            <div key={f.id} className="group bg-[#080808] p-6 rounded-2xl border border-[#222] hover:border-white transition-all duration-500 relative">
              <div className="absolute top-4 right-4">
                <span className={`text-[8px] font-black px-2 py-1 rounded-full border uppercase tracking-widest ${f.is_public ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                  {f.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="flex justify-between items-start mb-6 pt-2">
                <div className="w-12 h-12 bg-[#111] border border-[#222] rounded-xl flex items-center justify-center text-[10px] font-bold uppercase group-hover:bg-white group-hover:text-black transition-all">
                  {f.file_name.split('.').pop()}
                </div>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="text-[#444] hover:text-white">💾</button>
                   {user.id === f.user_id && (
                     <>
                       <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`${f.is_public ? 'text-blue-500' : 'text-amber-500'} hover:scale-125 transition`}>
                         {f.is_public ? '🌐' : '🔒'}
                       </button>
                       <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="text-[#444] hover:text-red-500">🗑️</button>
                     </>
                   )}
                </div>
              </div>
              <h4 className="font-bold text-sm truncate mb-1">{f.file_name}</h4>
              <div className="flex items-center justify-between text-[10px] font-bold text-[#333] uppercase tracking-tighter">
                <span className="text-[#555]">{f.owner_