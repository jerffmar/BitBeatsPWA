
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Search, Library, 
  Wifi, HardDrive, Share2, Download, Radio, Volume2, User, 
  Disc, Users, Zap, Shield, Mic2, Settings, Trash2, Heart,
  Globe, Activity, LogOut, Send, MessageSquare, Check, X, FileAudio,
  Database, AlertCircle, Music, Layers, Mic, Tag
} from 'lucide-react';

import { Track, LibraryEntry, UserStats, ViewState, StorageConfig, User as UserType, SocialPost, GlobalCatalogEntry, Bounty } from './types';
import { MOCK_PARTIES, calculateRatio } from './services/mockData';
import { saveToVault, loadFromVault, checkVaultStatus, getStoredBytes, runSmartEviction, exportTrack, opfsSupported } from './services/storage.ts';
import { getReputation, discoverLocalPeers, signUpload } from './services/p2pNetwork';
import { initDB, subscribeToPosts, publishPost, createBounty, subscribeToBounties, publishTrackMetadata, subscribeToTracks } from './services/db';
import { initTorrentClient, seedFile, addTorrent, getTorrentStats } from './services/torrent';
import { analyzeAudio, normalizeAndTranscode } from './services/audioEngine';
import { searchGlobalCatalog, SearchResults, DetailedMetadata } from './services/musicBrainz';
import { identifyTrack } from './services/identification';
import { AuthScreen } from './AuthScreen';
import { getSession, logout } from './services/auth';
import { UploadZone } from './components/UploadZone'; // NEW IMPORT

// --- Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const base = "transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-500 hover:bg-brand-400 text-black px-6 py-2.5 rounded-full shadow-lg shadow-brand-500/20 active:scale-95",
    secondary: "bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg border border-white/5",
    ghost: "text-gray-400 hover:text-white px-4 py-2 hover:bg-white/5 rounded-lg",
    icon: "p-2 rounded-full hover:bg-white/10 text-gray-300 hover:text-white active:scale-90",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-lg border border-red-500/20"
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const RatioBadge: React.FC<{ stats: UserStats }> = ({ stats }) => {
  const getColor = (r: number) => {
    if (r < 0.5) return 'text-red-500';
    if (r < 1.0) return 'text-yellow-500';
    if (r >= 2.0) return 'text-yellow-300'; // Gold
    return 'text-brand-400';
  };

  return (
    <div className={`flex items-center gap-3 bg-dark-highlight px-3 py-1.5 rounded-full border ${stats.ratio >= 2.0 ? 'border-yellow-500/30 bg-yellow-900/10' : 'border-white/5'}`}>
      <div className={`text-xs font-bold ${getColor(stats.ratio)}`}>
        R: {stats.ratio}
      </div>
      <div className="h-3 w-[1px] bg-white/10"></div>
      <div className={`text-xs flex items-center gap-1 ${stats.ratio >= 2.0 ? 'text-yellow-200' : 'text-gray-400'}`}>
        {stats.ratio >= 2.0 ? <Shield size={10} className="fill-current" /> : <Wifi size={10} />}
        {stats.reputation}
      </div>
    </div>
  );
};

const TrackRow: React.FC<{ 
  track: Track; 
  entry?: LibraryEntry; 
  isPlaying: boolean;
  onPlay: () => void;
  onExport: () => void;
}> = ({ track, entry, isPlaying, onPlay, onExport }) => {
  const status = entry?.status || 'REMOTE';
  
  return (
    <div 
      className={`group flex items-center gap-4 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors ${isPlaying ? 'bg-white/10' : ''}`}
    >
      <div onClick={onPlay} className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 cursor-pointer">
        <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
           {isPlaying ? <div className="w-3 h-3 bg-brand-500 rounded-full animate-pulse" /> : <Play size={16} className="text-white fill-current" />}
        </div>
      </div>
      
      <div onClick={onPlay} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
            <h3 className={`font-medium truncate ${isPlaying ? 'text-brand-400' : 'text-white'}`}>{track.title}</h3>
            {track.networkHealth < 20 && (
                <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 rounded border border-red-500/20">RARE</span>
            )}
        </div>
        <p className="text-sm text-gray-400 truncate">{track.artist}</p>
      </div>

      <div className="flex items-center gap-3">
        {status === 'SEEDING' && (
             <Button variant="icon" title="Export to Downloads" onClick={(e) => { e.stopPropagation(); onExport(); }}>
                 <Download size={14} />
             </Button>
        )}

        {status === 'SEEDING' ? (
          <div className="text-brand-500 flex items-center gap-1" title="Seeding from Vault">
             <Share2 size={16} />
             <span className="text-xs hidden sm:block">SEED</span>
          </div>
        ) : status === 'DOWNLOADING' ? (
          <div className="text-cyan-400 animate-pulse flex items-center gap-1">
             <Download size={16} />
             <span className="text-xs hidden sm:block">{entry?.progress ? Math.round(entry.progress * 100) : 0}%</span>
          </div>
        ) : (
          <div className="text-gray-600" title="Remote Source">
             <Globe size={16} />
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

function App() {
  const [user, setUser] = useState<UserType | null>(null);
  const [view, setView] = useState<ViewState>('DISCOVERY');
  
  // State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({});
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({ maxUsageGB: 2, evictionStrategy: 'SMART_RARITY', ghostSeeding: false });
  const [usageMB, setUsageMB] = useState(0);
  
  // Data - Real Gun.js Streams
  const [tracks, setTracks] = useState<Track[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  
  const [newPostContent, setNewPostContent] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'ALL' | 'SONG' | 'ALBUM' | 'ARTIST'>('ALL');
  const [searchResults, setSearchResults] = useState<{
      available: Track[],
      catalog: SearchResults
  }>({ available: [], catalog: { songs: [], albums: [], artists: [] } });

  // Creator Studio State
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Audio
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // Stats
  const [stats, setStats] = useState<UserStats>({
    downloadedBytes: 0,
    uploadedBytes: 0,
    ratio: 1.0,
    reputation: 'Member',
    credits: 100
  });

  // --- Auth Check ---
  useEffect(() => {
    getSession().then(session => {
        if (session) setUser(session);
    });
  }, []);

  // --- Initialization ---
  useEffect(() => {
    if (!user) return; // Only init if logged in

    const init = async () => {
       const initialLibrary: Record<string, LibraryEntry> = {};
       
       // Initialize Gun DB
       initDB();
       
       // Subscribe to Social Feed
       subscribeToPosts((post) => {
          setSocialPosts(prev => {
             if (prev.some(p => p.id === post.id)) return prev;
             return [post, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
          });
       });
       
       // Subscribe to Bounties
       subscribeToBounties((bounty) => {
           setBounties(prev => {
               if(prev.some(b => b.id === bounty.id)) return prev;
               return [bounty, ...prev];
           })
       });

       // Subscribe to Tracks (Discovery)
       subscribeToTracks((track) => {
           setTracks(prev => {
               if (prev.some(t => t.id === track.id)) return prev;
               return [track, ...prev];
           });
       });

       // Initialize WebTorrent
       initTorrentClient();
       
       // Load existing files from mock "Vault" logic
       setLibrary(initialLibrary);
    };
    init();

    // Setup Audio Listeners
    const audio = audioRef.current;
    audio.crossOrigin = "anonymous";

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    const onError = (e: Event) => {
        console.error("Audio playback error:", audio.error);
        setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [user]);

  // --- Real Torrent Stats Loop ---
  useEffect(() => {
      if(!user) return;
      const interval = setInterval(() => {
          // Monitor active torrents in library
          const downloading = Object.values(library).filter(e => e.status === 'DOWNLOADING' && e.localPath); // localPath stores magnet
          
          downloading.forEach(entry => {
              if(!entry.localPath) return;
              const stats = getTorrentStats(entry.localPath);
              if(stats) {
                  setLibrary(prev => {
                      const updated = { ...prev[entry.trackId], progress: stats.progress };
                      if(stats.progress >= 1) {
                          updated.status = 'SEEDING';
                      }
                      return { ...prev, [entry.trackId]: updated };
                  });
              }
          });

          // Update user stats roughly
          setStats(prev => ({
              ...prev,
              ratio: calculateRatio(prev.downloadedBytes + 1, prev.uploadedBytes) // Avoid div/0
          }));

      }, 1000);
      return () => clearInterval(interval);
  }, [library, user]);

  // --- Search Logic ---
  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!searchQuery.trim()) return;

      setIsSearching(true);
      setView('SEARCH_RESULTS');
      setSearchFilter('ALL');

      // 1. Search Global Catalog (MusicBrainz)
      const catalogResults = await searchGlobalCatalog(searchQuery);

      // 2. Cross-reference with Real Inventory (Gun.js Tracks)
      const localMatches: Track[] = [];

      catalogResults.songs.forEach(cat => {
          // Check loaded tracks for MBID or fuzzy title match
          const match = tracks.find(t => 
              (t.mbid === cat.mbid) || 
              (t.title.toLowerCase().includes(cat.title.toLowerCase()) && t.artist.toLowerCase().includes(cat.artist.toLowerCase()))
          );
          if (match) localMatches.push(match);
      });
      
      // Also add anything in tracks that matches the query directly
      tracks.forEach(t => {
          if (!localMatches.find(m => m.id === t.id) && (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()))) {
              localMatches.push(t);
          }
      });

      setSearchResults({
          available: localMatches,
          catalog: catalogResults
      });
      setIsSearching(false);
  };

  const handleRequestBounty = (item: GlobalCatalogEntry) => {
      // Create a bounty for this item
      createBounty(item.mbid, `${item.artist} - ${item.title}`, 100);
      alert(`Bounty created for "${item.title}"! Users who upload this will earn credits.`);
  };

  // --- Handlers ---

  const handleLogout = () => {
    logout();
    setUser(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    audioRef.current.pause();
    audioRef.current.src = "";
  };

  const handlePlay = async (track: Track) => {
    try {
        setLibrary(prev => {
            const entry = prev[track.id];
            if (entry) return { ...prev, [track.id]: { ...entry, lastPlayed: Date.now() }};
            return prev;
        });

        const audio = audioRef.current;

        // SAME TRACK TOGGLE
        if (currentTrack?.id === track.id) {
            if (isPlaying) { 
                audio.pause(); 
                setIsPlaying(false); 
            } else { 
                await audio.play();
                setIsPlaying(true);
            }
            return;
        }

        // NEW TRACK
        setIsPlaying(false);
        audio.pause();
        setCurrentTrack(track);

        // Check if we have it locally (via Vault or Torrent cache)
        const localUrl = await loadFromVault(track.id);
        
        if (localUrl) {
            if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
            audio.src = localUrl;
            audio.load();
            audio.play().then(() => setIsPlaying(true));
            return;
        }

        // If not local, try WebTorrent streaming
        if(track.audioUrl.startsWith('magnet:')) {
             setLibrary(prev => ({
                ...prev,
                [track.id]: { trackId: track.id, status: 'DOWNLOADING', progress: 0, addedAt: Date.now(), lastPlayed: Date.now(), localPath: track.audioUrl }
            }));
            
            try {
                const { file, url } = await addTorrent(track.audioUrl, (prog, speed) => {
                    // Progress handled by effect loop
                });
                audio.src = url;
                audio.play().then(() => setIsPlaying(true));
            } catch(err) {
                console.error("Torrent stream failed", err);
            }
        } else {
            // Standard HTTP fallback (Legacy/Web2 mode)
            audio.src = track.audioUrl;
            audio.play().then(() => setIsPlaying(true));
        }

    } catch (err) {
        console.error("HandlePlay Error:", err);
    }
  };

  const handleEvictionCheck = async () => {
    const deleted = await runSmartEviction(library, tracks, storageConfig, usageMB);
    if (deleted.length > 0) {
        setLibrary(prev => {
            const next = { ...prev };
            deleted.forEach(id => delete next[id]);
            return next;
        });
        alert(`Smart Eviction ran! Freed space by deleting ${deleted.length} tracks.`);
        setUsageMB(u => Math.max(0, u - (deleted.length * 5)));
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPostContent.trim() || !user) return;
      await publishPost(user.username, newPostContent, currentTrack?.id);
      setNewPostContent('');
  };

  // Called after UploadZone completes identification
  const handleIdentifiedUpload = async (file: File, metadata: DetailedMetadata) => {
      if (!user) return;
      setUploadStatus('Initializing Swarm...');
      
      try {
          // Normalize before seeding (Phase 2 Audio Engine)
          const analysis = await analyzeAudio(file);
          // const processedBlob = await normalizeAndTranscode(analysis.buffer); // skipped for speed in this demo step

          // Seed via WebTorrent to get Magnet URI
          const magnet = await seedFile(file, `[BitBeats] ${metadata.artist} - ${metadata.title}`);
          
          setUploadStatus(`Seeding Active! Magnet: ${magnet.substring(0, 20)}...`);
          
          // Publish Metadata to Gun.js (Real Inventory)
          const newTrack: Partial<Track> = {
              mbid: metadata.mbid, 
              title: metadata.title,
              artist: metadata.artist,
              album: metadata.album,
              coverUrl: metadata.coverUrl,
              duration: analysis.duration,
              audioUrl: magnet,
              license: 'CC-BY',
              size: file.size / 1024 / 1024,
              tags: metadata.tags || ['p2p', 'upload'],
              bpm: 120, // Placeholder
              networkHealth: 100,
              artistSignature: 'pending_sig'
          };

          await publishTrackMetadata(newTrack);

          // Add to local library
          // We don't have the Gun ID yet until subscription fires, but we can optimistically add or wait.
          // For now, we wait for the subscription to update `tracks` state.
          
          alert("Track published to the P2P Network!");
          setView('LIBRARY');
          setUploadStatus('');

      } catch (err) {
          console.error(err);
          setUploadStatus('Seeding failed.');
      }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: ViewState, icon: any, label: string }) => (
    <button 
      onClick={() => setView(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === id ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  const CatalogCard = ({ item }: { item: GlobalCatalogEntry }) => {
     // Determine icon and legend based on type
     let Icon = Music;
     let legend = "Song";
     
     if (item.type === 'album') { Icon = Disc; legend = "Album"; }
     if (item.type === 'artist') { Icon = Mic; legend = "Artist"; }

     return (
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3 hover:bg-white/10 transition-colors h-full">
            <div className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center relative overflow-hidden group">
                 {/* Placeholder Icon System since we don't have Cover Art Archive in this PoC */}
                 <Icon size={40} className="text-gray-600" />
                 
                 {/* Legend / Badge */}
                 <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-gray-300 border border-white/10 flex items-center gap-1 uppercase tracking-wider">
                     <Icon size={10} /> {legend}
                 </div>
                 
                 {/* Request Button Overlay */}
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <Button variant="secondary" className="text-xs scale-90" onClick={() => handleRequestBounty(item)}>
                         Request
                     </Button>
                 </div>
            </div>
            
            <div className="min-w-0">
                <h3 className="font-bold text-gray-200 truncate" title={item.title}>{item.title}</h3>
                <p className="text-sm text-gray-500 truncate">{item.artist}</p>
                {item.year && <p className="text-xs text-gray-600 mt-1">{item.year}</p>}
            </div>
        </div>
     );
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: typeof searchFilter, label: string, icon: any }) => (
      <button 
        onClick={() => setSearchFilter(type)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${searchFilter === type ? 'bg-brand-500 text-black border-brand-500 font-bold' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
      >
          <Icon size={16} />
          {label}
      </button>
  );

  if (!user) {
    return <AuthScreen onLogin={setUser} />;
  }

  return (
    <div className="flex flex-col h-screen bg-dark-bg text-gray-200 overflow-hidden font-sans select-none">
      
      {/* --- Top Bar --- */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-dark-bg/95 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 text-brand-500">
           <Disc size={28} className={isPlaying ? "animate-spin-slow" : ""} />
           <span className="text-xl font-bold tracking-tight text-white hidden sm:block">BitBeats <span className="text-xs text-gray-500 font-normal ml-1">v3.0</span></span>
        </div>

        {/* SEARCH BAR */}
        <div className="flex-1 max-w-xl mx-6">
            <form onSubmit={handleSearch} className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search MusicBrainz (Global Catalog)..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-all"
                />
            </form>
        </div>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex items-center gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                    <HardDrive size={14} />
                    <span>{usageMB.toFixed(1)} MB / {storageConfig.maxUsageGB} GB</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-500/80 bg-yellow-500/10 px-3 py-1 rounded-full">
                    <Zap size={14} />
                    <span>{stats.credits} Credits</span>
                </div>
           </div>
           <RatioBadge stats={stats} />
        </div>
      </header>

      {/* --- Layout --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-dark-surface hidden md:flex flex-col border-r border-white/5 p-4">
           
           <div className="mb-6 px-4 py-2 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-black font-bold text-xs">
                  {user.username.substring(0,2).toUpperCase()}
                </div>
                <div className="truncate">
                  <div className="text-sm font-bold text-white truncate">{user.username}</div>
                  <div className="text-[10px] text-gray-500 truncate">{user.handle}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-white" title="Logout">
                <LogOut size={16} />
              </button>
           </div>

           <nav className="space-y-1">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-4">Browse</div>
             <NavItem id="DISCOVERY" icon={Radio} label="Discovery" />
             <NavItem id="BOUNTIES" icon={Zap} label="Bounty Board" />
             <NavItem id="SWARM" icon={Users} label="Swarm Social" />
             
             <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-3 px-4">My Collection</div>
             <NavItem id="LIBRARY" icon={Library} label="The Vault" />
             <NavItem id="STUDIO" icon={Mic2} label="Creator Studio" />
           </nav>
           
           <div className="mt-auto pt-6 border-t border-white/10">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4">
                 <div className="flex items-center gap-2 mb-2 text-white font-bold text-sm">
                    <Activity size={16} className="text-brand-500" /> LAN Sync
                 </div>
                 <p className="text-xs text-gray-400 mb-3">DHT Active. 4 Public Trackers connected.</p>
                 <div className="flex gap-1 justify-center">
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                 </div>
              </div>
           </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-dark-bg relative pb-32">
           
           {/* SEARCH RESULTS VIEW */}
           {view === 'SEARCH_RESULTS' && (
             <div className="p-8 max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-white mb-6">Search Results: "{searchQuery}"</h1>

                {/* Filter Widgets */}
                <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    <FilterButton type="ALL" label="All" icon={Layers} />
                    <FilterButton type="SONG" label="Songs" icon={Music} />
                    <FilterButton type="ALBUM" label="Albums" icon={Disc} />
                    <FilterButton type="ARTIST" label="Artists" icon={Mic} />
                </div>

                {isSearching ? (
                   <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
                   </div>
                ) : (
                   <div className="space-y-12">
                       
                       {/* 1. INVENTORY (P2P Swarm) - Always prioritized */}
                       {searchResults.available.length > 0 && (searchFilter === 'ALL' || searchFilter === 'SONG') && (
                           <div>
                               <div className="flex items-center gap-3 mb-4">
                                   <h2 className="text-xl font-bold text-brand-500 flex items-center gap-2">
                                       <Check size={20} /> Available in Inventory
                                   </h2>
                                   <span className="bg-brand-500/20 text-brand-400 text-xs px-2 py-0.5 rounded font-mono">P2P Ready</span>
                               </div>
                               
                               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                   {searchResults.available.map(track => (
                                      <div key={track.id} className="group cursor-pointer bg-white/5 p-3 rounded-xl border border-brand-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)]" onClick={() => handlePlay(track)}>
                                         <div className="aspect-square rounded-lg overflow-hidden mb-3 relative bg-gray-800">
                                            <img src={track.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center">
                                                <div className="bg-brand-500 text-black rounded-full p-2 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                                                    <Play size={20} fill="currentColor" />
                                                </div>
                                            </div>
                                         </div>
                                         <h3 className="font-bold text-white truncate text-sm">{track.title}</h3>
                                         <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                                         <Button variant="primary" className="w-full mt-3 h-8 text-xs">Play Now</Button>
                                      </div>
                                   ))}
                               </div>
                               <div className="border-t border-white/10 mt-12"></div>
                           </div>
                       )}

                       {/* 2. VITRINE (Global Catalog) */}
                       
                       {/* SONGS SECTION */}
                       {(searchFilter === 'ALL' || searchFilter === 'SONG') && (
                         <div>
                            <div className="flex items-center justify-between mb-4">
                               <h2 className="text-xl font-bold text-white flex items-center gap-2"><Music size={20} /> Songs</h2>
                               {searchFilter === 'ALL' && searchResults.catalog.songs.length > 6 && (
                                   <button onClick={() => setSearchFilter('SONG')} className="text-xs text-brand-500 hover:text-brand-400 font-bold">...More</button>
                               )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {(searchFilter === 'ALL' ? searchResults.catalog.songs.slice(0, 6) : searchResults.catalog.songs).map(item => (
                                    <CatalogCard key={item.mbid} item={item} />
                                ))}
                            </div>
                            {searchResults.catalog.songs.length === 0 && <p className="text-gray-500 italic text-sm">No songs found in global catalog.</p>}
                         </div>
                       )}

                       {/* ALBUMS SECTION */}
                       {(searchFilter === 'ALL' || searchFilter === 'ALBUM') && (
                         <div>
                            <div className="flex items-center justify-between mb-4">
                               <h2 className="text-xl font-bold text-white flex items-center gap-2"><Disc size={20} /> Albums</h2>
                               {searchFilter === 'ALL' && searchResults.catalog.albums.length > 3 && (
                                   <button onClick={() => setSearchFilter('ALBUM')} className="text-xs text-brand-500 hover:text-brand-400 font-bold">...More</button>
                               )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {(searchFilter === 'ALL' ? searchResults.catalog.albums.slice(0, 3) : searchResults.catalog.albums).map(item => (
                                    <CatalogCard key={item.mbid} item={item} />
                                ))}
                            </div>
                            {searchResults.catalog.albums.length === 0 && <p className="text-gray-500 italic text-sm">No albums found in global catalog.</p>}
                         </div>
                       )}

                       {/* ARTISTS SECTION */}
                       {(searchFilter === 'ALL' || searchFilter === 'ARTIST') && (
                         <div>
                            <div className="flex items-center justify-between mb-4">
                               <h2 className="text-xl font-bold text-white flex items-center gap-2"><Mic size={20} /> Artists</h2>
                               {searchFilter === 'ALL' && searchResults.catalog.artists.length > 3 && (
                                   <button onClick={() => setSearchFilter('ARTIST')} className="text-xs text-brand-500 hover:text-brand-400 font-bold">...More</button>
                               )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {(searchFilter === 'ALL' ? searchResults.catalog.artists.slice(0, 3) : searchResults.catalog.artists).map(item => (
                                    <CatalogCard key={item.mbid} item={item} />
                                ))}
                            </div>
                             {searchResults.catalog.artists.length === 0 && <p className="text-gray-500 italic text-sm">No artists found in global catalog.</p>}
                         </div>
                       )}

                   </div>
                )}
             </div>
           )}

           {/* DISCOVERY VIEW */}
           {view === 'DISCOVERY' && (
             <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Discover</h1>
                        <p className="text-gray-400">P2P Network Content.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-brand-500 bg-brand-500/10 border border-brand-500/20 px-2 py-1 rounded">DECENTRALIZED</span>
                        <p className="text-sm text-gray-500 mt-1">Files streamed directly from peers.</p>
                    </div>
                </div>

                {tracks.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <div className="mb-4 text-4xl">🕸️</div>
                        <p>Waiting for peers...</p>
                        <p className="text-sm">Be the first to seed content in the Studio!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {tracks.map(track => (
                        <div key={track.id} className="group cursor-pointer" onClick={() => handlePlay(track)}>
                            <div className="aspect-square rounded-xl overflow-hidden mb-3 relative shadow-2xl bg-gray-800">
                                <img src={track.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                {/* Network Health Indicator */}
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
                                    <Activity size={10} className={track.networkHealth > 80 ? "text-green-400" : "text-red-400"} />
                                    {track.networkHealth}% Avail
                                </div>
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                <div className="bg-white text-black rounded-full p-3 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all shadow-xl">
                                    <Play size={24} fill="currentColor" />
                                </div>
                                </div>
                            </div>
                            <h3 className="font-bold text-white truncate">{track.title}</h3>
                            <p className="text-sm text-gray-500 truncate">{track.artist}</p>
                        </div>
                    ))}
                    </div>
                )}
             </div>
           )}

           {/* BOUNTIES VIEW */}
           {view === 'BOUNTIES' && (
              <div className="p-8 max-w-4xl mx-auto">
                  <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-8 mb-8 border border-yellow-500/20">
                      <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                          <Zap className="text-yellow-500" /> Bounty Board
                      </h1>
                      <p className="text-gray-300 max-w-xl">
                          Request rare tracks using your Credits. When a Seeder fulfills the request, they earn the bounty.
                          This keeps the ecosystem healthy.
                      </p>
                  </div>

                  <div className="space-y-4">
                      {bounties.length === 0 && <p className="text-gray-500 text-center">No active bounties. Check back later.</p>}
                      {bounties.map(bounty => (
                          <div key={bounty.id} className="bg-white/5 border border-white/5 rounded-xl p-5 flex items-center justify-between hover:border-white/10 transition-colors">
                              <div>
                                  <div className="flex items-center gap-3 mb-1">
                                      <h3 className="font-bold text-lg text-white">{bounty.query}</h3>
                                      {bounty.status === 'FULFILLED' ? (
                                          <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/20">FULFILLED</span>
                                      ) : (
                                          <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/20">OPEN</span>
                                      )}
                                      {bounty.mbid && (
                                          <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded border border-gray-600">MBID Linked</span>
                                      )}
                                  </div>
                                  <p className="text-sm text-gray-400">{bounty.requesterCount} users requesting this</p>
                              </div>
                              <div className="flex items-center gap-4">
                                  <div className="text-right">
                                      <div className="text-xl font-bold text-yellow-500">{bounty.reward} CR</div>
                                      <div className="text-xs text-gray-500">Total Reward</div>
                                  </div>
                                  <Button variant={bounty.status === 'OPEN' ? 'primary' : 'secondary'} disabled={bounty.status === 'FULFILLED'}>
                                      {bounty.status === 'OPEN' ? 'Contribute' : 'Closed'}
                                  </Button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
           )}

           {/* SWARM SOCIAL VIEW */}
           {view === 'SWARM' && (
               <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2">
                       <h2 className="text-2xl font-bold text-white mb-6">Active Listen Parties</h2>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                           {MOCK_PARTIES.map(party => (
                               <div key={party.id} className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
                                   <div className="absolute top-0 right-0 p-3">
                                       <span className="flex items-center gap-1 text-xs text-red-400 font-bold animate-pulse">
                                           <Activity size={12} /> LIVE
                                       </span>
                                   </div>
                                   <h3 className="font-bold text-white text-lg">{party.host}'s Room</h3>
                                   <p className="text-sm text-gray-400 mb-4">Playing: {tracks.find(t=>t.id === party.currentTrackId)?.title}</p>
                                   <div className="flex items-center justify-between">
                                       <div className="flex -space-x-2">
                                           {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-gray-700 border-2 border-dark-bg"></div>)}
                                           <div className="w-8 h-8 rounded-full bg-gray-800 border-2 border-dark-bg flex items-center justify-center text-xs text-gray-400">+{party.participants}</div>
                                       </div>
                                       <Button variant="secondary" className="text-xs px-3 py-1">Join Sync</Button>
                                   </div>
                               </div>
                           ))}
                       </div>

                       <div className="flex items-center justify-between mb-4">
                         <h2 className="text-2xl font-bold text-white">Swarm Chatter</h2>
                         <div className="text-xs text-gray-500 flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                           P2P Mesh Active (Gun.js)
                         </div>
                       </div>
                       
                       {/* Chat Input */}
                       <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-6">
                           <form onSubmit={handlePostSubmit} className="flex gap-4">
                               <div className="flex-1">
                                   <input 
                                     type="text" 
                                     value={newPostContent}
                                     onChange={(e) => setNewPostContent(e.target.value)}
                                     placeholder={`Say something to the swarm, ${user.username}...`}
                                     className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-brand-500/50"
                                   />
                               </div>
                               <Button variant="primary" type="submit" disabled={!newPostContent.trim()}>
                                   <Send size={16} />
                               </Button>
                           </form>
                       </div>

                       <div className="space-y-4">
                           {socialPosts.length === 0 && <p className="text-gray-500 text-center py-8">No messages yet. Be the first!</p>}
                           {socialPosts.map(post => (
                               <div key={post.id} className="bg-white/5 rounded-xl p-4 border border-white/5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                   <div className="flex justify-between mb-2">
                                       <span className="font-bold text-brand-400 text-sm">@{post.author}</span>
                                       <span className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                   </div>
                                   <p className="text-gray-300 text-sm">{post.content}</p>
                                   {post.trackId && (
                                       <div className="mt-3 bg-black/20 p-2 rounded flex items-center gap-3">
                                            <Disc size={16} className="text-gray-500" />
                                            <span className="text-xs text-gray-400">Referencing: {tracks.find(t => t.id === post.trackId)?.title || 'Unknown Track'}</span>
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                   </div>

                   <div className="bg-dark-surface rounded-2xl p-6 border border-white/5 h-fit">
                       <h3 className="font-bold text-white mb-4">Friends Online</h3>
                       <div className="space-y-3">
                           {[1,2,3,4].map(i => (
                               <div key={i} className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-gray-700 relative">
                                       <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-dark-surface"></div>
                                   </div>
                                   <div className="flex-1">
                                       <p className="text-sm text-white font-medium">User_{Math.floor(Math.random()*999)}</p>
                                       <p className="text-xs text-gray-500">Listening to Synthwave...</p>
                                   </div>
                               </div>
                           ))}
                       </div>
                       <Button variant="primary" className="w-full mt-6">Invite Friends</Button>
                   </div>
               </div>
           )}

           {/* LIBRARY (VAULT) */}
           {view === 'LIBRARY' && (
             <div className="p-8 max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-3xl font-bold text-white">My Vault</h1>
                  <div className="flex gap-2">
                      <Button variant="secondary" onClick={handleEvictionCheck} title="Run Cleanup">
                          <Trash2 size={16} /> Cleanup
                      </Button>
                  </div>
                </div>

                <div className="bg-dark-surface rounded-xl p-6 mb-8 border border-white/5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                        <Settings size={14} /> Storage Configuration
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-white">Max Storage: {storageConfig.maxUsageGB} GB</span>
                                <span className="text-gray-500">{Math.round((usageMB / (storageConfig.maxUsageGB * 1024)) * 100)}% Used</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500" style={{ width: `${(usageMB / (storageConfig.maxUsageGB * 1024)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white font-medium">Smart Eviction (Rarity-Based)</p>
                                <p className="text-xs text-gray-500">Automatically delete common files first, preserve rare files.</p>
                            </div>
                            <div className="bg-brand-500/20 px-3 py-1 rounded text-brand-400 text-xs font-bold border border-brand-500/20">ACTIVE</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                   {Object.values(library).map(entry => {
                      const track = tracks.find(t => t.id === entry.trackId);
                      if (!track) return null;
                      return (
                        <TrackRow 
                            key={track.id} 
                            track={track} 
                            entry={entry}
                            isPlaying={currentTrack?.id === track.id && isPlaying}
                            onPlay={() => handlePlay(track)}
                            onExport={() => exportTrack(track.id, track.title)}
                        />
                      );
                   })}
                </div>
             </div>
           )}

           {/* STUDIO VIEW */}
           {view === 'STUDIO' && (
               <div className="p-8 max-w-3xl mx-auto text-center">
                   <div className="mb-8">
                       <div className="w-20 h-20 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-500/20">
                           <Mic2 size={32} className="text-brand-500" />
                       </div>
                       <h1 className="text-3xl font-bold text-white mb-2">Creator Studio</h1>
                       <p className="text-gray-400">Upload your tracks. Phase 2 Audio Engine will fingerprint and normalize them.</p>
                   </div>
                   
                   {/* NEW: UploadZone replaces manual file input */}
                   <UploadZone onSuccess={handleIdentifiedUpload} />

                   {uploadStatus && (
                      <div className="mt-8 p-4 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400 font-bold animate-pulse">
                         {uploadStatus}
                      </div>
                   )}
                   
                   <div className="mt-8 text-left bg-dark-surface p-6 rounded-xl border border-white/5">
                       <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Shield size={16} className="text-green-500" /> Identity Management</h3>
                       <div className="flex items-center justify-between bg-black/30 p-4 rounded-lg">
                           <div>
                               <p className="text-xs text-gray-500 uppercase">Your Public Key</p>
                               <p className="font-mono text-sm text-brand-400">{user.id.substring(0, 24)}...</p>
                           </div>
                           <Button variant="secondary" className="text-xs">Export Key</Button>
                       </div>
                   </div>
               </div>
           )}

        </main>
      </div>

      {/* --- Persistent Player --- */}
      <div className="h-24 bg-[#18181b] border-t border-white/5 px-4 md:px-8 flex items-center justify-between z-30 fixed bottom-0 left-0 right-0 shadow-2xl">
         <div className="flex items-center gap-4 w-1/3">
            {currentTrack ? (
              <>
                <img src={currentTrack.coverUrl} className="w-14 h-14 rounded-md shadow-lg bg-gray-800" />
                <div className="hidden sm:block">
                   <h4 className="text-white font-medium truncate max-w-[150px]">{currentTrack.title}</h4>
                   <div className="flex items-center gap-2">
                       <p className="text-xs text-gray-400">{currentTrack.artist}</p>
                       <span className="text-[9px] bg-white/10 px-1 rounded text-gray-400 border border-white/10">
                           {currentTrack.audioUrl.startsWith('magnet') ? 'P2P' : 'HTTP'}
                       </span>
                   </div>
                </div>
              </>
            ) : (
                <div className="flex items-center gap-3 opacity-50">
                    <div className="w-14 h-14 bg-white/10 rounded-md"></div>
                </div>
            )}
         </div>

         <div className="flex flex-col items-center w-1/3">
            <div className="flex items-center gap-6 mb-2">
               <button className="text-gray-400 hover:text-white transition-colors"><SkipBack size={20} /></button>
               <button 
                 onClick={() => currentTrack && handlePlay(currentTrack)}
                 className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all shadow-lg shadow-white/10"
                 disabled={!currentTrack}
               >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
               </button>
               <button className="text-gray-400 hover:text-white transition-colors"><SkipForward size={20} /></button>
            </div>
            <div className="w-full max-w-md flex items-center gap-3 text-xs text-gray-400 font-mono">
               <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2,'0')}</span>
               <div className="flex-1 h-1 bg-gray-700 rounded-full relative group cursor-pointer">
                  {currentTrack && (
                     <div 
                       className="absolute h-full bg-gray-500 rounded-full opacity-50 transition-all duration-1000"
                       style={{ width: `${library[currentTrack.id]?.progress ? library[currentTrack.id]?.progress * 100 : 0}%` }} 
                     />
                  )}
                  <div 
                     className="absolute h-full bg-brand-500 rounded-full"
                     style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  ></div>
               </div>
               <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2,'0')}</span>
            </div>
         </div>

         <div className="flex items-center justify-end gap-3 w-1/3">
             <div className="hidden md:flex items-center gap-2 text-brand-500 bg-brand-500/10 px-3 py-1 rounded-full text-xs font-bold border border-brand-500/20">
               <div className="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
               {currentTrack && library[currentTrack.id]?.status === 'SEEDING' ? 'SEEDING' : 'NET OK'}
             </div>
             <Volume2 size={20} className="text-gray-400 hidden sm:block" />
         </div>
      </div>

    </div>
  );
}

export default App;
