
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Share2, Heart, CheckCircle, MoreHorizontal, Disc, Mic2, Clock, Loader } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Track } from '../types';
import { lookupArtist, getArtistDiscography, MBArtist, MBRelease } from '../services/musicBrainz';

interface ArtistPageProps {
  onPlay: (track: Track) => void;
  swarmTracks: Track[]; // Injected to check availability
}

export const ArtistPage: React.FC<ArtistPageProps> = ({ onPlay, swarmTracks }) => {
  const { id } = useParams();
  const [isFollowing, setIsFollowing] = useState(false);
  const [expandedBio, setExpandedBio] = useState(false);
  
  const [artist, setArtist] = useState<MBArtist | null>(null);
  const [releases, setReleases] = useState<MBRelease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchArtist = async () => {
        setLoading(true);
        const [artistData, discogData] = await Promise.all([
            lookupArtist(id),
            getArtistDiscography(id)
        ]);
        setArtist(artistData);
        setReleases(discogData);
        setLoading(false);
    };

    fetchArtist();
  }, [id]);

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full text-brand-500">
              <Loader size={32} className="animate-spin" />
          </div>
      );
  }

  if (!artist) return <div className="text-white p-10">Artist not found</div>;

  // Background Image fallback using first album cover or generic
  const bgImage = releases[0]?.coverUrl || 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1600';

  return (
    <div className="bg-dark-bg min-h-full pb-20 overflow-x-hidden">
      
      {/* --- HERO HEADER --- */}
      <div className="relative w-full h-[40vh] min-h-[340px] max-h-[500px]">
        {/* Background Image */}
        <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm opacity-60"
            style={{ backgroundImage: `url(${bgImage})` }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-dark-bg"></div>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col gap-4 z-10">
            <div className="flex items-center gap-2 text-white/90">
                <CheckCircle size={20} className="text-brand-500 fill-brand-500 text-black" />
                <span className="text-sm font-medium tracking-wider uppercase">Verified Artist</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight drop-shadow-xl">{artist.name}</h1>
            
            <div className="flex items-center gap-4 text-gray-200 mt-2">
                <span className="text-base font-medium">{artist.country}</span>
            </div>
        </div>
      </div>

      {/* --- ACTION BAR --- */}
      <div className="px-8 py-6 flex items-center gap-6 bg-gradient-to-b from-dark-bg to-dark-bg/95">
          <button 
            onClick={() => setIsFollowing(!isFollowing)}
            className={twMerge(
                "px-6 py-1.5 rounded-full border text-sm font-bold tracking-wide uppercase transition-colors",
                isFollowing 
                    ? "border-brand-500 text-brand-500" 
                    : "border-gray-500 text-white hover:border-white"
            )}
          >
              {isFollowing ? 'Following' : 'Follow'}
          </button>

          <button className="text-gray-400 hover:text-white transition-colors">
              <MoreHorizontal size={32} />
          </button>
      </div>

      {/* --- CONTENT LAYOUT --- */}
      <div className="px-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* LEFT COLUMN (Discography) */}
          <div className="lg:col-span-2 space-y-10">
              {/* Discography */}
              <section>
                  <h2 className="text-2xl font-bold text-white mb-6">Discography</h2>
                  
                  {/* Tabs (Visual only for now) */}
                  <div className="flex gap-4 mb-6 text-sm font-medium">
                      <button className="bg-white/10 text-white px-4 py-1.5 rounded-full">Releases</button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {releases.map(album => (
                          <Link to={`/album/${album.id}`} key={album.id} className="group block bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-colors">
                              <div className="aspect-square rounded-lg overflow-hidden mb-4 shadow-lg relative bg-gray-800">
                                  <img 
                                    src={album.coverUrl} 
                                    alt={album.title} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300/18181b/555?text=NO+COVER'; }}
                                  />
                              </div>
                              <h3 className="text-white font-bold truncate">{album.title}</h3>
                              <p className="text-sm text-gray-500">{album.date} • Album</p>
                          </Link>
                      ))}
                      {releases.length === 0 && <p className="text-gray-500">No releases found.</p>}
                  </div>
              </section>

          </div>

          {/* RIGHT COLUMN (Bio & Stats) */}
          <div className="space-y-8">
              
              <section>
                  <h2 className="text-2xl font-bold text-white mb-4">About</h2>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                      <div className={clsx("relative z-10 text-gray-300 leading-relaxed text-sm")}>
                          {artist.disambiguation || "No biography available."}
                      </div>
                  </div>
              </section>

              <section>
                  <h2 className="text-lg font-bold text-white mb-4">Tags</h2>
                  <div className="flex gap-2 flex-wrap">
                      {artist.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer">
                              #{tag}
                          </span>
                      ))}
                  </div>
              </section>
              
          </div>

      </div>
    </div>
  );
};
