
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Search, Library, 
  Wifi, HardDrive, Share2, Download, Radio, Volume2, User, 
  Disc, Users, Zap, Shield, Mic2, Settings, Trash2, Heart,
  Globe, Activity, LogOut
} from 'lucide-react';

import { Track, LibraryEntry, UserStats, ViewState, StorageConfig, User as UserType } from './types';
import { MOCK_TRACKS, MOCK_BOUNTIES, MOCK_PARTIES, MOCK_POSTS, calculateRatio } from './services/mockData';
import { saveToVault, loadFromVault, checkVaultStatus, getStoredBytes, runSmartEviction, exportTrack, opfsSupported } from './services/storage.ts';
import { getReputation, discoverLocalPeers, signUpload } from './services/p2pNetwork';
import { AuthScreen } from './AuthScreen';
import { getSession, logout } from './services/auth';

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
             <span className="text-xs hidden sm:block">{entry?.progress}%</span>
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
  
  // Audio
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  // Stats
  const [stats, setStats] = useState<UserStats>({
    downloadedBytes: 1024 * 1024 * 150,
    uploadedBytes: 1024 * 1024 * 50,
    ratio: 0.33,
    reputation: 'Leecher',
    credits: 150
  });

  // --- Auth Check ---
  useEffect(() => {
    const session = getSession();
    if (session) {
      setUser(session);
    }
  }, []);

  // --- Initialization ---
  useEffect(() => {
    if (!user) return; // Only init if logged in

    const init = async () => {
       const initialLibrary: Record<string, LibraryEntry> = {};
       
       // Load existing files from mock "Vault"
       for (const track of MOCK_TRACKS) {
         // In simulation, we check our wrapper
         const stored = false; // By default empty in this render
         if (stored) {
           initialLibrary[track.id] = {
             trackId: track.id,
             status: 'SEEDING',
             progress: 100,
             addedAt: Date.now(),
             lastPlayed: Date.now() - 1000000
           };
         }
       }
       setLibrary(initialLibrary);
    };
    init();

    // Setup Audio Listeners
    const audio = audioRef.current;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [user]);

  // --- P2P Simulation Loop ---
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
        // 1. Simulate Uploads (Seeding)
        const seeds = Object.values(library).filter(l => l.status === 'SEEDING');
        if (seeds.length > 0) {
            setStats(prev => {
                const addedUpload = seeds.length * 0.05 * 1024 * 1024; // 50KB per seed per tick
                const newUp = prev.uploadedBytes + addedUpload;
                return {
                    ...prev,
                    uploadedBytes: newUp,
                    ratio: calculateRatio(prev.downloadedBytes, newUp),
                    reputation: getReputation(calculateRatio(prev.downloadedBytes, newUp), newUp)
                };
            });
        }

        // 2. Simulate Downloads
        const downloads = Object.values(library).filter(l => l.status === 'DOWNLOADING');
        downloads.forEach(entry => {
            setLibrary(prev => {
                const newProgress = Math.min(entry.progress + 5, 100);
                if (newProgress >= 100) {
                   // Finish Download
                   saveToVault(entry.trackId, new ArrayBuffer(1024)); // Mock save
                   return {
                       ...prev,
                       [entry.trackId]: { ...entry, status: 'SEEDING', progress: 100, lastPlayed: Date.now() }
                   };
                }
                return {
                    ...prev,
                    [entry.trackId]: { ...entry, progress: newProgress }
                };
            });
            // Track download stats
            setStats(prev => ({ ...prev, downloadedBytes: prev.downloadedBytes + (0.5 * 1024 * 1024) }));
        });

        // 3. Update Storage Usage
        setUsageMB(prev => prev + (downloads.length * 0.5)); // Fake increase

    }, 1000);
    return () => clearInterval(interval);
  }, [library, user]);

  // --- Handlers ---

  const handleLogout = () => {
    logout();
    setUser(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    audioRef.current.pause();
  };

  const handlePlay = async (track: Track) => {
    // Update "Last Played" for Eviction Logic
    setLibrary(prev => {
        const entry = prev[track.id];
        if (entry) return { ...prev, [track.id]: { ...entry, lastPlayed: Date.now() }};
        return prev;
    });

    if (currentTrack?.id === track.id) {
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play(); setIsPlaying(true); }
        return;
    }

    // Load from Vault OR Remote
    const localUrl = await loadFromVault(track.id);
    if (audioRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
    
    audioRef.current.src = localUrl || track.audioUrl;
    audioRef.current.play().catch(console.error);
    
    setCurrentTrack(track);
    setIsPlaying(true);

    // If remote, start downloading
    if (!localUrl && !library[track.id]) {
        setLibrary(prev => ({
            ...prev,
            [track.id]: { trackId: track.id, status: 'DOWNLOADING', progress: 0, addedAt: Date.now(), lastPlayed: Date.now() }
        }));
    }
  };

  const handleEvictionCheck = async () => {
    const deleted = await runSmartEviction(library, MOCK_TRACKS, storageConfig, usageMB);
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

  const NavItem = ({ id, icon: Icon, label }: { id: ViewState, icon: any, label: string }) => (
    <button 
      onClick={() => setView(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${view === id ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
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
           <span className="text-xl font-bold tracking-tight text-white hidden sm:block">BitBeats <span className="text-xs text-gray-500 font-normal ml-1">v2.0</span></span>
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
                 <p className="text-xs text-gray-400 mb-3">Scanning local network for peers...</p>
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
           
           {/* DISCOVERY VIEW */}
           {view === 'DISCOVERY' && (
             <div className="p-8 max-w-6xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Discover</h1>
                        <p className="text-gray-400">AI-Recommended tracks based on your local library.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs text-brand-500 bg-brand-500/10 border border-brand-500/20 px-2 py-1 rounded">PRIVACY FIRST</span>
                        <p className="text-[10px] text-gray-500 mt-1">Recommendations generated on-device.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                   {MOCK_TRACKS.map(track => (
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
                      {MOCK_BOUNTIES.map(bounty => (
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
                                   <p className="text-sm text-gray-400 mb-4">Playing: {MOCK_TRACKS.find(t=>t.id === party.currentTrackId)?.title}</p>
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

                       <h2 className="text-2xl font-bold text-white mb-4">Swarm Chatter</h2>
                       <div className="space-y-4">
                           {MOCK_POSTS.map(post => (
                               <div key={post.id} className="bg-white/5 rounded-xl p-4 border border-white/5">
                                   <div className="flex justify-between mb-2">
                                       <span className="font-bold text-brand-400 text-sm">@{post.author}</span>
                                       <span className="text-xs text-gray-500">2 min ago</span>
                                   </div>
                                   <p className="text-gray-300 text-sm">{post.content}</p>
                                   {post.trackId && (
                                       <div className="mt-3 bg-black/20 p-2 rounded flex items-center gap-3">
                                            <Disc size={16} className="text-gray-500" />
                                            <span className="text-xs text-gray-400">Referencing: {MOCK_TRACKS.find(t => t.id === post.trackId)?.title}</span>
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
                      const track = MOCK_TRACKS.find(t => t.id === entry.trackId);
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
                       <p className="text-gray-400">Upload your tracks. Sign them cryptographically. Earn credits.</p>
                   </div>

                   <div className="border-2 border-dashed border-gray-700 rounded-3xl p-12 hover:border-brand-500 transition-colors cursor-pointer bg-white/5">
                       <Download size={48} className="mx-auto text-gray-600 mb-4" />
                       <p className="text-xl font-medium text-white mb-2">Drag & Drop Audio Files (FLAC/MP3)</p>
                       <p className="text-sm text-gray-500 mb-6">We will generate an AcoustID fingerprint and sign the blob.</p>
                       <Button>Select Files</Button>
                   </div>
                   
                   <div className="mt-8 text-left bg-dark-surface p-6 rounded-xl border border-white/5">
                       <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Shield size={16} className="text-green-500" /> Identity Management</h3>
                       <div className="flex items-center justify-between bg-black/30 p-4 rounded-lg">
                           <div>
                               <p className="text-xs text-gray-500 uppercase">Your Public Key</p>
                               <p className="font-mono text-sm text-brand-400">ed25519_pub_8a92...9x12</p>
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
                       <span className="text-[9px] bg-white/10 px-1 rounded text-gray-400 border border-white/10">OPFS</span>
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
                       style={{ width: `${library[currentTrack.id]?.progress || 0}%` }} 
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
