// ... keep your imports ...

export default function DistributedFileHub() {
  // New States
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Fetch folders along with files
  const fetchFolders = async () => {
    const { data } = await supabase.from('folders').select('*').order('name');
    setFolders(data || []);
  };

  const createFolder = async () => {
    if (!newFolderName) return;
    await supabase.from('folders').insert([{ name: newFolderName, user_id: user.id }]);
    setNewFolderName('');
    fetchFolders();
  };

  // Modify fetchFiles to filter by folder if needed
  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false });
    if (selectedFolder) query = query.eq('folder_id', selectedFolder);
    const { data } = await query;
    setFilesList(data || []);
  };

  useEffect(() => {
    if (user) {
      fetchFolders();
      fetchFiles();
    }
  }, [user, selectedFolder]);

  // ... (Keep handleUpload but add folder_id: selectedFolder to the insert) ...

  if (!user) { /* Keep your existing Login UI */ }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">F</div>
          <h1 className="font-black text-xl tracking-tight text-slate-800">FileHub</h1>
        </div>

        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setSelectedFolder(null)}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition ${!selectedFolder ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            All Files
          </button>
          
          <div className="pt-4 pb-2 underline uppercase text-[10px] font-black text-slate-400 tracking-widest">My Folders</div>
          {folders.map(folder => (
            <button 
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition ${selectedFolder === folder.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              📁 {folder.name}
            </button>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t">
          <input 
            type="text" 
            placeholder="New folder..." 
            className="w-full text-xs p-2 border rounded-lg mb-2"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
          />
          <button onClick={createFolder} className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-black transition">
            + Create Folder
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-10">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-black text-slate-800">
              {selectedFolder ? folders.find(f => f.id === selectedFolder)?.name : 'Dashboard'}
            </h2>
            <p className="text-slate-400 text-sm font-medium">Manage your distributed storage nodes</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="px-5 py-2 border border-slate-200 rounded-full text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all">
            Log out
          </button>
        </header>

        {/* Upload Action Area */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Upload New Assets</h3>
              <p className="text-blue-100 text-sm mb-6 max-w-xs">Files uploaded here are distributed across our encrypted storage network.</p>
              <input 
                type="file" 
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-white file:text-blue-700 hover:file:bg-blue-50 cursor-pointer"
              />
              <div className="mt-6 flex items-center gap-4">
                 <button 
                  onClick={handleUpload} 
                  disabled={uploading || !file}
                  className="bg-white text-blue-700 px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {uploading ? 'Transmitting...' : 'Upload Now'}
                </button>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded border-none text-blue-500 focus:ring-0" />
                  Public Visibility
                </label>
              </div>
            </div>
            {/* Background Decorative Circles */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
             <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4">
               <span className="text-2xl">📊</span>
             </div>
             <div className="text-2xl font-black text-slate-800">{filesList.length}</div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Files Hosted</div>
          </div>
        </section>

        {/* Files Grid */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filesList.map(f => (
              <div key={f.id} className="group bg-white p-5 rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    {f.file_name.split('.').pop()?.toUpperCase()}
                  </div>
                  <div className="flex gap-1">
                     <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="p-2 hover:bg-blue-50 rounded-xl text-blue-600 transition-colors">💾</button>
                     {user.id === f.user_id && <button onClick={() => handleDelete(f.id, f.storage_path)} className="p-2 hover:bg-red-50 rounded-xl text-red-500 transition-colors">🗑️</button>}
                  </div>
                </div>
                <h4 className="font-bold text-slate-700 truncate mb-1">{f.file_name}</h4>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                  <span>{f.owner_username}</span>
                  <span>•</span>
                  <span>{(f.file_size/1024).toFixed(1)} KB</span>
                  {!f.is_public && <span className="ml-auto">🔒 Private</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}