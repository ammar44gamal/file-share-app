// ... (Keep all your imports and initial states the same)

  // 1. Updated Fetch Folders: Admin sees EVERYTHING
  const fetchFolders = async () => {
    let query = supabase.from('folders').select('*').order('name');
    
    // If NOT admin, only show public folders or folders they own
    if (!isAdmin) {
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    }
    
    const { data } = await query;
    setFolders(data || []);
  };

  // 2. Updated Fetch Files: Admin sees hidden/private files
  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false });
    
    if (selectedFolder) {
      query = query.eq('folder_id', selectedFolder);
    } else {
      query = query.is('folder_id', null);
    }

    // If NOT admin, filter out private files that don't belong to them
    if (!isAdmin) {
      query = query.or(`is_public.eq.true,user_id.eq.${user.id}`);
    }

    const { data } = await query;
    setFilesList(data || []);
  };

  // ... (Keep handleUpload and handleDownload the same)

  // 3. Logic Check: Can the user manage this folder/file?
  const currentFolder = folders.find(f => f.id === selectedFolder);
  
  // ADMIN OVERRIDE: Admin is always considered the "Owner" for permissions
  const canManageFolder = currentFolder?.user_id === user?.id || isAdmin;
  const isLockedForUser = currentFolder?.is_locked && !isAdmin;

  // ... Inside the return JSX ...

  // Requirement: Admin can upload even if locked
  {(!isLockedForUser) ? (
      <section className="bg-[#111] border border-[#333] rounded-2xl p-10 mb-16 shadow-2xl">
          {/* Upload UI remains the same */}
      </section>
  ) : (
      <div className="bg-amber-500/10 border border-amber-900/30 p-8 rounded-2xl mb-16 text-center">
          <p className="text-amber-500 text-sm font-bold uppercase tracking-widest">
             Node Locked by {currentFolder?.owner_username}.
          </p>
      </div>
  )}

  // Requirement: Admin can delete any folder
  {folders.map(folder => (
    <button key={folder.id} className="...">
      <span>📂 {folder.name}</span>
      {(folder.user_id === user.id || isAdmin) && (
        <span onClick={(e) => handleFolderDelete(e, folder.id)} className="text-[10px] hover:text-red-500">✕</span>
      )}
    </button>
  ))}

  // Requirement: Admin can delete any file
  <div className="grid ...">
    {filesList.map(f => (
      <div key={f.id} className="...">
          {/* File UI */}
          <div className="mt-auto pt-4 border-t border-[#222] flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="...">💾</button>
              
              {/* ADMIN OVERRIDE for File Actions */}
              {(user.id === f.user_id || canManageFolder) && (
                  <>
                      <button onClick={() => toggleFilePrivacy(f.id, f.is_public)} className="...">
                        {f.is_public ? '🌐' : '🔒'}
                      </button>
                      <button onClick={() => handleDeleteFile(f.id, f.storage_path)} className="...">🗑️</button>
                  </>
              )}
          </div>
      </div>
    ))}
  </div>