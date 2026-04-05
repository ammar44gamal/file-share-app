'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function VoiceNotePlayer({ path, isMine }: { path: string, isMine: boolean }) {
    const [url, setUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        supabase.storage.from('user-files').createSignedUrl(path, 3600).then(({ data }) => {
            if (data?.signedUrl) setUrl(data.signedUrl);
        });
    }, [path]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const current = audioRef.current.currentTime;
            const total = audioRef.current.duration;
            if (!isNaN(total) && total !== Infinity) {
                setProgress((current / total) * 100);
            } else {
                setProgress((current % 3) / 3 * 100); 
            }
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    if (!url) return <div className={`animate-pulse h-10 w-48 rounded-full ${isMine ? 'bg-blue-700' : 'bg-[#333]'}`}></div>;

    return (
        <div className="flex items-center gap-3 min-w-[200px] py-1 pl-1">
            <audio 
                ref={audioRef} 
                src={url} 
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="hidden"
            />
            
            <button 
                onClick={togglePlay} 
                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition shadow-md ${isMine ? 'bg-white text-blue-600 hover:bg-gray-200' : 'bg-[#444] text-white hover:bg-[#555]'}`}
            >
                {isPlaying ? (
                    <div className="flex gap-0.5">
                        <div className="w-1 h-3 bg-current rounded-sm"></div>
                        <div className="w-1 h-3 bg-current rounded-sm"></div>
                    </div>
                ) : (
                    <div className="ml-1 w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-current border-b-[5px] border-b-transparent"></div>
                )}
            </button>
            
            <div className={`flex-1 h-1.5 rounded-full overflow-hidden relative ${isMine ? 'bg-blue-800' : 'bg-[#111]'}`}>
                <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-100 ease-linear ${isMine ? 'bg-white' : 'bg-cyan-400'}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            <div className={`flex gap-[2px] items-center h-4 ${isMine ? 'text-white' : 'text-[#888]'}`}>
                <div className={`w-[2px] bg-current rounded-full transition-all ${isPlaying ? 'h-full animate-pulse' : 'h-1/2'}`}></div>
                <div className={`w-[2px] bg-current rounded-full transition-all ${isPlaying ? 'h-3/4 animate-pulse delay-75' : 'h-1'}`}></div>
                <div className={`w-[2px] bg-current rounded-full transition-all ${isPlaying ? 'h-full animate-pulse delay-150' : 'h-1/3'}`}></div>
            </div>
        </div>
    );
}