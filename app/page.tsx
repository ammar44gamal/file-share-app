'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function DistributedFileHub() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filesList, setFilesList] = useState<any[]>([]);

  // Folder Logic
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
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
    const { data } = await query;
    setFilesList(data || []);
  };

  const createFolder = async () => {
    if (!newFolderName) return;
    await supabase.from('folders').insert([{ name: newFolderName, user_id: user.id }]);
    setNewFolderName('');
    fetchFolders();
  };

  const handleAuth = async () => {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert(error.message);
      if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, username }]);
        alert("Success! Check your email.");
      }
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

  const handleDelete = async (id: string, path: string) => {
    if (!confirm("Delete permanently?")) return;
    await supabase.storage.from('user-files').remove([path]);
    await supabase.from('files').delete().eq('id', id);
    fetchFiles();
  };

  // --- VERCEL STYLE DARK LOGIN ---
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        <div className="bg-[#111] border border-[#333] p-10 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black font-black text-2xl">F</div>
          </div>
          <h2 className="text-2xl font-bold mb-8 text-center text-white tracking-tight">
            {isSignUp ? 'Create an account' : 'Log in to FileHub'}
          </h2>
          {isSignUp && (
            <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none transition" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none transition" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-8 bg-black border border-[#333] text-white rounded-lg focus:border-white outline-none transition" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-lg font-bold hover:bg-[#ccc] transition uppercase tracking-widest text-xs">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-6 text-sm text-[#888] cursor-pointer hover:text-white transition">
            {isSignUp ? 'Already have an account?' : 'Don’t have an account? Sign up'}
          </p>
        </div>
      </div>
    );
  }

  // --- VERCEL STYLE DASHBOARD ---
  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-blue-500">
      {/* SIDEBAR */}
      <aside className="w-64 bg-black border-r border-[#222] p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center text-black font-black">F</div>
          <h1 className="font-bold text-lg tracking-tight">FileHub</h1>
        </div>

        <nav className="flex-1 space-y-1">
          <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all ${!selectedFolder ? 'bg-[#111] text-white border border-[#333]' : 'text-[#888] hover:text-white'}`}>
            Overview
          </button>
          <div className="pt-6 pb-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">Collections</div>
          {folders.map(folder => (
            <button key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all ${selectedFolder === folder.id ? 'text-white font-bold' : 'text-[#888] hover:text-white'}`}>
              📂 {folder.name}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-[#222]">
          <input type="text" placeholder="Folder name" className="w-full text-xs p-3 bg-[#111] border border-[#333] rounded-lg mb-2 focus:border-[#888] outline-none text-white" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <button onClick={createFolder} className="w-full py-2.5 bg-white text-black text-[10px] font-bold rounded-lg hover:bg-[#ccc] transition uppercase">
            New Folder
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-12">
        <header className="flex justify-between items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Dashboard'}
            </h2>
            <p className="text-[#888] text-sm mt-1 font-medium">Distributed Storage Node <span className="text-[#444] italic">v4.0</span></p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="px-4 py-2 border border-[#333] rounded-lg text-[10px] font-bold text-[#888] hover:text-white hover:border-[#888] transition uppercase">
            Exit
          </button>
        </header>

        {/* VERCEL STYLE UPLOAD AREA */}
        <section className="bg-[#111] border border-[#333] rounded-2xl p-10 mb-16 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-lg">
            <h3 className="text-xl font-bold mb-4">Deploy New Assets</h3>
            <p className="text-[#888] text-sm mb-8 leading-relaxed font-medium">Upload files to your distributed node. Privacy and encryption are enforced via Row-Level Security.</p>
            
            <div className="flex flex-col md:flex-row items-center gap-6">
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#888] file:mr-6 file:py-2.5 file:px-6 file:rounded-lg file:border file:border-[#333] file:text-[10px] file:font-bold file:bg-black file:text-white hover:file:bg-[#111] cursor-pointer" />
              <button onClick={handleUpload} disabled={uploading || !file} className="w-full md:w-auto bg-white text-black px-10 py-3 rounded-lg font-bold text-xs hover:bg-[#ccc] transition shadow-lg disabled:opacity-30 uppercase tracking-widest">
                {uploading ? 'Processing' : 'Distribute'}
              </button>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="vis" className="w-4 h-4 rounded bg-black border-[#333] text-white focus:ring-0" />
              <label htmlFor="vis" className="text-[10px] font-bold text-[#888] cursor-pointer uppercase tracking-widest">Public Visibility: {isPublic ? 'Enabled' : 'Restricted'}</label>
            </div>
          </div>
        </section>

        {/* GRID EXPLORER */}
        <section>
          <div className="flex items-center gap-3 mb-8 border-b border-[#222] pb-4">
            <h3 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em]">Node Explorer</h3>
            <span className="text-[10px] bg-[#111] border border-[#222] px-2 py-0.5 rounded text-[#888] font-bold">{filesList.length} Objects</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filesList.length === 0 ? (
              <div className="col-span-full py-32 text-center text-[#444] font-medium border border-[#222] border-dashed rounded-2xl uppercase text-[10px] tracking-widest">
                No accessible data blocks found.
              </div>
            ) : (
              filesList.map(f => (
                <div key={f.id} className="group bg-[#080808] p-6 rounded-xl border border-[#222] hover:border-[#888] transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-[#111] border border-[#222] rounded-lg flex items-center justify-center text-white font-bold text-[10px] uppercase">
                      {f.file_name.split('.').pop()}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="text-[#888] hover:text-white transition">💾</button>
                       {user.id === f.user_id && <button onClick={() => handleDelete(f.id, f.storage_path)} className="text-[#444] hover:text-red-500 transition">🗑️</button>}
                    </div>
                  </div>
                  <h4 className="font-bold text-white truncate mb-2 text-sm">{f.file_name}</h4>
                  <div className="flex items-center justify-between text-[10px] font-bold text-[#444] uppercase tracking-tighter">
                    <span className="text-[#888]">{f.owner_username}</span>
                    <div className="flex items-center gap-2">
                      <span>{(f.file_size/1024).toFixed(1)} KB</span>
                      {!f.is_public && <span className="text-amber-500 font-black">🔒</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}