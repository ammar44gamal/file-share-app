'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function FileSharePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filesList, setFilesList] = useState<any[]>([]);

  // 1. Fetch files from the distributed database
  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching files:', error);
    } else {
      setFilesList(data || []);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // 2. Handle File Upload (Centralized Storage)
  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      let { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Log metadata in Postgres
      const { error: dbError } = await supabase
        .from('files')
        .insert([{ 
          file_name: file.name, 
          file_type: file.type, 
          file_size: file.size, 
          storage_path: filePath 
        }]);

      if (dbError) throw dbError;

      setFile(null);
      fetchFiles(); 
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed!');
    } finally {
      setUploading(false);
    }
  };

  // 3. Handle File Download
  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .download(storagePath);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Download error');
    }
  };

  // 4. Phase 5: Handle File Deletion (Storage + DB)
  const handleDelete = async (id: string, storagePath: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      // Remove from Storage
      await supabase.storage.from('user-files').remove([storagePath]);
      // Remove from Database
      await supabase.from('files').delete().eq('id', id);

      fetchFiles(); // Refresh UI
    } catch (error) {
      alert('Delete failed');
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 bg-gray-50 text-gray-900">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-black text-blue-600 tracking-tight">FILE HUB</h1>
        <p className="text-sm text-gray-500 font-medium mt-2 uppercase tracking-widest">Distributed Systems Project</p>
      </header>
      
      {/* Upload Card */}
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="group relative border-2 border-dashed border-gray-300 rounded-xl p-6 transition-colors hover:border-blue-400">
          <input 
            type="file" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-600">
              {file ? file.name : "Click to select or drag a file"}
            </p>
            <p className="text-xs text-gray-400 mt-1">Maximum size: 50MB</p>
          </div>
        </div>
        
        <button 
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full mt-6 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-lg active:scale-95"
        >
          {uploading ? 'UPLOADING...' : 'SEND TO SERVER'}
        </button>
      </div>

      {/* List Section */}
      <div className="mt-12 w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-extrabold text-gray-800">Storage Explorer</h2>
          <div className="h-px flex-1 bg-gray-200"></div>
          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{filesList.length} ITEMS</span>
        </div>
        
        <div className="space-y-3">
          {filesList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 text-gray-400">
              No files detected on the server nodes.
            </div>
          ) : (
            filesList.map((f) => (
              <div key={f.id} className="group bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xs border border-gray-100">
                    {f.file_name.split('.').pop()?.toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700 truncate max-w-[180px] sm:max-w-xs">{f.file_name}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {(f.file_size / 1024).toFixed(1)} KB • {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleDownload(f.storage_path, f.file_name)}
                    className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Download"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => handleDelete(f.id, f.storage_path)}
                    className="p-2.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6m-4.78 0-.34-6m4.78-9a3 3 0 0 1 3 3V4a.375.375 0 0 1-.375.375h-1.125V18a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 3.75 18V4.375H2.625A.375.375 0 0 1 2.25 4V3a3 3 0 0 1 3-3h7.5ZM8.25 2.25h3.5v1.5h-3.5v-1.5Z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}