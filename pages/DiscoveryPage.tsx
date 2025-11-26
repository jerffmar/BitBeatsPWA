
import React, { useMemo } from 'react';
import { Play, Heart, Disc, Mic2, Sparkles, User, ArrowRight } from 'lucide-react';
import { Track, LibraryEntry } from '../types';
import { useNavigate } from 'react-router-dom';

interface DiscoveryPageProps {
  library: Record<string, LibraryEntry>;
  tracks: Track[];
  onPlay: (track: Track) => void;
  user: any;
}

export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ library, tracks, onPlay, user }) => {
  const navigate = useNavigate();

  // --- CLIENT-SIDE LOGIC SIMULATION (Since we are PWA) ---
  
  // 1. "Jump Back In" - Sort library by lastPlayed
  const recentTracks = useMemo(() => {
    return Object.values(library)
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, 10)
      .map(entry => tracks.find(t => t.id === entry.trackId))
      .filter(Boolean) as Track[];
  }, [library, tracks]);

  // 2. "Your Rotation" - Extract unique artists from recent plays
  const recentArtists = useMemo(() => {
    const unique = new Set<string>();
    const artists: { name: string; id: string; image?: string }[] = [];
    
    recentTracks.forEach(t => {
      if (!unique.has(t.artist)) {
        unique.add(t.artist);
        // In a real app, we'd have artist IDs and images. 
        // Using coverUrl of the track as a fallback for artist image.
        artists.push({ 
            name: t.artist, 
            id: t.artist, // using name as ID for demo
            image: t.coverUrl 
        });
      }
    });
    return artists.slice(0, 10);
  }, [recentTracks]);

  // 3. "For You To Discover" - Simple affinity matching
  const recommendations = useMemo(() => {
    if (recentTracks.length === 0) return tracks.slice(0, 10); // Fallback: Newest

    // Get most frequent tags/genres from library
    const tagCounts: Record<string, number> = {};
    recentTracks.forEach(t => {
      t.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t]) => t);

    // Find tracks in Swarm (tracks) that are NOT in library, matching tags
    const libraryIds = new Set(Object.keys(library));
    
    return tracks
      .filter(t => !libraryIds.has(t.id)) // Not already collected
      .filter(t => t.tags.some(tag => topTags.includes(tag))) // Matches taste
      .slice(0, 10);
  }, [library, tracks, recentTracks]);

  const topGenre = recommendations.length > 0 && recentTracks.length > 0
    ? recentTracks[0].tags[0] 
    : 'New Music';

  // --- UI COMPONENTS ---

  const SectionHeader = ({ title, subtitle, icon: Icon }: any) => (
    <div className="flex items-end justify-between mb-6 px-1">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
           {Icon && <Icon className="text-brand-500" size={24} />}
           {title}
        </h2>
        {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
      </div>
      <button className="text-xs font-bold text-brand-500 hover:text-brand-400 uppercase tracking-wider flex items-center gap-1">
          See All <ArrowRight size={14} />
      </button>
    </div>
  );

  return (
    <div className="pb-32 overflow-x-hidden">
        
        {/* Hero Welcome */}
        <div className="px-8 pt-10 pb-6 bg-gradient-to-b from-brand-900/20 to-dark-bg/0">
             <h1 className="text-4xl font-bold text-white mb-2">
                 Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user.username}
             </h1>
             <div className="flex gap-2">
                 <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400 border border-white/5">
                    User ID: {user.id.substring(0, 8)}...
                 </span>
                 <span className="px-3 py-1 bg-brand-500/10 rounded-full text-xs text-brand-500 border border-brand-500/20">
                    Taste Profile Active
                 </span>
             </div>
        </div>

        {/* SECTION 1: JUMP BACK IN */}
        <section className="mb-12 pl-8">
            <SectionHeader title="Jump Back In" subtitle="Pick up where you left off" icon={Play} />
            
            <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 pr-8 -ml-2 pl-2 scrollbar-hide">
                {recentTracks.length === 0 && (
                    <div className="text-gray-500 italic pl-2">Play some music to see your history here.</div>
                )}
                {recentTracks.map((track) => (
                    <div 
                        key={track.id} 
                        onClick={() => onPlay(track)}
                        className="snap-start shrink-0 w-[160px] group cursor-pointer"
                    >
                        <div className="aspect-square rounded-lg bg-gray-800 mb-3 overflow-hidden relative shadow-lg">
                            <img src={track.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="bg-brand-500 text-black rounded-full p-3 shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all">
                                    <Play size={20} fill="currentColor" />
                                </div>
                            </div>
                        </div>
                        <h3 className="font-bold text-white truncate text-sm">{track.title}</h3>
                        <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                    </div>
                ))}
            </div>
        </section>

        {/* SECTION 2: YOUR ROTATION */}
        <section className="mb-12 pl-8">
            <SectionHeader title="Your Rotation" subtitle="Artists you've verified recently" icon={Mic2} />

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4 pr-8 -ml-2 pl-2 scrollbar-hide">
                {recentArtists.length === 0 && (
                    <div className="text-gray-500 italic pl-2">No artists in rotation yet.</div>
                )}
                {recentArtists.map((artist) => (
                    <div 
                        key={artist.id} 
                        onClick={() => navigate(`/search?type=ARTIST&q=${artist.name}`)}
                        className="snap-start shrink-0 w-[120px] flex flex-col items-center group cursor-pointer"
                    >
                        <div className="w-[120px] h-[120px] rounded-full bg-gray-800 mb-3 overflow-hidden relative border-2 border-transparent group-hover:border-brand-500 transition-all shadow-xl">
                            <img src={artist.image} className="w-full h-full object-cover" />
                        </div>
                        <h3 className="font-bold text-white text-center text-sm truncate w-full">{artist.name}</h3>
                    </div>
                ))}
            </div>
        </section>

        {/* SECTION 3: RECOMMENDATIONS */}
        <section className="mb-8 pl-8">
            <div className="mb-6 px-1">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-yellow-400" />
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Taste Profile</span>
                </div>
                <h2 className="text-2xl font-bold text-white">For You to Discover</h2>
                <p className="text-gray-400 text-sm">Because you listen to <span className="text-brand-400">{topGenre}</span></p>
            </div>

            <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-4 pr-8 -ml-2 pl-2 scrollbar-hide">
                 {recommendations.length === 0 && (
                     <div className="w-full h-32 flex items-center justify-center border border-dashed border-white/10 rounded-xl mr-8">
                         <p className="text-gray-500">Add more music to your library to generate recommendations.</p>
                     </div>
                 )}
                 {recommendations.map((track) => (
                     <div 
                        key={track.id} 
                        onClick={() => onPlay(track)}
                        className="snap-start shrink-0 w-[280px] group cursor-pointer bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors"
                     >
                         <div className="aspect-video rounded-lg bg-gray-800 mb-3 overflow-hidden relative">
                             <img src={track.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                             <div className="absolute top-2 left-2 flex gap-1">
                                 {track.tags.slice(0, 2).map(tag => (
                                     <span key={tag} className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white font-bold uppercase tracking-wider">
                                         {tag}
                                     </span>
                                 ))}
                             </div>
                             <div className="absolute bottom-2 right-2">
                                 <button className="bg-brand-500 text-black rounded-full p-2 hover:scale-110 transition-transform shadow-lg">
                                     <Play size={16} fill="currentColor" />
                                 </button>
                             </div>
                         </div>
                         <h3 className="font-bold text-white truncate text-lg">{track.title}</h3>
                         <div className="flex items-center justify-between mt-1">
                             <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                             <div className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                 Album
                             </div>
                         </div>
                     </div>
                 ))}
            </div>
        </section>

    </div>
  );
};
