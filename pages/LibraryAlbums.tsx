
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, ArrowLeft, Loader } from 'lucide-react';
import { likeService } from '../services/likeService';
import { LikedItem } from '../types';
import { getSession } from '../services/auth';

export const LibraryAlbums: React.FC = () => {
    const navigate = useNavigate();
    const [albums, setAlbums] = useState<LikedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSession().then(async (user) => {
            if (user) {
                const items = await likeService.getAllLiked(user.id, 'album');
                setAlbums(items);
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
                        <Disc className="text-brand-500" /> Favorite Albums
                    </h1>
                    <p className="text-gray-400 text-sm">{albums.length} albums in your collection</p>
                </div>
            </div>

            {albums.length === 0 ? (
                <div className="text-center py-20 text-gray-500 bg-white/5 rounded-2xl border border-white/5">
                    <Disc size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No albums saved yet.</p>
                    <button onClick={() => navigate('/search?type=ALBUM')} className="text-brand-500 hover:underline mt-2">
                        Find Albums
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {albums.map(album => (
                        <div 
                            key={album.entityId} 
                            onClick={() => navigate(`/album/${album.entityId}`)}
                            className="group cursor-pointer bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <div className="aspect-square rounded-lg bg-gray-800 mb-4 overflow-hidden shadow-lg relative">
                                <img src={album.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={album.title} />
                            </div>
                            <h3 className="font-bold text-white truncate">{album.title}</h3>
                            <p className="text-sm text-gray-400 truncate">{album.subtitle}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
