/* 
  NOTE: If you see `npm ci` failing with EUSAGE about package.json vs package-lock.json:
    1) Run locally: npm install
    2) Commit the updated package-lock.json: git add package-lock.json && git commit -m "chore: update lockfile"
    3) Re-run: npm ci (CI will now succeed)
  Alternatives:
    - Delete node_modules and package-lock.json then run npm install to regenerate the lockfile.
    - In CI only (not recommended): run npm install before build to refresh the lockfile.
  Rationale: `npm ci` requires the lockfile to match package.json exactly; updating the lockfile resolves the EUSAGE errors.
*/

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Heart, Clock, Cloud, CheckCircle, Share2, MoreHorizontal, Loader, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Track } from '../types';
import { lookupRelease, MBReleaseDetail } from '../services/musicBrainz';
import { createBounty } from '../services/db';
import { LikeButton } from '../components/LikeButton';
import { getSession } from '../services/auth';
import { CoverImage } from '../components/ui/CoverImage';

interface AlbumPageProps {
  onPlay: (track: Track) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  swarmTracks: Track[]; // Injected to check for availability
}

export const AlbumPage: React.FC<AlbumPageProps> = ({ onPlay, currentTrackId, isPlaying, swarmTracks }) => {
  const { id } = useParams();
  const [album, setAlbum] = useState<MBReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(user => {
        if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    lookupRelease(id).then(data => {
        setAlbum(data);
        setLoading(false);
    });
  }, [id]);

  const handleRequest = (trackTitle: string, trackArtist: string) => {
      // Create Bounty
      createBounty(id, `${trackArtist} - ${trackTitle}`, 50);
      alert(`Requested "${trackTitle}"!`);
  };

  const getSwarmMatch = (trackTitle: string) => {
      // Loose match for availability
      return swarmTracks.find(t => 
        t.title.toLowerCase() === trackTitle.toLowerCase() && 
        (t.artist.toLowerCase() === album?.artist.toLowerCase() || t.album.toLowerCase() === album?.title.toLowerCase())
      );
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full text-brand-500">
              <Loader size={32} className="animate-spin" />
          </div>
      );
  }

  if (!album || !id) return <div className="text-white p-10">Album not found or error loading metadata.</div>;

  const totalDurationMin = Math.floor(album.tracks.reduce((acc, t) => acc + (t.duration || 0), 0) / 60);

  return (
    <div className="bg-dark-bg min-h-full pb-20 overflow-x-hidden font-sans">
        
        {/* --- HEADER --- */}
        <div className="relative pt-10 pb-8 px-8 flex flex-col md:flex-row gap-8 items-end bg-gradient-to-b from-gray-800/50 to-dark-bg/0">
             {/* Dynamic Background Gradient */}
             <div className="absolute inset-0 bg-gradient-to-b from-brand-900/10 to-dark-bg pointer-events-none"></div>

             {/* Album Art */}
             <div className="relative z-10 group shrink-0 shadow-2xl rounded-lg overflow-hidden w-60 h-60 md:w-72 md:h-72 bg-gray-800">
                 <CoverImage 
                    mbid={album.id}
                    fallbackSrc={album.coverUrl}
                    type="album"
                    className="w-full h-full object-cover" 
                    alt={album.title}
                 />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                     <Play size={48} fill="white" className="text-white drop-shadow-lg cursor-pointer hover:scale-110 transition-transform" />
                 </div>
             </div>

             {/* Metadata */}
             <div className="relative z-10 flex flex-col gap-2 min-w-0 flex-1">
                 <h4 className="text-sm font-bold text-white/60 uppercase tracking-widest mb-1">Album</h4>
                 <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight">{album.title}</h1>
                 
                 <div className="flex items-center gap-2 text-white font-bold text-lg mt-2">
                     {album.artist}
                 </div>
                 
                 <div className="flex items-center gap-2 text-sm text-gray-400 font-medium mt-1">
                     <span>Album</span>
                     <span>•</span>
                     <span>{album.date}</span>
                     <span>•</span>
                     <span>{album.tracks.length} Songs, {totalDurationMin} min</span>
                 </div>

                 {/* Action Bar */}
                 <div className="flex items-center gap-4 mt-6">
                     <button className="bg-brand-500 text-black px-8 py-3 rounded-md font-bold hover:bg-brand-400 active:scale-95 transition-all shadow-lg shadow-brand-500/10 flex items-center gap-2">
                         <Play size={18} fill="currentColor" /> Play All
                     </button>
                     {userId && (
                         <LikeButton 
                            userId={userId}
                            entityId={id}
                            entityType="album"
                            metadata={{
                                title: album.title,
                                coverUrl: album.coverUrl,
                                subtitle: album.artist
                            }}
                            variant="button"
                         />
                     )}
                     <button className="p-3 border border-white/10 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                         <MoreHorizontal size={20} />
                     </button>
                 </div>
             </div>
        </div>

        {/* --- DESCRIPTION --- */}
        {album.about && (
            <div className="px-8 mb-8 max-w-3xl">
                <p className="text-gray-400 text-sm leading-relaxed">{album.about}</p>
            </div>
        )}

        {/* --- TRACKLIST --- */}
        <div className="px-4 md:px-8">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 text-xs font-bold text-gray-500 uppercase px-4 py-2 border-b border-white/5 mb-2">
                <div className="w-8 text-center">#</div>
                <div>Title</div>
                <div className="hidden md:block">Action</div>
                <div className="w-12 text-right"><Clock size={14} className="inline" /></div>
            </div>

            <div className="space-y-1">
                {album.tracks.map((track) => {
                    const swarmMatch = getSwarmMatch(track.title);
                    const active = swarmMatch && currentTrackId === swarmMatch.id;
                    const isPlayable = !!swarmMatch;

                    return (
                        <div 
                            key={track.id}
                            onClick={() => { if(isPlayable && swarmMatch) onPlay(swarmMatch); }}
                            className={clsx(
                                "group grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-3 rounded-lg transition-colors",
                                active ? "bg-white/10" : "hover:bg-white/5",
                                isPlayable ? "cursor-pointer" : "opacity-70 cursor-default"
                            )}
                        >
                            {/* Index / Play Icon */}
                            <div className="w-8 text-center text-sm font-medium text-gray-400 relative">
                                <span className={clsx("group-hover:hidden", active && "text-brand-500")}>
                                    {active && isPlaying ? <div className="w-3 h-3 mx-auto bg-brand-500 rounded-full animate-pulse" /> : track.position}
                                </span>
                                {isPlayable ? (
                                    <Play size={14} className="hidden group-hover:block mx-auto text-white" fill="currentColor" />
                                ) : (
                                    <span className="hidden group-hover:block mx-auto text-gray-600">-</span>
                                )}
                            </div>

                            {/* Title & Icons */}
                            <div className="min-w-0 pr-4 flex items-center gap-3">
                                <div className="min-w-0">
                                    <div className={clsx("font-medium truncate text-base", active ? "text-brand-400" : "text-white")}>
                                        {track.title}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {isPlayable ? (
                                            <span className="flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 rounded border border-green-500/20">
                                                <CheckCircle size={10} /> Available in Swarm
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-white/5 px-1.5 rounded border border-white/10">
                                                Not Cached
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {userId && isPlayable && swarmMatch && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                                        <LikeButton 
                                            userId={userId}
                                            entityId={swarmMatch.id}
                                            entityType="track"
                                            metadata={{
                                                title: swarmMatch.title,
                                                subtitle: swarmMatch.artist,
                                                coverUrl: swarmMatch.coverUrl
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Action Button */}
                            <div className="hidden md:block text-sm">
                                {!isPlayable && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRequest(track.title, track.artist); }}
                                        className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 text-brand-500 px-2 py-1 rounded border border-brand-500/20"
                                    >
                                        <Cloud size={10} /> Request Bounty
                                    </button>
                                )}
                            </div>

                            {/* Duration */}
                            <div className="w-12 text-right text-sm text-gray-500 font-mono">
                                {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
