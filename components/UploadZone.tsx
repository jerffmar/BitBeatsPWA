import React, { useCallback, useEffect } from 'react';
import { useTrackIdentifier } from '../hooks/useTrackIdentifier';
import { DetailedMetadata } from '../services/musicBrainz';
import { Upload, Music, CheckCircle, AlertTriangle, XCircle, Database, Search, Fingerprint } from 'lucide-react';

interface UploadZoneProps {
  onSuccess: (file: File, metadata: DetailedMetadata) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onSuccess }) => {
  const { status, result, error, complianceStatus, identify, reset } = useTrackIdentifier();
  const [dragActive, setDragActive] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

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
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('audio/')) {
        setFile(droppedFile);
        identify(droppedFile);
      }
    }
  }, [identify]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      identify(selectedFile);
    }
  }, [identify]);

  const handleConfirm = () => {
    if (file && result) {
      // Map IdentificationResult to DetailedMetadata for the parent component
      const detailed: DetailedMetadata = {
        mbid: result.mbid,
        title: result.title,
        artist: result.artist,
        album: result.album,
        year: result.year,
        coverUrl: result.coverUrl || '',
        tags: []
      };
      onSuccess(file, detailed);
    }
  };

  // --- RENDER HELPERS ---

  const StepIndicator = ({ stepStatus, label, icon: Icon }: { stepStatus: string, label: string, icon: any }) => {
     // Determine if this step is active, pending, or complete based on global status
     // Simplified logic for linear progression visualization
     let state = 'pending';
     
     if (status === stepStatus) state = 'active';
     
     // Crude ordering check
     const order = ['fingerprinting', 'checking_db', 'checking_external', 'fuzzy_matching', 'success'];
     if (order.indexOf(status) > order.indexOf(stepStatus)) state = 'complete';
     if (status === 'success') state = 'complete';

     let colorClass = "text-gray-600 border-gray-700 bg-gray-900";
     if (state === 'active') colorClass = "text-brand-500 border-brand-500/50 bg-brand-500/10 animate-pulse";
     if (state === 'complete') colorClass = "text-green-500 border-green-500/50 bg-green-500/10";

     return (
         <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${colorClass}`}>
             <Icon size={12} />
             {label}
         </div>
     );
  };

  // --- RENDERING STATES ---

  if (status === 'idle') {
    return (
        <div 
          className={`relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer
            ${dragActive ? 'border-brand-500 bg-brand-500/5' : 'border-gray-700 hover:border-brand-500 hover:bg-white/5'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
            <input 
                type="file" 
                accept="audio/*" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
            />
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
                <Upload size={32} className="text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Drag & Drop Audio</h3>
            <p className="text-gray-400 max-w-sm">
                Supports MP3, FLAC, WAV. We use hybrid fingerprinting to identify your tracks.
            </p>
        </div>
    );
  }

  if (status === 'error' || status === 'rejected') {
      return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  {complianceStatus === 'rejected' ? <AlertTriangle size={32} /> : <XCircle size={32} />}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {complianceStatus === 'rejected' ? 'Compliance Check Failed' : 'Identification Failed'}
              </h3>
              <p className="text-red-300 mb-6">{error}</p>
              {result && complianceStatus === 'rejected' && (
                  <div className="bg-black/30 p-4 rounded-xl mb-6 max-w-md mx-auto border border-red-500/20">
                      <p className="text-sm text-gray-400">Identified as:</p>
                      <p className="text-white font-bold">{result.artist} - {result.title}</p>
                  </div>
              )}
              <button 
                onClick={reset}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors"
              >
                  Try Another File
              </button>
          </div>
      );
  }

  if (status === 'success' && result) {
      return (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/30 rounded-3xl p-8 animate-in fade-in zoom-in-95 relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

               <div className="relative z-10">
                   <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-2 text-green-400 font-bold uppercase text-xs tracking-wider">
                           <CheckCircle size={16} /> Analysis Complete
                       </div>
                       <div className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400 border border-white/10 font-mono">
                           Method: {result.methodUsed.toUpperCase()}
                       </div>
                   </div>

                   <div className="flex items-start gap-6">
                       <div className="w-32 h-32 rounded-lg shadow-2xl bg-gray-800 overflow-hidden flex-shrink-0">
                           {result.coverUrl ? (
                               <img src={result.coverUrl} className="w-full h-full object-cover" />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-gray-600"><Music size={32} /></div>
                           )}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                           <h3 className="text-2xl font-bold text-white mb-1 truncate" title={result.title}>{result.title}</h3>
                           <p className="text-lg text-gray-300 mb-4 truncate">{result.artist}</p>
                           
                           <div className="grid grid-cols-2 gap-4 text-sm">
                               <div className="bg-black/30 p-3 rounded-lg">
                                   <span className="block text-gray-500 text-xs uppercase mb-1">Album</span>
                                   <span className="text-gray-300 truncate block">{result.album}</span>
                               </div>
                               <div className="bg-black/30 p-3 rounded-lg">
                                   <span className="block text-gray-500 text-xs uppercase mb-1">Confidence</span>
                                   <span className="text-brand-400 font-mono truncate block">
                                       {(result.score <= 1 ? result.score * 100 : result.score).toFixed(0)}% Match
                                   </span>
                               </div>
                           </div>
                       </div>
                   </div>

                   <div className="mt-8 flex gap-4">
                       <button onClick={reset} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 transition-colors">
                           Cancel
                       </button>
                       <button 
                           onClick={handleConfirm}
                           className="flex-[2] py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-black font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95"
                       >
                           Confirm & Seed
                       </button>
                   </div>
               </div>
          </div>
      );
  }

  // Processing State
  return (
      <div className="border border-white/10 bg-white/5 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
              <Music size={24} className="absolute inset-0 m-auto text-brand-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-6">Analyzing Audio...</h3>
          
          <div className="flex flex-wrap items-center justify-center gap-3">
              <StepIndicator stepStatus="fingerprinting" label="Fingerprinting" icon={Fingerprint} />
              <StepIndicator stepStatus="checking_db" label="Internal DB" icon={Database} />
              <StepIndicator stepStatus="checking_external" label="AcoustID" icon={Search} />
              <StepIndicator stepStatus="fuzzy_matching" label="Fuzzy Fallback" icon={Music} />
          </div>
          
          <p className="text-gray-500 text-sm mt-6 font-mono">{file?.name}</p>
      </div>
  );
};