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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchFiles();
    }
  }, [user, selectedFolder]);

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

  // --- NEW: Toggle Visibility logic ---
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

  // --- DARK MODE LOGIN FIX ---
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        <div className="bg-[#111] border border-[#333] p-12 rounded-[2rem] shadow-2xl w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tighter">FileHub Auth</h2>
          {isSignUp && (
            <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none font-medium" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none font-medium" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-8 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none font-medium" onChange={e => setPassword(e.target.value)} />
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
      {/* SIDEBAR */}
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
                <span className="truncate pr-4">📂 {folder.name}</span>
                <div className="flex items-center gap-2">
                  {!folder.is_public && <span className="text-[10px]">🔒</span>}
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
            <label htmlFor="fvis" className="text-[9px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">Public Group</label>
          </div>
          <button onClick={createFolder} className="w-full py-3 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-[#ccc]">Create</button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 overflow-y-auto p-16">
        <header className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-4xl font-bold tracking-tighter">
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Root Directory'}
            </h2>
            <p className="text-[#444] text-[10px] font-bold uppercase tracking-[0.3em] mt-2 italic">Node v4.5 Active</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="px-6 py-2 border border-[#333] rounded-lg text-[10px] font-bold text-[#888] hover:text-white transition uppercase">Logout</button>
        </header>

        {/* UPLOAD HERO */}
        <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2.5rem] p-12 mb-20 shadow-2xl">
          <h3 className="text-lg font-bold mb-2">Deploy to {selectedFolder ? 'Group' : 'Root'}</h3>
          <p className="text-[#444] text-xs mb-10 font-medium">Replicating metadata across distributed nodes.</p>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#444] file:mr-6 file:py-2.5 file:px-8 file:rounded-lg file:border file:border-[#222] file:bg-black file:text-white hover:file:bg-[#111] cursor-pointer" />
            <button onClick={handleUpload} disabled={uploading || !file} className="w-full md:w-auto bg-white text-black px-12 py-4 rounded-xl font-bold text-xs hover:bg-[#ccc] transition uppercase tracking-widest disabled:opacity-20">
              {uploading ? 'Wait' : 'Distribute'}
            </button>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="pvis" className="rounded bg-black border-[#333]" />
            <label htmlFor="pvis" className="text-[10px] font-bold text-[#444] uppercase tracking-widest cursor-pointer">Initial Visibility: {isPublic ? 'Global' : 'Secret'}</label>
          </div>
        </section>

        {/* EXPLORER GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filesList.map(f => (
            <div key={f.id} className="group bg-[#050505] p-6 rounded-2xl border border-[#151515] hover:border-[#444] transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-[#111] border border-[#222] rounded-xl flex items-center justify-center text-[10px] font-bold uppercase group-hover:bg-white group-hover:text-black transition-all italic">
                  {f.file_name.split('.').pop()}
                </div>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="text-[#444] hover:text-white">💾</button>
                   {user.id === f.user_id && (
                     <>
                       {/* VISIBILITY TOGGLE BUTTON */}
                       <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className="text-[#444] hover:text-blue-400 transition" title={f.is_public ? "Hide" : "Share"}>
                         {f.is_public ? '🌐' : '🔒'}
                       </button>
                       <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="text-[#444] hover:text-red-500">🗑️</button>
                     </>
                   )}
                </div>
              </div>
              <h4 className="font-bold text-sm truncate mb-1">{f.file_name}</h4>
              <div className="flex items-center justify-between text-[9px] font-bold text-[#333] uppercase tracking-tighter">
                <span className="text-[#555]">{f.owner_username}</span>
                <div className="flex items-center gap-2">
                  <span>{(f.file_size/1024).toFixed(1)} KB</span>
                  {!f.is_public && <span className="text-amber-500">🔒</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}