'use client';

// FIX: Added explicit imports for React hooks to prevent build errors
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

  // Folder Logic States
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // 1. Initial Identity & Session Check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Data based on Identity and Selection
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
    // Logical Filter: Only show files in the selected folder node
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

  // 3. Auth & Identity Logic
  const handleAuth = async () => {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert(error.message);
      if (data.user) {
        // Link unique identity to auth node
        await supabase.from('profiles').insert([{ id: data.user.id, username }]);
        alert("Registration success! Check your email.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert(error.message);
    }
  };

  // 4. Secure File Upload Logic
  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(fileName, file);

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      const displayName = profile?.username || user.email.split('@')[0];

      await supabase.from('files').insert([{ 
        file_name: file.name, 
        file_size: file.size, 
        storage_path: fileName,
        is_public: isPublic, 
        owner_username: displayName,
        user_id: user.id,
        folder_id: selectedFolder // Links file to current logical group
      }]);

      setFile(null);
      fetchFiles();
    } catch (err) {
      alert("Upload failed. Check storage node permissions.");
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

  // --- MODERN LOGIN UI ---
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-md border border-slate-100">
          <h2 className="text-4xl font-black mb-10 text-center text-slate-800 tracking-tighter italic">
            {isSignUp ? 'Join Hub' : 'Secure Login'}
          </h2>
          {isSignUp && (
            <input type="text" placeholder="Unique Username" className="w-full p-4 mb-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-10 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest">
            {isSignUp ? 'Register' : 'Enter Hub'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-8 text-xs font-black text-slate-300 cursor-pointer hover:text-blue-500 uppercase tracking-widest">
            {isSignUp ? 'Back to Login' : 'Need Access? Sign Up'}
          </p>
        </div>
      </div>
    );
  }

  // --- MODERN DASHBOARD UI ---
  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 p-10 flex flex-col shadow-sm">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-12 h-12 bg-blue-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-blue-100">F</div>
          <h1 className="font-black text-3xl tracking-tighter text-slate-800 italic">FileHub</h1>
        </div>

        <nav className="flex-1 space-y-3">
          <button onClick={() => setSelectedFolder(null)} className={`w-full text-left px-6 py-4 rounded-[1.5rem] text-sm font-black transition-all ${!selectedFolder ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>
            🏠 Dashboard
          </button>
          <div className="pt-10 pb-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Logical Groups</div>
          <div className="space-y-2 overflow-y-auto max-h-64 pr-2">
            {folders.map(folder => (
              <button key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`w-full text-left px-6 py-4 rounded-[1.5rem] text-sm font-black transition-all ${selectedFolder === folder.id ? 'bg-blue-50 text-blue-600 border-l-8 border-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                📁 {folder.name}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-auto pt-8 border-t border-slate-100">
          <input type="text" placeholder="Folder name..." className="w-full text-xs p-4 bg-slate-50 border-none rounded-2xl mb-4 focus:ring-1 focus:ring-blue-400 outline-none font-bold" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <button onClick={createFolder} className="w-full py-4 bg-slate-900 text-white text-[10px] font-black rounded-2xl hover:bg-black transition shadow-lg uppercase tracking-widest">
            + New Folder
          </button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 overflow-y-auto p-16">
        <header className="flex justify-between items-start mb-16">
          <div>
            <h2 className="text-5xl font-black text-slate-800 tracking-tighter">
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Dashboard'}
            </h2>
            <p className="text-slate-300 font-bold mt-2 uppercase text-[10px] tracking-widest italic">Distributed Computing Node v3.0</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="px-8 py-3 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all uppercase tracking-widest">
            Exit System
          </button>
        </header>

        {/* UPLOAD HERO */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 mb-20">
          <div className="xl:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[3rem] p-12 text-white shadow-[0_35px_60px_-15px_rgba(37,99,235,0.3)] relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="text-3xl font-black mb-4">Transfer Assets</h3>
              <p className="text-blue-100 text-sm mb-10 max-w-sm font-medium opacity-70">Inject files into the encrypted storage network. Privacy defaults to restricted.</p>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-blue-100 file:mr-8 file:py-4 file:px-10 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-white file:text-blue-700 hover:file:scale-105 file:transition-all cursor-pointer uppercase tracking-widest" />
                <button onClick={handleUpload} disabled={uploading || !file} className="w-full md:w-auto bg-slate-900 text-white px-12 py-5 rounded-3xl font-black text-xs hover:scale-105 transition-all shadow-2xl disabled:opacity-50 uppercase tracking-widest">
                  {uploading ? 'Processing' : 'Distribute'}
                </button>
              </div>
              <div className="mt-10 flex items-center gap-4">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="p-toggle" className="w-6 h-6 rounded-xl border-none text-blue-500 focus:ring-0" />
                <label htmlFor="p-toggle" className="text-[10px] font-black text-blue-50 cursor-pointer uppercase tracking-widest">Global Visibility: {isPublic ? 'Active' : 'Private Mode'}</label>
              </div>
            </div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-white/5 rounded-full blur-[120px] group-hover:scale-125 transition-all duration-1000"></div>
          </div>

          <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
             <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center text-4xl mb-8 shadow-inner italic font-black text-blue-600">i</div>
             <div className="text-5xl font-black text-slate-800">{filesList.length}</div>
             <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mt-3">Active Blobs</div>
          </div>
        </div>

        {/* EXPLORER GRID */}
        <section>
          <div className="flex items-center justify-between mb-10 border-b border-slate-100 pb-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Network Explorer</h3>
            <span className="text-[10px] font-black text-slate-300 italic">Listing encrypted objects...</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-10">
            {filesList.length === 0 ? (
              <div className="col-span-full py-40 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100 text-slate-200 font-black italic uppercase tracking-widest">
                Distributed Storage Empty
              </div>
            ) : (
              filesList.map(f => (
                <div key={f.id} className="group bg-white p-8 rounded-[2.5rem] border border-slate-100 hover:border-blue-100 hover:shadow-[0_40px_80px_-20px_rgba(59,130,246,0.15)] transition-all duration-700">
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-blue-600 font-black text-[11px] group-hover:bg-blue-600 group-hover:text-white transition-all duration-700 shadow-sm uppercase italic">
                      {f.file_name.split('.').pop()}
                    </div>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                       <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="p-4 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm">💾</button>
                       {user.id === f.user_id && <button onClick={() => handleDelete(f.id, f.storage_path)} className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">🗑️</button>}
                    </div>
                  </div>
                  <h4 className="font-black text-slate-700 truncate mb-2 pr-6 tracking-tight">{f.file_name}</h4>
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    <span className="text-blue-400">{f.owner_username}</span>
                    <span>•</span>
                    <span>{(f.file_size/1024).toFixed(1)} KB</span>
                    {!f.is_public && <span className="ml-auto text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">🔒 Secret</span>}
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