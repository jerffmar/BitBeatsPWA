
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Share2, Heart, CheckCircle, MoreHorizontal, Disc, Mic2, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MOCK_ARTIST, MOCK_ALBUMS } from '../services/mockCatalog';
import { Track } from '../types';

interface ArtistPageProps {
  onPlay: (track: Track) => void;
}

export const ArtistPage: React.FC<ArtistPageProps> = ({ onPlay }) => {
  const { id } = useParams();
  const [isFollowing, setIsFollowing] = useState(false);
  const [expandedBio, setExpandedBio] = useState(false);

  // In real app, fetch artist by ID. Using Mock.
  const artist = MOCK_ARTIST;
  const popularTracks = MOCK_ALBUMS.flatMap(a => a.tracks).slice(0, 5); // Just taking first 5 for "Popular"

  if (!artist) return <div className="text-white p-10">Artist not found</div>;

  return (
    <div className="bg-dark-bg min-h-full pb-20 overflow-x-hidden">
      
      {/* --- HERO HEADER --- */}
      <div className="relative w-full h-[40vh] min-h-[340px] max-h-[500px]">
        {/* Background Image */}
        <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${artist.backgroundImage})` }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-dark-bg"></div>
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col gap-4 z-10">
            <div className="flex items-center gap-2 text-white/90">
                {artist.verified && <CheckCircle size={20} className="text-brand-500 fill-brand-500 text-black" />}
                <span className="text-sm font-medium tracking-wider uppercase">Verified Artist</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight drop-shadow-xl">{artist.name}</h1>
            
            <div className="flex items-center gap-4 text-gray-200 mt-2">
                <span className="text-base font-medium">{artist.monthlyListeners.toLocaleString()} monthly listeners</span>
            </div>
        </div>
      </div>

      {/* --- ACTION BAR --- */}
      <div className="px-8 py-6 flex items-center gap-6 bg-gradient-to-b from-dark-bg to-dark-bg/95">
          <button 
            onClick={() => onPlay(popularTracks[0] as Track)}
            className="w-14 h-14 bg-brand-500 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-500/20"
          >
              <Play size={28} fill="black" className="ml-1 text-black" />
          </button>

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
          
          {/* LEFT COLUMN (Popular & Discography) */}
          <div className="lg:col-span-2 space-y-10">
              
              {/* Popular Tracks */}
              <section>
                  <h2 className="text-2xl font-bold text-white mb-4">Popular</h2>
                  <div className="space-y-1">
                      {popularTracks.map((track, idx) => (
                          <div 
                            key={track.id} 
                            onClick={() => onPlay(track as Track)}
                            className="group flex items-center gap-4 p-3 rounded-md hover:bg-white/10 cursor-pointer transition-colors"
                          >
                              <span className="w-4 text-gray-500 text-center font-mono text-sm group-hover:hidden">{idx + 1}</span>
                              <Play size={14} className="w-4 hidden group-hover:block text-white" fill="currentColor" />
                              
                              <img src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded object-cover" />
                              
                              <div className="flex-1 min-w-0">
                                  <div className="text-white font-medium truncate group-hover:text-brand-400 transition-colors">{track.title}</div>
                                  <div className="text-xs text-gray-500">{track.plays?.toLocaleString()} plays</div>
                              </div>
                              
                              <div className="text-xs text-gray-500 font-mono">
                                  {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
                              </div>
                          </div>
                      ))}
                  </div>
              </section>

              {/* Discography */}
              <section>
                  <h2 className="text-2xl font-bold text-white mb-6">Discography</h2>
                  
                  {/* Tabs (Visual only for mock) */}
                  <div className="flex gap-4 mb-6 text-sm font-medium">
                      <button className="bg-white/10 text-white px-4 py-1.5 rounded-full">Albums</button>
                      <button className="text-gray-400 px-4 py-1.5 hover:text-white">Singles</button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {MOCK_ALBUMS.map(album => (
                          <Link to={`/album/${album.id}`} key={album.id} className="group block bg-white/5 p-4 rounded-xl hover:bg-white/10 transition-colors">
                              <div className="aspect-square rounded-lg overflow-hidden mb-4 shadow-lg relative">
                                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              </div>
                              <h3 className="text-white font-bold truncate">{album.title}</h3>
                              <p className="text-sm text-gray-500">{album.year} • Album</p>
                          </Link>
                      ))}
                  </div>
              </section>

          </div>

          {/* RIGHT COLUMN (Bio & Stats) */}
          <div className="space-y-8">
              
              <section>
                  <h2 className="text-2xl font-bold text-white mb-4">About</h2>
                  <div className="bg-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors cursor-pointer relative overflow-hidden" onClick={() => setExpandedBio(!expandedBio)}>
                      {/* Image Overlay */}
                      <div className="absolute inset-0 opacity-10 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${artist.coverImage})` }}></div>
                      
                      <div className={clsx("relative z-10 text-gray-300 leading-relaxed text-sm", !expandedBio && "line-clamp-4")}>
                          {artist.bio}
                      </div>
                      
                      {!expandedBio && (
                          <div className="relative z-10 mt-4 text-white font-bold text-sm uppercase tracking-wider hover:underline">
                              Read more
                          </div>
                      )}
                  </div>
              </section>

              <section>
                  <h2 className="text-lg font-bold text-white mb-4">Appears On</h2>
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
