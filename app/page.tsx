'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function FileSharePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filesList, setFilesList] = useState<any[]>([]);

  // 1. Function to fetch the list of files from the database
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

  // Run fetchFiles when the page first loads
  useEffect(() => {
    fetchFiles();
  }, []);

  // 2. Logic to handle File Upload
  const handleUpload = async () => {
    if (!file) return alert('Please select a file first!');
    
    setUploading(true);
    try {
      // Create a unique path for the storage bucket
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      let { error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Insert metadata into the Postgres table
      const { error: dbError } = await supabase
        .from('files')
        .insert([
          { 
            file_name: file.name, 
            file_type: file.type, 
            file_size: file.size, 
            storage_path: filePath 
          }
        ]);

      if (dbError) throw dbError;

      alert('File uploaded successfully!');
      setFile(null);
      fetchFiles(); // Refresh the list automatically
    } catch (error) {
      console.error('Error:', error);
      alert('Upload failed!');
    } finally {
      setUploading(false);
    }
  };

  // 3. Logic to handle File Download
  const handleDownload = async (storagePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('user-files')
        .download(storagePath);

      if (error) throw error;

      // Create a blob link to trigger the browser's download manager
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading file');
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8 bg-gray-50 font-sans">
      <h1 className="text-4xl font-extrabold mb-2 text-blue-600">File Hub</h1>
      <p className="text-gray-500 mb-10 text-center">Distributed Computing Project - File Sharing Server</p>
      
      {/* Upload Section */}
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Select a file to upload</label>
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-500 mb-6 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
        />
        
        <button 
          onClick={handleUpload}
          disabled={uploading || !file}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
        >
          {uploading ? 'Processing...' : 'Upload to Server'}
        </button>
      </div>

      {/* List Section */}
      <div className="mt-12 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Server Files</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {filesList.length} Files
          </span>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {filesList.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic">
              The distributed storage is currently empty.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filesList.map((f) => (
                <li key={f.id} className="p-5 flex justify-between items-center hover:bg-blue-50/30 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-700 truncate max-w-xs">{f.file_name}</span>
                    <span className="text-xs text-gray-400">
                      {(f.file_size / 1024).toFixed(1)} KB • {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDownload(f.storage_path, f.file_name)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-bold bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition"
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}