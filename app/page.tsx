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

  // Identity & Admin Management States
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
    
    // MASTER ADMIN RULE: Force Admin rights for the root account
    const isMasterEmail = currentUser?.email === 'Admin@gmail.com';
    
    if (data) {
      setProfileName(data.username);
      setIsAdmin(data.is_admin || isMasterEmail); 
    } else if (isMasterEmail) {
      setIsAdmin(true);
    }
  };

  const fetchAdminStats = async () => {
    // Fetches from the secure admin view
    const { data } = await supabase.from('admin_user_stats').select('*');
    setAdminUserList(data || []);
  };

  const promoteUser = async (targetId: string) => {
    const { error } = await supabase.from('profiles').update({ is_admin: true }).eq('id', targetId);
    if (!error) fetchAdminStats();
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
    if (!confirm("Delete folder and all associated data blocks?")) return;
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
    else alert("Password updated successfully!");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black p-6">
        <div className="bg-[#111] border border-[#333] p-12 rounded-[2.5rem] shadow-2xl w-full max-w-sm">
          <h2 className="text-3xl font-bold mb-10 text-center text-white tracking-tighter italic">FileHub Access</h2>
          {isSignUp && (
            <input type="text" placeholder="Username" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none font-bold" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-4 mb-4 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none font-bold" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-4 mb-10 bg-black border border-[#333] text-white rounded-xl focus:border-white outline-none font-bold" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-[#ccc] transition uppercase tracking-[0.2em] text-[10px]">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center mt-8 text-[10px] text-[#444] font-black uppercase tracking-widest cursor-pointer hover:text-white transition">
            {isSignUp ? 'Return to Login' : 'Create Account'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* SIDEBAR */}
      <aside className="w-80 bg-black border-r border-[#222] p-10 flex flex-col shadow-2xl">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-black text-xl">F</div>
          <h1 className="font-bold text-2xl tracking-tighter italic">FileHub</h1>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto">
          <button onClick={() => {setSelectedFolder(null); setViewingAdminPanel(false);}} className={`w-full text-left px-6 py-4 rounded-[1.25rem] text-sm font-bold transition-all ${!selectedFolder && !viewingAdminPanel ? 'bg-[#111] border border-[#333] text-white' : 'text-[#444] hover:text-white'}`}>
            Global Dashboard
          </button>
          
          {isAdmin && (
            <button onClick={() => setViewingAdminPanel(true)} className={`w-full text-left px-6 py-4 rounded-[1.25rem] text-sm font-black transition-all mt-6 ${viewingAdminPanel ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/20' : 'text-blue-500 hover:text-blue-400 border border-blue-900/30'}`}>
              🛠️ Admin Control
            </button>
          )}

          <div className="pt-12 pb-4 text-[10px] font-black text-[#222] uppercase tracking-[0.4em]">Collections</div>
          {folders.map(folder => (
            <div key={folder.id} className="group relative">
              <button onClick={() => {setSelectedFolder(folder.id); setViewingAdminPanel(false);}} className={`w-full text-left px-6 py-4 rounded-[1.25rem] text-sm flex items-center justify-between transition-all ${selectedFolder === folder.id ? 'text-white font-black bg-[#111]' : 'text-[#444] hover:text-white hover:bg-[#080808]'}`}>
                <div className="flex items-center gap-3">
                  <span>📁</span>
                  <span className="truncate w-32">{folder.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${folder.is_public ? 'bg-green-500' : 'bg-amber-500'}`} title={folder.is_public ? "Public Group" : "Private Group"}></span>
                  {user.id === folder.user_id && (
                    <span onClick={(e) => handleFolderDelete(e, folder.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 cursor-pointer text-base">🗑️</span>
                  )}
                </div>
              </button>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-[#222]">
          <input type="text" placeholder="Folder name..." className="w-full text-xs p-4 bg-black border border-[#333] rounded-2xl mb-4 outline-none focus:border-white font-bold" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
          <div className="flex items-center gap-3 mb-6 px-1">
            <input type="checkbox" checked={folderIsPublic} onChange={e => setFolderIsPublic(e.target.checked)} id="fvis" className="w-4 h-4 rounded bg-black border-[#333] text-white focus:ring-0" />
            <label htmlFor="fvis" className="text-[10px] font-black text-[#444] uppercase tracking-widest cursor-pointer underline">Public Group</label>
          </div>
          <button onClick={createFolder} className="w-full py-4 bg-white text-black text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-[#ccc] transition shadow-lg shadow-white/5">Create</button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 overflow-y-auto p-20 relative">
        {/* IDENTITY MENU */}
        <div className="absolute top-12 right-12 z-50">
          <button onClick={() => setShowAccountMenu(!showAccountMenu)} className="w-12 h-12 rounded-full border border-[#333] bg-[#111] flex items-center justify-center hover:border-white transition-all overflow-hidden shadow-2xl">
            <span className="text-sm font-black">{profileName[0]?.toUpperCase()}</span>
          </button>

          {showAccountMenu && (
            <div className="absolute right-0 mt-6 w-72 bg-[#111] border border-[#333] rounded-[2rem] shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center text-black text-3xl font-black mb-6 shadow-xl">{profileName[0]?.toUpperCase()}</div>
              <h3 className="text-xl font-bold text-white mb-1">Hi, {profileName}!</h3>
              {isAdmin && <span className="text-[9px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">Network Administrator</span>}
              <p className="text-[10px] text-[#444] font-black uppercase tracking-[0.2em] mt-4 mb-8 truncate px-2">{user.email}</p>
              
              <div className="space-y-3">
                <button onClick={handleChangePassword} className="w-full py-3.5 text-[10px] font-black uppercase tracking-widest border border-[#222] rounded-2xl hover:bg-[#1a1a1a] transition">Change Password</button>
                <div className="pt-4 mt-2">
                  <button onClick={handleLogout} className="w-full py-3.5 text-[10px] font-black uppercase tracking-widest bg-red-600/10 text-red-500 border border-red-900/20 rounded-2xl hover:bg-red-600/20 transition">Log Out</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {viewingAdminPanel ? (
          /* ADMIN PANEL */
          <div className="animate-in slide-in-from-bottom-6 duration-700">
            <header className="mb-20">
              <h2 className="text-5xl font-black tracking-tighter text-blue-500 italic">Network Administration</h2>
              <p className="text-[#333] text-[11px] font-black uppercase tracking-[0.4em] mt-3 italic">Global Identity Node Control</p>
            </header>
            
            <div className="bg-[#050505] border border-[#151515] rounded-[3rem] overflow-hidden shadow-2xl">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#0a0a0a] text-[#444] uppercase tracking-[0.3em] font-black border-b border-[#151515]">
                  <tr>
                    <th className="p-8">Identity</th>
                    <th className="p-8">Channel</th>
                    <th className="p-8">Privilege</th>
                    <th className="p-8">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]">
                  {adminUserList.map(u => (
                    <tr key={u.id} className="hover:bg-[#080808] transition duration-300">
                      <td className="p-8 font-black text-white">{u.username}</td>
                      <td className="p-8 text-[#555] font-bold">{u.email}</td>
                      <td className="p-8 uppercase text-[10px] font-black tracking-widest">
                        {u.is_admin ? <span className="text-blue-500">Administrator</span> : <span className="text-[#222]">Standard Node</span>}
                      </td>
                      <td className="p-8">
                        {!u.is_admin && (
                          <button onClick={() => promoteUser(u.id)} className="px-6 py-3 bg-white text-black text-[10px] font-black rounded-xl uppercase tracking-widest hover:scale-105 transition shadow-lg">Promote</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* STANDARD DASHBOARD */
          <>
            <header className="mb-20">
              <h2 className="text-6xl font-black tracking-tighter">
                {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Root Explorer'}
              </h2>
              <p className="text-[#333] text-[11px] font-black uppercase tracking-[0.4em] mt-4 italic">Distributed Architecture Node v4.5</p>
            </header>

            <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[3rem] p-16 mb-24 shadow-2xl relative overflow-hidden group">
              <h3 className="text-2xl font-black mb-3">Distribute Assets</h3>
              <p className="text-[#444] text-xs mb-12 font-bold max-w-sm italic opacity-70">Replicating metadata blocks across the cluster node.</p>
              
              <div className="flex flex-col lg:flex-row items-center gap-10">
                <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-xs text-[#444] file:mr-10 file:py-4 file:px-10 file:rounded-2xl file:border file:border-[#222] file:bg-black file:text-white hover:file:bg-[#111] cursor-pointer font-black uppercase tracking-widest transition-all" />
                <button onClick={handleUpload} disabled={uploading || !file} className="w-full lg:w-auto bg-white text-black px-16 py-5 rounded-2xl font-black text-xs hover:scale-105 transition shadow-2xl disabled:opacity-20 uppercase tracking-[0.3em]">
                  {uploading ? 'Transmitting' : 'Deploy'}
                </button>
              </div>
              <div className="mt-12 flex items-center gap-4">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="pvis" className="w-6 h-6 rounded-lg bg-black border-[#333] text-white focus:ring-0" />
                <label htmlFor="pvis" className="text-[11px] font-black text-[#444] uppercase tracking-[0.2em] cursor-pointer hover:text-white transition">Global Visibility Node: {isPublic ? 'Active' : 'Secret'}</label>
              </div>
              <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-[120px] group-hover:scale-125 transition-all duration-1000"></div>
            </section>

            {/* EXPLORER GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
              {filesList.map(f => (
                <div key={f.id} className="group bg-[#050505] p-10 rounded-[2.5rem] border border-[#151515] hover:border-[#444] transition-all duration-700 relative hover:shadow-[0_40px_80px_-20px_rgba(255,255,255,0.05)]">
                  <div className="absolute top-6 right-6">
                    <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border uppercase tracking-[0.2em] ${f.is_public ? 'bg-green-600/10 text-green-500 border-green-600/20' : 'bg-amber-600/10 text-amber-500 border-amber-600/20'}`}>
                      {f.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-10 pt-4">
                    <div className="w-16 h-16 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[1.5rem] flex items-center justify-center text-[11px] font-black uppercase group-hover:bg-white group-hover:text-black transition-all duration-500 italic">
                      {f.file_name.split('.').pop()}
                    </div>
                    <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                       <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="text-[#333] hover:text-white transition transform hover:scale-125">💾</button>
                       {user.id === f.user_id && (
                         <>
                           <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className={`${f.is_public ? 'text-blue-900' : 'text-amber-900'} hover:text-white transition transform hover:scale-125`} title={f.is_public ? "Hide" : "Share"}>
                             {f.is_public ? '🌐' : '🔒'}
                           </button>
                           <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="text-[#222] hover:text-red-500 transition transform hover:scale-125">🗑️</button>
                         </>
                       )}
                    </div>
                  </div>
                  <h4 className="font-black text-base truncate mb-2 text-white pr-4">{f.file_name}</h4>
                  <div className="flex items-center justify-between text-[10px] font-black text-[#222] uppercase tracking-tighter">
                    <span className="text-[#444]">{f.owner_username}</span>
                    <span>{(f.file_size/1024).toFixed(1)} KB</span>
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