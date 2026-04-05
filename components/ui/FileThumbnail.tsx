'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function FileThumbnail({ path, fileName, isChat = false }: { path: string, fileName: string, isChat?: boolean }) {
    const [url, setUrl] = useState<string | null>(null);
    const isImage = fileName.match(/\.(jpeg|jpg|gif|png|webp)$/i);
    
    useEffect(() => {
        if (isImage) {
            supabase.storage.from('user-files').createSignedUrl(path, 3600).then(({ data }) => {
                if (data?.signedUrl) setUrl(data.signedUrl);
            });
        }
    }, [path, isImage]);

    if (!isImage) {
        return (
            <div className={`bg-[#111] border border-[#222] rounded-lg flex items-center justify-center text-white font-bold text-[10px] uppercase italic shadow-inner ${isChat ? 'p-4 w-full text-left' : 'w-12 h-12'}`}>
                {fileName.split('.').pop()}
            </div>
        );
    }
    
    return url ? (
        <img src={url} alt={fileName} className={`object-cover rounded-lg border border-[#222] ${isChat ? 'max-w-full h-auto max-h-48' : 'w-12 h-12'}`} />
    ) : (
        <div className={`animate-pulse bg-[#222] rounded-lg ${isChat ? 'w-48 h-32' : 'w-12 h-12'}`}></div>
    );
}