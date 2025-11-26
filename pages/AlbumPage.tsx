
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Heart, Clock, Cloud, CheckCircle, Share2, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { MOCK_ALBUMS } from '../services/mockCatalog';
import { Track } from '../types';

interface AlbumPageProps {
  onPlay: (track: Track) => void;
  currentTrackId?: string;
  isPlaying: boolean;
}

export const AlbumPage: React.FC<AlbumPageProps> = ({ onPlay, currentTrackId, isPlaying }) => {
  const { id } = useParams();
  
  // Find album
  const album = MOCK_ALBUMS.find(a => a.id === id);

  if (!album) return <div className="text-white p-10">Album not found</div>;

  const totalDurationMin = Math.floor(album.tracks.reduce((acc, t) => acc + (t.duration || 0), 0) / 60);

  return (
    <div className="bg-dark-bg min-h-full pb-20 overflow-x-hidden font-sans">
        
        {/* --- HEADER --- */}
        <div className="relative pt-10 pb-8 px-8 flex flex-col md:flex-row gap-8 items-end bg-gradient-to-b from-gray-800/50 to-dark-bg/0">
             {/* Dynamic Background Gradient */}
             <div className="absolute inset-0 bg-gradient-to-b from-brand-900/10 to-dark-bg pointer-events-none"></div>

             {/* Album Art */}
             <div className="relative z-10 group shrink-0 shadow-2xl rounded-lg overflow-hidden w-60 h-60 md:w-72 md:h-72">
                 <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                     <Play size={48} fill="white" className="text-white drop-shadow-lg cursor-pointer hover:scale-110 transition-transform" />
                 </div>
             </div>

             {/* Metadata */}
             <div className="relative z-10 flex flex-col gap-2 min-w-0 flex-1">
                 <h4 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-1">Album</h4>
                 <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">{album.title}</h1>
                 
                 <div className="flex items-center gap-2 text-white font-bold text-lg mt-2">
                     <Link to={`/artist/${album.artistId}`} className="hover:underline decoration-brand-500 underline-offset-4">
                         {album.tracks[0].artist}
                     </Link>
                 </div>
                 
                 <div className="flex items-center gap-2 text-sm text-gray-400 font-medium mt-1">
                     <span>{album.genre[0]}</span>
                     <span>•</span>
                     <span>{album.year}</span>
                     <span>•</span>
                     <span>{album.tracks.length} Songs, {totalDurationMin} min</span>
                 </div>

                 {/* Action Bar */}
                 <div className="flex items-center gap-4 mt-6">
                     <button 
                         onClick={() => onPlay(album.tracks[0] as Track)}
                         className="bg-brand-500 text-black px-8 py-3 rounded-md font-bold hover:bg-brand-400 active:scale-95 transition-all shadow-lg shadow-brand-500/10 flex items-center gap-2"
                     >
                         <Play size={18} fill="currentColor" /> Play
                     </button>
                     <button className="p-3 border border-white/10 rounded-full hover:bg-white/10 text-brand-500 transition-colors">
                         <Heart size={20} fill="currentColor" />
                     </button>
                     <button className="p-3 border border-white/10 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                         <MoreHorizontal size={20} />
                     </button>
                 </div>
             </div>
        </div>

        {/* --- DESCRIPTION --- */}
        {album.description && (
            <div className="px-8 mb-8 max-w-3xl">
                <p className="text-gray-400 text-sm leading-relaxed">{album.description}</p>
            </div>
        )}

        {/* --- TRACKLIST --- */}
        <div className="px-4 md:px-8">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 text-xs font-bold text-gray-500 uppercase px-4 py-2 border-b border-white/5 mb-2">
                <div className="w-8 text-center">#</div>
                <div>Title</div>
                <div className="hidden md:block">Plays</div>
                <div className="w-12 text-right"><Clock size={14} className="inline" /></div>
            </div>

            <div className="space-y-1">
                {album.tracks.map((track) => {
                    const active = currentTrackId === track.id;
                    return (
                        <div 
                            key={track.id}
                            onClick={() => onPlay(track as Track)} 
                            className={clsx(
                                "group grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-3 rounded-lg cursor-pointer transition-colors",
                                active ? "bg-white/10" : "hover:bg-white/5"
                            )}
                        >
                            {/* Index / Play Icon */}
                            <div className="w-8 text-center text-sm font-medium text-gray-400 relative">
                                <span className={clsx("group-hover:hidden", active && "text-brand-500")}>
                                    {active && isPlaying ? <div className="w-3 h-3 mx-auto bg-brand-500 rounded-full animate-pulse" /> : track.index}
                                </span>
                                <Play size={14} className="hidden group-hover:block mx-auto text-white" fill="currentColor" />
                            </div>

                            {/* Title & Icons */}
                            <div className="min-w-0 pr-4">
                                <div className={clsx("font-medium truncate text-base", active ? "text-brand-400" : "text-white")}>
                                    {track.title}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {track.isCached && (
                                        <span className="flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 rounded border border-green-500/20">
                                            <CheckCircle size={10} /> Offline
                                        </span>
                                    )}
                                    {track.needsRequest && (
                                        <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-white/5 px-1.5 rounded">
                                            <Cloud size={10} /> Request
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Plays */}
                            <div className="hidden md:block text-sm text-gray-500 font-mono">
                                {track.plays?.toLocaleString()}
                            </div>

                            {/* Duration / Like */}
                            <div className="w-12 text-right text-sm text-gray-500 font-mono group-hover:hidden">
                                {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
                            </div>
                            <div className="w-12 text-right hidden group-hover:block">
                                <button className="text-gray-400 hover:text-brand-500">
                                    <Heart size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
