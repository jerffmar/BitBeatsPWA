
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HardDrive, Mic2, Disc, Music, List, Upload, CheckCircle, 
  AlertCircle, Loader, FileAudio, Database, Server, Layers
} from 'lucide-react';
import { Track, LibraryEntry } from '../types';
import { useTrackIdentifier } from '../hooks/useTrackIdentifier';
import { DetailedMetadata } from '../services/musicBrainz';

interface LibraryDashboardProps {
  library: Record<string, LibraryEntry>;
  tracks: Track[];
  onImport: (file: File, metadata: DetailedMetadata) => Promise<void>;
}

export const LibraryDashboard: React.FC<LibraryDashboardProps> = ({ library, tracks, onImport }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ artists: 0, albums: 0, songs: 0, playlists: 0 });
  const [storage, setStorage] = useState({ used: 0, quota: 0 });
  const [importing, setImporting] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Hook for Identification Logic
  const { identify, status, result, error, reset, complianceStatus } = useTrackIdentifier();

  // --- Statistics Calculation ---
  useEffect(() => {
    const libraryTrackIds = Object.keys(library);
    const libraryTracks = tracks.filter(t => libraryTrackIds.includes(t.id));
    
    const uniqueArtists = new Set(libraryTracks.map(t => t.artist)).size;
    const uniqueAlbums = new Set(libraryTracks.map(t => t.album)).size;
    
    setStats({
      artists: uniqueArtists,
      albums: uniqueAlbums,
      songs: libraryTrackIds.length,
      playlists: 0 // Placeholder for future feature
    });
  }, [library, tracks]);

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
                // Convert IdentificationResult to DetailedMetadata
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
  const StatCard = ({ label, count, icon: Icon, onClick }: { label: string, count: number, icon: any, onClick?: () => void }) => (
    <div 
        onClick={onClick}
        className="group relative overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all cursor-pointer"
    >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110">
            <Icon size={64} />
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2 text-brand-500">
                <Icon size={24} />
                <h3 className="font-bold text-sm uppercase tracking-wider">{label}</h3>
            </div>
            <div className="text-4xl font-bold text-white">{count}</div>
        </div>
    </div>
  );

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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
            
            {/* Summary Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Artists" count={stats.artists} icon={Mic2} onClick={() => navigate('/search?type=ARTIST')} />
                <StatCard label="Albums" count={stats.albums} icon={Disc} onClick={() => navigate('/search?type=ALBUM')} />
                <StatCard label="Songs" count={stats.songs} icon={Music} onClick={() => navigate('/search?type=SONG')} />
                <StatCard label="Playlists" count={stats.playlists} icon={List} />
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
                </div>

            </div>
        </div>
    </div>
  );
};
