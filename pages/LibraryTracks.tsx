
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, ArrowLeft, Loader, Play, Pause } from 'lucide-react';
import { likeService } from '../services/likeService';
import { LikedItem, Track } from '../types';
import { getSession } from '../services/auth';

interface LibraryTracksProps {
    onPlay: (track: Track) => void;
}

export const LibraryTracks: React.FC<LibraryTracksProps> = ({ onPlay }) => {
    const navigate = useNavigate();
    const [tracks, setTracks] = useState<LikedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSession().then(async (user) => {
            if (user) {
                const items = await likeService.getAllLiked(user.id, 'track');
                setTracks(items);
            }
            setLoading(false);
        });
    }, []);

    const handlePlay = (item: LikedItem) => {
        // Construct a partial Track object to satisfy the onPlay interface
        // In a real app, we might need to fetch full track details (URL) first if not cached.
        // For now, we assume the player or global state can handle a playback request 
        // or trigger a search/stream.
        
        // Since LikedItem doesn't store the audioUrl, we technically can't play DIRECTLY 
        // without fetching metadata again.
        // However, for this UI demo, we will check if the parent App has the track in 'tracks' (Swarm)
        // or trigger a search.
        
        // Strategy: Navigate to search for immediate playback resolution or pass partial data.
        // Ideally, `likeService` should store audioUrl or `onPlay` should handle ID lookup.
        // We will pass what we have and let the App/Player logic resolve it (or fail gracefully).
        
        // NOTE: This assumes the App's handlePlay can fetch/resolve by ID if URL is missing, 
        // OR we just use this as a list that links to the album/search.
        
        // Better UX for this specific codebase: Use the search link if we don't have the URL,
        // OR construct a partial track if we assume the App can find it in the 'tracks' state.
        // Let's try to simulate a play request by searching for it which is safer in this PoC.
        
        navigate(`/search?type=SONG&q=${encodeURIComponent(item.title)}`);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500 flex justify-center"><Loader className="animate-spin" /></div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} className="text-white" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Music className="text-brand-500" /> Favorite Songs
                    </h1>
                    <p className="text-gray-400 text-sm">{tracks.length} songs in your collection</p>
                </div>
            </div>

            {tracks.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white/5 rounded-2xl border border-white/5">
                    <Music size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No songs saved yet.</p>
                    <button onClick={() => navigate('/search?type=SONG')} className="text-brand-500 hover:underline mt-2">
                        Find Songs
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {tracks.map((track, i) => (
                        <div 
                            key={track.entityId} 
                            onClick={() => handlePlay(track)}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer group transition-colors border border-transparent hover:border-white/5"
                        >
                            <span className="w-8 text-center text-gray-500 text-sm">{i + 1}</span>
                            <div className="w-12 h-12 rounded bg-gray-800 overflow-hidden relative">
                                <img src={track.coverUrl} className="w-full h-full object-cover" alt={track.title} />
                                <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                                    <Play size={20} className="text-white fill-current" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-white truncate">{track.title}</div>
                                <div className="text-sm text-gray-400 truncate">{track.subtitle}</div>
                            </div>
                            <div className="text-xs text-gray-500 px-4 hidden sm:block">
                                {new Date(track.addedAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
