
import React, { useCallback } from 'react';
import { useAudioIdentification } from '../hooks/useAudioIdentification';
import { DetailedMetadata } from '../services/musicBrainz';
import { Upload, Loader, Music, CheckCircle, AlertTriangle, XCircle, FileAudio } from 'lucide-react';

interface UploadZoneProps {
  onSuccess: (file: File, metadata: DetailedMetadata) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onSuccess }) => {
  const { status, metadata, error, complianceStatus, processFile, reset } = useAudioIdentification();
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
        processFile(droppedFile);
      }
    }
  }, [processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      processFile(selectedFile);
    }
  }, [processFile]);

  // Trigger parent success callback when identification completes
  React.useEffect(() => {
    if (status === 'success' && metadata && file) {
      // Small delay to show the success state before moving on? 
      // Or just let the user click "Next"? 
      // Let's provide a "Next" button in the UI instead of auto-advance for better UX.
    }
  }, [status, metadata, file]);

  const Steps = () => (
    <div className="flex items-center justify-center gap-2 mt-6 text-sm">
        <StepIndicator current={status} step="decoding" label="Decoding" />
        <div className="w-4 h-0.5 bg-gray-700"></div>
        <StepIndicator current={status} step="fingerprinting" label="Fingerprinting" />
        <div className="w-4 h-0.5 bg-gray-700"></div>
        <StepIndicator current={status} step="identifying" label="Identifying" />
    </div>
  );

  const StepIndicator = ({ current, step, label }: { current: string, step: string, label: string }) => {
     const isComplete = getStepIndex(current) > getStepIndex(step);
     const isActive = current === step;
     
     let colorClass = "text-gray-600 bg-gray-800 border-gray-700";
     if (isComplete) colorClass = "text-green-500 bg-green-500/10 border-green-500/20";
     if (isActive) colorClass = "text-brand-500 bg-brand-500/10 border-brand-500/20 animate-pulse";

     return (
         <div className={`px-3 py-1 rounded-full border ${colorClass} transition-colors duration-300`}>
             {label}
         </div>
     );
  };

  const getStepIndex = (s: string) => {
      return ['idle', 'decoding', 'fingerprinting', 'identifying', 'success'].indexOf(s);
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
                Supports MP3, FLAC, WAV. We generate a digital fingerprint in your browser.
            </p>
        </div>
    );
  }

  if (status === 'error') {
      return (
          <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  {complianceStatus === 'blacklisted' ? <AlertTriangle size={32} /> : <XCircle size={32} />}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Identification Failed</h3>
              <p className="text-red-300 mb-6">{error}</p>
              <button 
                onClick={reset}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full transition-colors"
              >
                  Try Another File
              </button>
          </div>
      );
  }

  if (status === 'success' && metadata) {
      return (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-green-500/30 rounded-3xl p-8 animate-in fade-in zoom-in-95 relative overflow-hidden">
               {/* Background Glow */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

               <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-6 text-green-400 font-bold uppercase text-xs tracking-wider">
                       <CheckCircle size={16} /> Analysis Complete
                   </div>

                   <div className="flex items-start gap-6">
                       <img src={metadata.coverUrl} className="w-32 h-32 rounded-lg shadow-2xl object-cover bg-black" />
                       <div className="flex-1">
                           <h3 className="text-2xl font-bold text-white mb-1">{metadata.title}</h3>
                           <p className="text-lg text-gray-300 mb-4">{metadata.artist}</p>
                           
                           <div className="grid grid-cols-2 gap-4 text-sm">
                               <div className="bg-black/30 p-3 rounded-lg">
                                   <span className="block text-gray-500 text-xs uppercase mb-1">Album</span>
                                   <span className="text-gray-300 truncate block">{metadata.album}</span>
                               </div>
                               <div className="bg-black/30 p-3 rounded-lg">
                                   <span className="block text-gray-500 text-xs uppercase mb-1">Fingerprint ID</span>
                                   <span className="text-brand-400 font-mono truncate block">fp_v1_8x92...</span>
                               </div>
                           </div>
                       </div>
                   </div>

                   <div className="mt-8 flex gap-4">
                       <button onClick={reset} className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-gray-400 transition-colors">
                           Cancel
                       </button>
                       <button 
                           onClick={() => file && onSuccess(file, metadata)}
                           className="flex-[2] py-3 rounded-xl bg-brand-500 hover:bg-brand-400 text-black font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95"
                       >
                           Confirm & Seed to Swarm
                       </button>
                   </div>
               </div>
          </div>
      );
  }

  // Loading State
  return (
      <div className="border border-white/10 bg-white/5 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 relative">
              <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
              <Music size={24} className="absolute inset-0 m-auto text-brand-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Analyzing Audio...</h3>
          <p className="text-gray-400 text-sm">{file?.name}</p>
          <Steps />
      </div>
  );
};
