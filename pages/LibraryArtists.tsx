
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic2, ArrowLeft, Loader } from 'lucide-react';
import { likeService } from '../services/likeService';
import { LikedItem } from '../types';
import { getSession } from '../services/auth';

export const LibraryArtists: React.FC = () => {
    const navigate = useNavigate();
    const [artists, setArtists] = useState<LikedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSession().then(async (user) => {
            if (user) {
                const items = await likeService.getAllLiked(user.id, 'artist');
                setArtists(items);
            }
            setLoading(false);
        });
    }, []);

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
                        <Mic2 className="text-brand-500" /> Favorite Artists
                    </h1>
                    <p className="text-gray-400 text-sm">{artists.length} artists in your collection</p>
                </div>
            </div>

            {artists.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white/5 rounded-2xl border border-white/5">
                    <Mic2 size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No artists saved yet.</p>
                    <button onClick={() => navigate('/search?type=ARTIST')} className="text-brand-500 hover:underline mt-2">
                        Find Artists
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {artists.map(artist => (
                        <div 
                            key={artist.entityId} 
                            onClick={() => navigate(`/artist/${artist.entityId}`)}
                            className="group cursor-pointer"
                        >
                            <div className="aspect-square rounded-full bg-gray-800 mb-4 overflow-hidden relative border-2 border-transparent group-hover:border-brand-500 transition-all shadow-lg">
                                <img src={artist.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={artist.title} />
                            </div>
                            <h3 className="font-bold text-white text-center truncate px-2">{artist.title}</h3>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
