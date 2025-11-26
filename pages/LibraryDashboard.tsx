import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HardDrive, Mic2, Disc, Music, List, Upload, CheckCircle, 
  AlertCircle, Loader, FileAudio, Database, Server, Layers,
  ChevronRight, Folder, FolderOpen
} from 'lucide-react';
import { Track, LibraryEntry, LikedItem } from '../types';
import { useTrackIdentifier } from '../hooks/useTrackIdentifier';
import { DetailedMetadata } from '../services/musicBrainz';
import { likeService } from '../services/likeService';

interface LibraryDashboardProps {
  library: Record<string, LibraryEntry>;
  tracks: Track[];
  onImport: (file: File, metadata: DetailedMetadata) => Promise<void>;
  user?: any;
}

export const LibraryDashboard: React.FC<LibraryDashboardProps> = ({ library, tracks, onImport, user }) => {
  const navigate = useNavigate();
  const [storage, setStorage] = useState({ used: 0, quota: 0 });
  const [importing, setImporting] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Hook for Identification Logic
  const { identify, status, result, error, reset, complianceStatus } = useTrackIdentifier();

  // Liked Items State
  const [likedArtists, setLikedArtists] = useState<{total: number, preview: LikedItem[]}>({total: 0, preview: []});
  const [likedAlbums, setLikedAlbums] = useState<{total: number, preview: LikedItem[]}>({total: 0, preview: []});
  const [likedTracks, setLikedTracks] = useState<{total: number, preview: LikedItem[]}>({total: 0, preview: []});

  // --- Local Storage Explorer State ---
  const PROTECTED_KEYS = [
    'bitbeats_user_pair',                  // SEA keypair
    'gun/',                                // Any namespaced gun localStorage (precaution)
    'vite:',                               // Vite HMR caches
    'persist:',                            // Common prefixes
    'bitbeats_settings',                   // hypothetical app settings
  ];
  const [lsItems, setLsItems] = useState<{ key: string; size: number; protected: boolean }[]>([]);

  const computeSize = (val: string | null) => (val ? new Blob([val]).size : 0);

  const refreshLocalStorage = useCallback(() => {
    const items: { key: string; size: number; protected: boolean }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const v = localStorage.getItem(k);
      const isProtected =
        PROTECTED_KEYS.some(p => k === p || k.startsWith(p));
      items.push({ key: k, size: computeSize(v), protected: isProtected });
    }
    // Sort protected first for clarity
    items.sort((a, b) => Number(b.protected) - Number(a.protected) || b.size - a.size);
    setLsItems(items);
  }, []);

  useEffect(() => {
    refreshLocalStorage();
  }, [refreshLocalStorage]);

  const deleteLocalStorageKey = (key: string) => {
    const isProtected =
      PROTECTED_KEYS.some(p => key === p || key.startsWith(p));
    if (isProtected) {
      alert('This item is protected and cannot be deleted.');
      return;
    }
    localStorage.removeItem(key);
    refreshLocalStorage();
  };

  const clearNonCriticalLocalStorage = () => {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      const isProtected =
        PROTECTED_KEYS.some(p => k === p || k.startsWith(p));
      if (!isProtected) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    refreshLocalStorage();
    alert(`Cleared ${toRemove.length} non-critical items from Local Storage.`);
  };

  // --- Fetch Likes ---
  useEffect(() => {
      if(!user) return;
      const fetchLikes = async () => {
          setLikedArtists(await likeService.getLikedPreview(user.id, 'artist'));
          setLikedAlbums(await likeService.getLikedPreview(user.id, 'album'));
          setLikedTracks(await likeService.getLikedPreview(user.id, 'track'));
      };
      fetchLikes();
  }, [user]);

  // --- Storage Quota ---
  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setStorage({ 
          used: usage || 0, 
          quota: quota || 1024 * 1024 * 1024 * 2 // Default 2GB
        });
      });
    }
  }, [library]);

  // --- Drag & Drop Handlers ---
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/')) {
        setDroppedFile(file);
        identify(file);
      }
    }
  }, [identify]);

  // --- Auto-Import Trigger ---
  useEffect(() => {
    const triggerImport = async () => {
        if (status === 'success' && result && droppedFile && !importing) {
            setImporting(true);
            try {
                const meta: DetailedMetadata = {
                    mbid: result.mbid,
                    title: result.title,
                    artist: result.artist,
                    album: result.album,
                    year: result.year,
                    coverUrl: result.coverUrl || '',
                    tags: []
                };
                
                await onImport(droppedFile, meta);
                reset();
                setDroppedFile(null);
            } catch (e) {
                console.error("Import failed", e);
            } finally {
                setImporting(false);
            }
        }
    };
    triggerImport();
  }, [status, result, droppedFile, importing, onImport, reset]);


  // --- Helper Components ---
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  /**
   * Widget Design: "Folder Preview"
   * Displays a 2x2 grid of the top 4 items.
   * Acts as a big button to navigate to the specific library page.
   */
  const LibraryWidget = ({ 
      title, icon: Icon, total, items, path
  }: { 
      title: string, icon: any, total: number, items: LikedItem[], path: string
  }) => {
      
      const gridItems = [...items];
      // Fill remaining slots with nulls up to 4 to maintain grid structure
      while(gridItems.length < 4) {
          gridItems.push(null as any);
      }
      
      // Take only top 4
      const displayItems = gridItems.slice(0, 4);

      return (
          <div 
            onClick={() => navigate(path)}
            className="group bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] transition-all duration-300 shadow-lg"
          >
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <div className="bg-brand-500/10 p-2 rounded-lg text-brand-500">
                        <Icon size={18} /> 
                      </div>
                      {title}
                  </div>
                  <span className="text-gray-500 text-xs font-mono bg-black/20 px-2 py-1 rounded">{total}</span>
              </div>
              
              {/* 2x2 Folder Grid */}
              <div className="aspect-square bg-black/20 rounded-xl overflow-hidden p-1 grid grid-cols-2 gap-0.5 border border-white/5 relative">
                  {displayItems.map((item, i) => (
                      <div key={i} className="bg-white/5 w-full h-full overflow-hidden relative first:rounded-tl-lg second:rounded-tr-lg third:rounded-bl-lg fourth:rounded-br-lg">
                          {item ? (
                              <img src={item.coverUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center opacity-10">
                                  <Icon size={24} />
                              </div>
                          )}
                      </div>
                  ))}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                      <div className="bg-brand-500 text-black px-4 py-2 rounded-full font-bold text-xs shadow-xl flex items-center gap-1">
                          Open <ChevronRight size={12} />
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 overflow-y-auto pb-32">
        {/* Header */}
        <div className="px-8 py-8 border-b border-white/5 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shadow-[0_0_15px_rgba(20,184,166,0.1)]">
                    <HardDrive size={24} className="text-brand-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">My Library</h1>
                    <p className="text-gray-400 text-sm">Local Vault & P2P Seeding Hub</p>
                </div>
            </div>
        </div>

        <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
            
            {/* Library Widgets Grid (Likes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <LibraryWidget 
                    title="Artists" 
                    icon={Mic2} 
                    total={likedArtists.total} 
                    items={likedArtists.preview} 
                    path="/library/artists"
                />
                <LibraryWidget 
                    title="Albums" 
                    icon={Disc} 
                    total={likedAlbums.total} 
                    items={likedAlbums.preview} 
                    path="/library/albums"
                />
                <LibraryWidget 
                    title="Songs" 
                    icon={Music} 
                    total={likedTracks.total} 
                    items={likedTracks.preview} 
                    path="/library/tracks"
                />
                {/* Placeholder Playlist Widget */}
                 <div className="group bg-white/5 border border-white/10 border-dashed rounded-2xl p-5 cursor-not-allowed opacity-60 flex flex-col justify-center items-center text-center h-[340px] md:h-auto">
                    <List size={32} className="mb-2 text-gray-500" />
                    <h3 className="text-white font-bold text-sm">Playlists</h3>
                    <p className="text-xs text-gray-500">Coming Soon</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                         <h2 className="text-xl font-bold text-white">Quick Actions</h2>
                    </div>
                    
                    {/* Smart Upload Zone */}
                    <div 
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        className={`
                            relative border-2 border-dashed rounded-3xl p-10 transition-all duration-300 flex flex-col items-center justify-center text-center
                            ${dragActive ? 'border-brand-500 bg-brand-500/10 scale-[1.02]' : 'border-white/10 hover:border-brand-500/50 hover:bg-white/5'}
                        `}
                    >
                        {/* Status Overlay */}
                        {(status !== 'idle' || importing) && (
                            <div className="absolute inset-0 bg-neutral-900/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl">
                                {status === 'error' || status === 'rejected' ? (
                                    <>
                                        <AlertCircle size={48} className="text-red-500 mb-4" />
                                        <p className="text-red-400 font-bold mb-2">
                                            {complianceStatus === 'rejected' ? 'Compliance Check Failed' : 'Identification Error'}
                                        </p>
                                        <p className="text-sm text-gray-500">{error}</p>
                                        <button onClick={reset} className="mt-4 px-4 py-2 bg-white/10 rounded-full text-sm hover:bg-white/20">Try Again</button>
                                    </>
                                ) : (
                                    <>
                                        {importing ? (
                                             <div className="flex flex-col items-center">
                                                 <Server size={48} className="text-emerald-500 animate-pulse mb-4" />
                                                 <p className="text-emerald-400 font-bold text-lg">Saving to Vault...</p>
                                                 <p className="text-sm text-gray-500 mt-1">Normalizing & Seeding to Swarm</p>
                                             </div>
                                        ) : (
                                             <div className="flex flex-col items-center">
                                                 <Loader size={48} className="text-brand-500 animate-spin mb-4" />
                                                 <p className="text-white font-bold text-lg">
                                                     {status === 'fingerprinting' && 'Analyzing Audio...'}
                                                     {status === 'checking_db' && 'Checking Local Cache...'}
                                                     {status === 'checking_external' && 'Querying AcoustID...'}
                                                     {status === 'fuzzy_matching' && 'Fuzzy Matching...'}
                                                     {status === 'success' && 'Match Found!'}
                                                 </p>
                                                 <p className="text-sm text-gray-500 mt-1">{droppedFile?.name}</p>
                                             </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 group-hover:border-brand-500/50 transition-colors">
                            <Upload size={28} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Import to Library</h3>
                        <p className="text-gray-400 max-w-sm mb-6">
                            Drop audio files here. We'll identify, normalize, and add them to your secure Vault.
                        </p>
                        <div className="flex gap-3 text-xs text-gray-500 font-mono border border-white/10 px-4 py-2 rounded-full bg-black/20">
                            <span className="flex items-center gap-1"><FileAudio size={12} /> WAV/MP3</span>
                            <span className="w-px h-3 bg-white/10"></span>
                            <span className="flex items-center gap-1"><Database size={12} /> Auto-Meta</span>
                            <span className="w-px h-3 bg-white/10"></span>
                            <span className="flex items-center gap-1"><Server size={12} /> P2P Ready</span>
                        </div>
                    </div>
                    
                    {/* Storage Quota Indicator */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                         <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2 text-white font-bold">
                                 <Database size={18} className="text-brand-500" />
                                 Storage Quota
                             </div>
                             <span className="text-xs text-gray-400 font-mono">
                                 {formatBytes(storage.used)} / {formatBytes(storage.quota)}
                             </span>
                         </div>
                         <div className="h-3 bg-black/40 rounded-full overflow-hidden mb-2">
                             <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                    (storage.used / storage.quota) > 0.9 ? 'bg-red-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, (storage.used / storage.quota) * 100)}%` }}
                             ></div>
                         </div>
                         <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                             <span>System Safe</span>
                             <span>OPFS Persistent</span>
                         </div>
                    </div>

                </div>

                {/* Right Column (Info / Mini List) */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-brand-900/20 to-neutral-900 border border-brand-500/20 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                            <Layers size={18} className="text-brand-500" />
                            Vault Status
                        </h3>
                        <p className="text-sm text-gray-400 leading-relaxed mb-4">
                            Your library is stored locally in the Origin Private File System. 
                            Files are automatically seeded to the swarm when you are online.
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <CheckCircle size={16} className="text-brand-500" />
                                <span>Phase 2 Audio Engine Active</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <CheckCircle size={16} className="text-brand-500" />
                                <span>-1dB Normalization Enabled</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-300">
                                <CheckCircle size={16} className="text-brand-500" />
                                <span>Metadata Auto-Resolution</span>
                            </div>
                        </div>
                    </div>

                    {/* Mini Recent List */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Recent Imports</h3>
                        <div className="space-y-3">
                             {Object.values(library).slice(0, 5).map((entry, idx) => {
                                 const track = tracks.find(t => t.id === entry.trackId);
                                 if(!track) return null;
                                 return (
                                     <div key={idx} className="flex items-center gap-3 group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors">
                                         <div className="w-8 h-8 rounded bg-gray-800 overflow-hidden">
                                             <img src={track.coverUrl} className="w-full h-full object-cover" alt={track.title} />
                                         </div>
                                         <div className="min-w-0 flex-1">
                                             <div className="text-sm text-white truncate font-medium">{track.title}</div>
                                             <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                         </div>
                                     </div>
                                 )
                             })}
                             {Object.keys(library).length === 0 && (
                                 <p className="text-gray-500 text-sm italic">No files in vault yet.</p>
                             )}
                        </div>
                    </div>

                    {/* Local Storage Explorer (New) */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Local Storage</h3>
                          <button
                            onClick={clearNonCriticalLocalStorage}
                            className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1 rounded border border-red-500/20"
                            title="Clear non-critical localStorage keys"
                          >
                            Clean Non-Critical
                          </button>
                        </div>
                        {lsItems.length === 0 ? (
                          <p className="text-gray-500 text-sm">Local Storage is empty.</p>
                        ) : (
                          <div className="space-y-2">
                            {lsItems.map(item => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between px-3 py-2 bg-black/20 rounded-lg border border-white/10"
                              >
                                <div className="min-w-0">
                                  <div className="text-white text-sm truncate">{item.key}</div>
                                  <div className="text-xs text-gray-500">
                                    {(item.size / 1024).toFixed(2)} KB {item.protected && '• Protected'}
                                  </div>
                                </div>
                                <button
                                  onClick={() => deleteLocalStorageKey(item.key)}
                                  disabled={item.protected}
                                  className={`text-xs px-2 py-1 rounded border ${
                                    item.protected
                                      ? 'opacity-40 cursor-not-allowed border-white/10 text-gray-500'
                                      : 'border-red-500/20 text-red-400 hover:bg-red-500/10'
                                  }`}
                                  title={item.protected ? 'Protected item' : 'Delete from Local Storage'}
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                          Critical keys are protected automatically.
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
