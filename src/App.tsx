import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { 
  Play, Pause, SkipForward, SkipBack, Search, Library, 
  Wifi, HardDrive, Share2, Download, Radio, Volume2, User, 
  Disc, Users, Zap, Shield, Mic2, Settings, Trash2, Heart,
  Globe, Activity, LogOut, Send, MessageSquare, Check, X, FileAudio,
  Database, AlertCircle, Music, Layers, Mic, Tag, ArrowDown, Loader
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Track, LibraryEntry, UserStats, StorageConfig, User as UserType, SocialPost, GlobalCatalogEntry, Bounty, ListenParty } from './types.ts';
import { saveToVault, loadFromVault, checkVaultStatus, getStoredBytes, runSmartEviction, exportTrack, opfsSupported } from './services/storage.ts';
import { getReputation, discoverLocalPeers, signUpload } from './services/p2pNetwork.ts';
import { initDB, subscribeToPosts, publishPost, createBounty, subscribeToBounties, publishTrackMetadata, subscribeToTracks, subscribeToParties, subscribeToCredits, createParty } from './services/db.ts';
import { initTorrentClient, seedFile, addTorrent } from './services/torrent.ts';
import { analyzeAudio, normalizeAndTranscode } from './services/audioEngine.ts';
import { searchGlobalCatalog } from './services/musicBrainz.ts';
import type { SearchResults, DetailedMetadata } from './services/musicBrainz.ts';
import { identifyTrack } from './services/identification.ts';
import { AuthScreen } from './AuthScreen.tsx';
import { getSession, logout } from './services/auth.ts';
import { ArtistPage } from './pages/ArtistPage.tsx';
import { AlbumPage } from './pages/AlbumPage.tsx';
import { LibraryDashboard } from './pages/LibraryDashboard.tsx';
import { DiscoveryPage } from './pages/DiscoveryPage.tsx';
import { LikeButton } from './components/LikeButton.tsx';
import { LibraryArtists } from './pages/LibraryArtists.tsx';
import { LibraryAlbums } from './pages/LibraryAlbums.tsx';
import { LibraryTracks } from './pages/LibraryTracks.tsx';
import { CoverImage } from './components/ui/CoverImage.tsx';

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
    <button className={twMerge(base, variants[variant], className)} {...props}>
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

const CatalogCard: React.FC<{ item: GlobalCatalogEntry, onRequest: (item: GlobalCatalogEntry) => void }> = ({ item, onRequest }) => {
     let Icon = Music;
     let legend = "Song";
     let linkPath = ""; 
     
     if (item.type === 'album') { Icon = Disc; legend = "Album"; linkPath = `/album/${item.mbid}`; }
     if (item.type === 'artist') { Icon = Mic; legend = "Artist"; linkPath = `/artist/${item.mbid}`; }

     const content = (
        <>
            <div className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center relative overflow-hidden group">
                 <CoverImage 
                    mbid={item.mbid} 
                    fallbackSrc={item.coverUrl}
                    type={item.type as any}
                    size="small"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                 />
                 <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-gray-300 border border-white/10 flex items-center gap-1 uppercase tracking-wider">
                     <Icon size={10} /> {legend}
                 </div>
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                     {/* If it's a song, we request/play. If album/artist, we view. */}
                     {item.type === 'song' ? (
                        <Button variant="secondary" className="text-xs scale-90" onClick={(e) => { e.preventDefault(); onRequest(item); }}>
                            Request
                        </Button>
                     ) : (
                        <div className="text-white text-xs font-bold border border-white rounded-full px-4 py-1">View</div>
                     )}
                 </div>
            </div>
            <div className="min-w-0">
                <h3 className="font-bold text-gray-200 truncate" title={item.title}>{item.title}</h3>
                <p className="text-sm text-gray-500 truncate">{item.artist}</p>
                {item.year && <p className="text-xs text-gray-600 mt-1">{item.year}</p>}
            </div>
        </>
     );

     // Wrap in Link if navigable
     if (linkPath) {
         return (
             <Link to={linkPath} className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3 hover:bg-white/10 transition-colors h-full">
                 {content}
             </Link>
         )
     }

     return (
        <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3 hover:bg-white/10 transition-colors h-full">
            {content}
        </div>
     );
};

// --- Main App ---

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
  
  // State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({});
  const [storageConfig, setStorageConfig] = useState<StorageConfig>({ maxUsageGB: 2, evictionStrategy: 'SMART_RARITY', ghostSeeding: false });
  const [usageMB, setUsageMB] = useState(0);
  const [activePeers, setActivePeers] = useState(0);
  
  // Data - Real Gun.js Streams
  const [tracks, setTracks] = useState<Track[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [activeParties, setActiveParties] = useState<ListenParty[]>([]);
  
  const [newPostContent, setNewPostContent] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'ALL' | 'SONG' | 'ALBUM' | 'ARTIST'>('ALL');
  const [searchResults, setSearchResults] = useState<{
      available: Track[],
      catalog: SearchResults
  }>({ available: [], catalog: { songs: [], albums: [], artists: [] } });

  // Audio
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // Seeking
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Stats
  const [stats, setStats] = useState<UserStats>({
    downloadedBytes: 0,
    uploadedBytes: 0,
    ratio: 1.0,
    reputation: 'Member',
    credits: 0
  });

  // --- Auth Check ---
  useEffect(() => {
    getSession().then(session => {
        if (session) setUser(session);
    });
  }, []);

  // --- PWA Install Prompt ---
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        } else {
          console.log('User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  // --- Search Deep Linking ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const type = params.get('type');
    const q = params.get('q');
    if (type && ['ALL','SONG','ALBUM','ARTIST'].includes(type)) {
       setSearchFilter(type as any);
    }
    if (q) setSearchQuery(q);
  }, [location.search]);

  // --- Initialization ---
  useEffect(() => {
    if (!user) return; // Only init if logged in

    const init = async () => {
       const initialLibrary: Record<string, LibraryEntry> = {};
       initDB();
       subscribeToPosts((post) => {
          setSocialPosts(prev => {
             if (prev.some(p => p.id === post.id)) return prev;
             return [post, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
          });
       });
       subscribeToBounties((bounty) => {
           setBounties(prev => {
               if(prev.some(b => b.id === bounty.id)) return prev;
               return [bounty, ...prev];
           })
       });
       subscribeToTracks((track) => {
           setTracks(prev => {
               if (prev.some(t => t.id === track.id)) return prev;
               return [track, ...prev];
           });
       });
       subscribeToParties((party) => {
          setActiveParties(prev => {
             if (prev.some(p => p.id === party.id)) return prev;
             return [party, ...prev];
          });
       });
       subscribeToCredits(user.id, (credits) => {
          setStats(s => ({ ...s, credits }));
       });
       initTorrentClient();
       const peers = await discoverLocalPeers();
       setActivePeers(peers);
       setLibrary(initialLibrary);
    };
    init();

    const audio = audioRef.current;
    audio.crossOrigin = "anonymous";

    const updateTime = () => {
        if (!isDraggingRef.current) setCurrentTime(audio.currentTime);
    };
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

  // --- Main Logic & Handlers ---

  const handleSeekStart = (e: React.MouseEvent) => {
      if (!duration) return;
      isDraggingRef.current = true;

      const updateSeek = (clientX: number) => {
          if (!progressBarRef.current) return;
          const rect = progressBarRef.current.getBoundingClientRect();
          const x = clientX - rect.left;
          const width = rect.width;
          const percentage = Math.max(0, Math.min(1, x / width));
          setCurrentTime(percentage * duration);
      };

      updateSeek(e.clientX);

      const handleMouseMove = (moveEvent: MouseEvent) => {
          moveEvent.preventDefault();
          updateSeek(moveEvent.clientX);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
          isDraggingRef.current = false;
          if (!progressBarRef.current) return;
          
          const rect = progressBarRef.current.getBoundingClientRect();
          const x = upEvent.clientX - rect.left;
          const width = rect.width;
          const percentage = Math.max(0, Math.min(1, x / width));
          const finalTime = percentage * duration;
          
          if (audioRef.current) {
              audioRef.current.currentTime = finalTime;
          }
          
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
  };

  const handleLocalImport = async (file: File, metadata: DetailedMetadata) => {
      if (!user) return;
      console.log("📥 Starting Local Import:", metadata.title);
      
      try {
          // 1. Analyze & Normalize
          const analysis = await analyzeAudio(file);
          const processedBlob = await normalizeAndTranscode(analysis.buffer);
          const processedFile = new File([processedBlob], `${metadata.artist} - ${metadata.title}.wav`, { type: 'audio/wav' });

          // 2. Cryptographic Signing
          const signature = await signUpload(processedFile, `hash_${analysis.fingerprint}`);

          // 3. Seed to DHT (This gives us the Magnet URI)
          const magnet = await seedFile(processedFile, `[BitBeats] ${metadata.artist} - ${metadata.title}`);
          
          // 4. Construct Track Object
          const newTrack: Partial<Track> = {
              mbid: metadata.mbid, 
              title: metadata.title,
              artist: metadata.artist,
              album: metadata.album,
              coverUrl: metadata.coverUrl,
              duration: analysis.duration,
              audioUrl: magnet,
              license: 'CC-BY',
              size: processedFile.size / 1024 / 1024,
              tags: metadata.tags || ['p2p', 'upload'],
              bpm: 120, 
              networkHealth: 100,
              artistSignature: signature
          };

          // 5. Publish Metadata to Gun.js Swarm
          await publishTrackMetadata(newTrack);

          // 6. Save to Local Vault (OPFS) immediately
          // Note: publishTrackMetadata creates the ID but we need it here. 
          // Ideally we generate ID first. For now, we wait for the track to appear in `tracks` state via subscription, 
          // OR we can manually add it to library with the magnet as ID for now until synced.
          // BUT, `saveToVault` needs an ID. 
          
          // Let's manually generate an ID to ensure instant local availability
          const tempId = `local_${Date.now()}`;
          const arrayBuffer = await processedBlob.arrayBuffer();
          await saveToVault(tempId, arrayBuffer); // Save normalized audio

          // Update Library State Optimistically
          setLibrary(prev => ({
              ...prev,
              [tempId]: {
                  trackId: tempId,
                  status: 'SEEDING',
                  progress: 1,
                  localPath: magnet, // store magnet as path ref
                  lastPlayed: Date.now(),
                  addedAt: Date.now()
              }
          }));

          // We also need to add the track to the tracks list locally so it shows up in UI
          const trackWithId = { ...newTrack, id: tempId } as Track;
          setTracks(prev => [trackWithId, ...prev]);

          alert("Import successful! Track saved to Vault and seeding to Swarm.");

      } catch (err) {
          console.error("Import Failed", err);
          alert("Import failed. See console.");
      }
  };

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!searchQuery.trim()) return;

      setIsSearching(true);
      navigate(`/search?q=${searchQuery}`);
      setSearchFilter('ALL');

      const catalogResults = await searchGlobalCatalog(searchQuery, 0, 'ALL');
      const localMatches: Track[] = [];

      catalogResults.songs.forEach(cat => {
          const match = tracks.find(t => 
              (t.mbid === cat.mbid) || 
              (t.title.toLowerCase().includes(cat.title.toLowerCase()) && t.artist.toLowerCase().includes(cat.artist.toLowerCase()))
          );
          if (match) localMatches.push(match);
      });
      
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

  const handleLoadMore = async () => {
      if (isLoadingMore || searchFilter === 'ALL') return;
      setIsLoadingMore(true);

      let offset = 0;
      if (searchFilter === 'SONG') offset = searchResults.catalog.songs.length;
      if (searchFilter === 'ALBUM') offset = searchResults.catalog.albums.length;
      if (searchFilter === 'ARTIST') offset = searchResults.catalog.artists.length;

      const moreResults = await searchGlobalCatalog(searchQuery, offset, searchFilter);

      setSearchResults(prev => ({
          ...prev,
          catalog: {
              songs: searchFilter === 'SONG' ? [...prev.catalog.songs, ...moreResults.songs] : prev.catalog.songs,
              albums: searchFilter === 'ALBUM' ? [...prev.catalog.albums, ...moreResults.albums] : prev.catalog.albums,
              artists: searchFilter === 'ARTIST' ? [...prev.catalog.artists, ...moreResults.artists] : prev.catalog.artists,
          }
      }));

      setIsLoadingMore(false);
  };

  const handleRequestBounty = (item: GlobalCatalogEntry) => {
      createBounty(item.mbid, `${item.artist} - ${item.title}`, 100);
      alert(`Bounty created for "${item.title}"! Users who upload this will earn credits.`);
  };
  
  const handleCreateParty = () => {
      if(currentTrack) {
          createParty(user.username, currentTrack.id);
          alert("Party Created! Swarm users can now see it.");
      } else {
          alert("Play a track first to host a party.");
      }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    audioRef.current.pause();
    audioRef.current.src = "";
    navigate('/');
  };

  const handlePlay = async (track: Track) => {
    try {
        setLibrary(prev => {
            const entry = prev[track.id];
            if (entry) return { ...prev, [track.id]: { ...entry, lastPlayed: Date.now() }};
            return { ...prev, [track.id]: { trackId: track.id, status: 'REMOTE', progress: 0, lastPlayed: Date.now(), addedAt: Date.now() }};
        });

        const audio = audioRef.current;

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

        setIsPlaying(false);
        audio.pause();
        setCurrentTrack(track);

        const localUrl = await loadFromVault(track.id);
        
        if (localUrl) {
            if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src);
            audio.src = localUrl;
            audio.load();
            audio.play().then(() => setIsPlaying(true));
            return;
        }

        if(track.audioUrl.startsWith('magnet:')) {
             setLibrary(prev => ({
                ...prev,
                [track.id]: { trackId: track.id, status: 'DOWNLOADING', progress: 0, addedAt: Date.now(), lastPlayed: Date.now(), localPath: track.audioUrl }
            }));
            
            try {
                const { file, url } = await addTorrent(track.audioUrl, (prog, speed) => {
                    // Progress loop
                });
                audio.src = url;
                audio.play().then(() => setIsPlaying(true));
            } catch(err) {
                console.error("Torrent stream failed", err);
            }
        } else {
            audio.src = track.audioUrl;
            audio.play().then(() => setIsPlaying(true));
        }

    } catch (err) {
        console.error("HandlePlay Error:", err);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPostContent.trim() || !user) return;
      await publishPost(user.username, newPostContent, currentTrack?.id);
      setNewPostContent('');
  };

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => {
    const isActive = location.pathname === path;
    return (
        <button 
        onClick={() => navigate(path)}
        className={clsx(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
            isActive ? "bg-brand-500/10 text-brand-500 border border-brand-500/20" : "text-gray-400 hover:text-white hover:bg-white/5"
        )}
        >
        <Icon size={20} />
        <span>{label}</span>
        </button>
    );
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: typeof searchFilter, label: string, icon: any }) => (
      <button 
        onClick={() => setSearchFilter(type)}
        className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
            searchFilter === type ? "bg-brand-500 text-black border-brand-500 font-bold" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
        )}
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
        <Link to="/" className="flex items-center gap-2 text-brand-500">
           <Disc size={28} className={isPlaying ? "animate-spin-slow" : ""} />
           <span className="text-xl font-bold tracking-tight text-white hidden sm:block">BitBeats <span className="text-xs text-gray-500 font-normal ml-1">v3.0</span></span>
        </Link>

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
                  <div className="text-xs text-gray-500 truncate">{user.handle}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="text-gray-500 hover:text-white" title="Logout">
                <LogOut size={16} />
              </button>
           </div>

           <nav className="space-y-1">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-4">Browse</div>
             <NavItem path="/" icon={Radio} label="Discovery" />
             <NavItem path="/bounties" icon={Zap} label="Bounty Board" />
             <NavItem path="/swarm" icon={Users} label="Swarm Social" />
             
             <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-6 mb-3 px-4">My Collection</div>
             <NavItem path="/library" icon={HardDrive} label="My Library" />
           </nav>
           
           <div className="mt-auto pt-6 border-t border-white/10">
              {deferredPrompt && (
                <div className="mb-4">
                  <button 
                    onClick={handleInstallClick}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-brand-500 font-bold text-sm mb-1 group-hover:text-brand-400">
                      <Download size={16} /> Install App
                    </div>
                    <p className="text-xs text-gray-400">Get the native desktop experience.</p>
                  </button>
                </div>
              )}

              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4">
                 <div className="flex items-center gap-2 mb-2 text-white font-bold text-sm">
                    <Activity size={16} className="text-brand-500" /> LAN Sync
                 </div>
                 <p className="text-xs text-gray-400 mb-3">DHT Active. {activePeers} Mesh Peers connected.</p>
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
            
            <Routes>
                {/* --- DISCOVERY --- */}
                <Route path="/" element={
                     <DiscoveryPage 
                        library={library} 
                        tracks={tracks} 
                        onPlay={handlePlay} 
                        user={user} 
                     />
                } />

                {/* --- ARTIST DETAILS --- */}
                <Route path="/artist/:id" element={<ArtistPage onPlay={handlePlay} swarmTracks={tracks} />} />
                
                {/* --- ALBUM DETAILS --- */}
                <Route path="/album/:id" element={<AlbumPage onPlay={handlePlay} isPlaying={isPlaying} currentTrackId={currentTrack?.id} swarmTracks={tracks} />} />

                {/* --- LIBRARY SUB-PAGES --- */}
                <Route path="/library/artists" element={<LibraryArtists />} />
                <Route path="/library/albums" element={<LibraryAlbums />} />
                <Route path="/library/tracks" element={<LibraryTracks onPlay={handlePlay} />} />
                <Route path="/library/playlists" element={<div className="p-8 text-white">Playlists Coming Soon</div>} />

                {/* --- SEARCH RESULTS --- */}
                <Route path="/search" element={
                     <div className="p-8 max-w-6xl mx-auto">
                        <h1 className="text-3xl font-bold text-white mb-6">Search Results: "{searchQuery}"</h1>
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
                                                    <CoverImage 
                                                        mbid={track.mbid} 
                                                        fallbackSrc={track.coverUrl}
                                                        type="track"
                                                        size="small"
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                                    />
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
                                            <CatalogCard key={item.mbid} item={item} onRequest={handleRequestBounty} />
                                        ))}
                                    </div>
                                    {searchResults.catalog.songs.length === 0 && <p className="text-gray-500 italic text-sm">No songs found in global catalog.</p>}
                                 </div>
                               )}
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
                                            <CatalogCard key={item.mbid} item={item} onRequest={handleRequestBounty} />
                                        ))}
                                    </div>
                                    {searchResults.catalog.albums.length === 0 && <p className="text-gray-500 italic text-sm">No albums found in global catalog.</p>}
                                 </div>
                               )}
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
                                            <CatalogCard key={item.mbid} item={item} onRequest={handleRequestBounty} />
                                        ))}
                                    </div>
                                     {searchResults.catalog.artists.length === 0 && <p className="text-gray-500 italic text-sm">No artists found in global catalog.</p>}
                                 </div>
                               )}
                               {searchFilter !== 'ALL' && (
                                   <div className="mt-12 flex justify-center">
                                       <Button 
                                           variant="secondary" 
                                           onClick={handleLoadMore} 
                                           disabled={isLoadingMore}
                                           className="min-w-[200px]"
                                       >
                                           {isLoadingMore ? <Loader className="animate-spin" size={16} /> : <ArrowDown size={16} />}
                                           Load More Results
                                       </Button>
                                   </div>
                               )}
                           </div>
                        )}
                     </div>
                } />

                {/* --- BOUNTIES --- */}
                <Route path="/bounties" element={
                     <div className="p-8 max-w-4xl mx-auto">
                        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-2xl p-8 mb-8 border border-yellow-500/20">
                            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                                <Zap className="text-yellow-500" /> Bounty Board
                            </h1>
                            <p className="text-gray-300 max-w-xl">
                                Request rare tracks using your Credits. When a Seeder fulfills the request, they earn the bounty.
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
                } />

                {/* --- SWARM --- */}
                <Route path="/swarm" element={
                     <div className="p-8 max-w-4xl mx-auto">
                         <div>
                             <h2 className="text-2xl font-bold text-white mb-6">Active Listen Parties</h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                 {activeParties.length === 0 && (
                                     <div className="col-span-2 text-center py-8 bg-white/5 rounded-xl border border-white/5">
                                         <p className="text-gray-400 mb-4">No active parties.</p>
                                         <Button onClick={handleCreateParty}>Start a Party</Button>
                                     </div>
                                 )}
                                 {activeParties.map(party => (
                                     <div key={party.id} className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
                                         <div className="absolute top-0 right-0 p-3">
                                             <span className="flex items-center gap-1 text-xs text-red-400 font-bold animate-pulse">
                                                 <Activity size={12} /> LIVE
                                             </span>
                                         </div>
                                         <h3 className="font-bold text-white text-lg">{party.host}'s Room</h3>
                                         <p className="text-sm text-gray-400 mb-4">Playing: {tracks.find(t=>t.id === party.currentTrackId)?.title || 'Unknown Track'}</p>
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
                                 {socialPosts.map(post => (
                                     <div key={post.id} className="bg-white/5 rounded-xl p-4 border border-white/5 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                         <div className="flex justify-between mb-2">
                                             <span className="font-bold text-brand-400 text-sm">@{post.author}</span>
                                             <span className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                         </div>
                                         <p className="text-gray-300 text-sm">{post.content}</p>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     </div>
                } />

                {/* --- LIBRARY DASHBOARD (Consolidated Vault, Studio, Identify) --- */}
                <Route path="/library" element={
                     <LibraryDashboard 
                        library={library} 
                        tracks={tracks} 
                        onImport={handleLocalImport} 
                        user={user}
                     />
                } />

                {/* --- REDIRECTS FOR LEGACY ROUTES --- */}
                <Route path="/studio" element={<Navigate to="/library" replace />} />
                <Route path="/identify" element={<Navigate to="/library" replace />} />

            </Routes>

        </main>
      </div>

      {/* --- Persistent Player --- */}
      <div className="h-24 bg-[#18181b] border-t border-white/5 px-4 md:px-8 flex items-center justify-between z-30 fixed bottom-0 left-0 right-0 shadow-2xl">
         <div className="flex items-center gap-4 w-1/3">
            {currentTrack ? (
              <>
                <CoverImage 
                    mbid={currentTrack.mbid} 
                    fallbackSrc={currentTrack.coverUrl}
                    type="track"
                    size="small"
                    className="w-14 h-14 rounded-md shadow-lg bg-gray-800"
                />
                <div className="hidden sm:block">
                   <h4 className="text-white font-medium truncate max-w-[150px]">{currentTrack.title}</h4>
                   <div className="flex items-center gap-2">
                       <p className="text-xs text-gray-400">{currentTrack.artist}</p>
                       <span className="text-[9px] bg-white/10 px-1 rounded text-gray-400 border border-white/10">
                           {currentTrack.audioUrl.startsWith('magnet') ? 'P2P' : 'HTTP'}
                       </span>
                   </div>
                </div>
                {user && (
                    <LikeButton 
                        userId={user.id}
                        entityId={currentTrack.id}
                        entityType="track"
                        metadata={{
                            title: currentTrack.title,
                            subtitle: currentTrack.artist,
                            coverUrl: currentTrack.coverUrl
                        }}
                    />
                )}
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
               
               <div 
                   ref={progressBarRef}
                   className="flex-1 h-3 group cursor-pointer flex items-center select-none touch-none"
                   onMouseDown={handleSeekStart}
               >
                  <div className="w-full h-1 bg-gray-700 rounded-full relative overflow-visible">
                      {/* Download / Cache Progress */}
                      {currentTrack && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-gray-600 rounded-full opacity-50 transition-all duration-1000"
                            style={{ width: `${library[currentTrack.id]?.progress ? library[currentTrack.id]?.progress * 100 : 0}%` }} 
                          />
                      )}
                      {/* Playback Progress */}
                      <div 
                         className="absolute left-0 top-0 bottom-0 bg-brand-500 rounded-full"
                         style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                      >
                         {/* The Handle / Dot */}
                         <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform active:scale-110"></div>
                      </div>
                  </div>
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
