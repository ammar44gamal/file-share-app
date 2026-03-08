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

  // 1. Check for Session Token on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    const { data } = await supabase.from('files').select('*').order('created_at', { ascending: false });
    setFilesList(data || []);
  };

  // 2. Secure Login / Sign Up Logic
  const handleAuth = async () => {
    if (isSignUp) {
      // Create user + unique username in profiles
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert(error.message);
      if (data.user) {
        await supabase.from('profiles').insert([{ id: data.user.id, username }]);
        alert("Check your email for confirmation!");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert(error.message);
      window.location.reload(); // Refresh to update session
    }
  };

  // 3. Upload with Privacy Choice
  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('user-files').upload(fileName, file);

      // Get user's username from profiles
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();

      await supabase.from('files').insert([{ 
        file_name: file.name, 
        file_size: file.size, 
        storage_path: fileName,
        is_public: isPublic,
        owner_username: profile?.username || 'Anonymous',
        user_id: user.id
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
    if (!confirm("Delete this file?")) return;
    await supabase.storage.from('user-files').remove([path]);
    await supabase.from('files').delete().eq('id', id);
    fetchFiles();
  };

  // --- UI RENDER ---
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">{isSignUp ? 'Create Account' : 'Secure Login'}</h2>
          {isSignUp && (
            <input type="text" placeholder="Unique Username" className="w-full p-3 mb-4 border rounded-lg" onChange={e => setUsername(e.target.value)} />
          )}
          <input type="email" placeholder="Email" className="w-full p-3 mb-4 border rounded-lg" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" className="w-full p-3 mb-6 border rounded-lg" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition mb-4">
            {isSignUp ? 'Sign Up' : 'Login'}
          </button>
          <p onClick={() => setIsSignUp(!isSignUp)} className="text-center text-sm text-blue-500 cursor-pointer hover:underline">
            {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-6 bg-gray-50">
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-blue-600">FILE HUB PRO</h1>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-sm font-bold text-red-500">Logout</button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md mb-10 border">
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="mb-4 w-full text-sm" />
        <div className="flex items-center gap-2 mb-6">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} id="privacy" />
          <label htmlFor="privacy" className="text-sm font-medium text-gray-600">Make this file public (visible to everyone)</label>
        </div>
        <button onClick={handleUpload} disabled={uploading || !file} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-200">
          {uploading ? 'UPLOADING...' : 'UPLOAD FILE'}
        </button>
      </div>

      <div className="w-full max-w-2xl space-y-4">
        <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Distributed Explorer</h3>
        {filesList.map(f => (
          <div key={f.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-800">{f.file_name} {!f.is_public && '🔒'}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Owner: {f.owner_username} • {(f.file_size/1024).toFixed(1)} KB</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleDownload(f.storage_path, f.file_name)} className="text-blue-600 text-sm font-bold px-3 py-1 hover:bg-blue-50 rounded">Download</button>
              {user.id === f.user_id && (
                <button onClick={() => handleDelete(f.id, f.storage_path)} className="text-red-500 text-sm font-bold px-3 py-1 hover:bg-red-50 rounded">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}