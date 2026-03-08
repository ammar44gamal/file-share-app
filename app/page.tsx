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

  // 1. Check for Session Token and load files
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchFiles();

    return () => subscription.unsubscribe();
  }, []);

  const fetchFiles = async () => {
    const { data } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });
    setFilesList(data || []);
  };

  // 2. Secure Login / Sign Up Logic with Unique Identity
  const handleAuth = async () => {
    if (isSignUp) {
      if (!username) return alert("Please choose a unique username.");
      
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert(error.message);
      
      if (data.user) {
        // Link the Unique Identity to the Auth User
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{ id: data.user.id, username: username }]);
        
        if (profileError) {
          alert("Account created, but username might be taken. You can update it later.");
        } else {
          alert("Registration successful! Please check your email to confirm.");
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert(error.message);
    }
  };

  // 3. Upload with Identity and Privacy Check
  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      const { error: storageError } = await supabase.storage
        .from('user-files')
        .upload(fileName, file);

      if (storageError) throw storageError;

      // Fetch the real username from your profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      // Fallback: If no profile exists, use the email prefix instead of "Unknown"
      const displayName = profile?.username || user.email.split('@')[0];

      const { error: dbError } = await supabase.from('files').insert([{ 
        file_name: file.name, 
        file_size: file.size, 
        storage_path: fileName,
        is_public: isPublic, 
        owner_username: displayName,
        user_id: user.id
      }]);

      if (dbError) throw dbError;

      setFile(null);
      fetchFiles();
      alert("Upload successful!");
    } catch (err) {
      console.error(err);
      alert("Upload failed. Check storage permissions.");
    } finally { 
      setUploading(false); 
    }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('user-files').download(path);
    if (error) return alert("Download failed");
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = name; 
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm("Delete this file permanently?")) return;
    try {
      await supabase.storage.from('user-files').remove([path]);
      await supabase.from('files').delete().eq('id', id);
      fetchFiles();
    } catch (err) {
      alert("Delete failed");
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">
            {isSignUp ? 'Create Account' : 'Secure Login'}
          </h2>
          {isSignUp && (
            <input 
              type="text" placeholder="Unique Username" 
              className="w-full p-3 mb-4 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" 
              onChange={e => setUsername(e.target.value)} 
            />
          )}
          <input 
            type="email" placeholder="Email Address" 
            className="w-full p-3 mb-4 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            type="password" placeholder="Password" 
            className="w-full p-3 mb-6 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none" 
            onChange={e => setPassword(e.target.value)} 
          />
          <button 
            onClick={handleAuth} 
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
          >
            {isSignUp ? 'Register' : 'Sign In'}
          </button>
          <p 
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-center mt-4 text-sm text-blue-500 cursor-pointer hover:underline"
          >
            {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-6 bg-gray-50 text-gray-900">
      <div className="w-full max-w-3xl flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border">
        <div>
          <h1 className="text-2xl font-black text-blue-600">FILE HUB PRO</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Distributed Node</p>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="bg-red-50 text-red-500 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100"
        >
          Logout
        </button>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md mb-10 border border-blue-100">
        <label className="block text-sm font-bold text-gray-700 mb-2">Select File</label>
        <input 
          type="file" onChange={e => setFile(e.target.files?.[0] || null)} 
          className="mb-6 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-blue-50 file:text-blue-700" 
        />
        
        <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <input 
            type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="privacy-toggle"
            className="w-5 h-5 rounded border-gray-300 text-blue-600" 
          />
          <label htmlFor="privacy-toggle" className="text-sm font-semibold text-gray-600 cursor-pointer">
            Make file public (everyone can see)
          </label>
        </div>

        <button 
          onClick={handleUpload} disabled={uploading || !file} 
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-200 shadow-md active:scale-95"
        >
          {uploading ? 'PROCESSING...' : 'UPLOAD TO SERVER'}
        </button>
      </div>

      <div className="w-full max-w-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">Global File Explorer</h3>
          <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-1 rounded">
            {filesList.length} FILES TOTAL
          </span>
        </div>

        <div className="grid gap-4">
          {filesList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400 italic">
              No accessible files found on the distributed storage.
            </div>
          ) : (
            filesList.map(f => (
              <div key={f.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 font-bold text-[10px]">
                    {f.file_name.split('.').pop()?.toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 flex items-center gap-2">
                      {f.file_name} 
                      {!f.is_public && <span className="text-xs" title="Private">🔒</span>}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      Owner: <span className="text-blue-500">{f.owner_username}</span> • {(f.file_size/1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownload(f.storage_path, f.file_name)} 
                    className="text-blue-600 text-xs font-black px-4 py-2 hover:bg-blue-50 rounded-lg"
                  >
                    DOWNLOAD
                  </button>
                  {user.id === f.user_id && (
                    <button 
                      onClick={() => handleDelete(f.id, f.storage_path)} 
                      className="text-red-500 text-xs font-black px-4 py-2 hover:bg-red-50 rounded-lg"
                    >
                      DELETE
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}