
import React, { useState, useRef } from 'react';
import { Upload, Music, AlertCircle, CheckCircle, Search, Clock, User, Disc } from 'lucide-react';
import { identifyTrack, MatchedResult } from '../services/metadataMatcher';

export const MetadataResolver: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'searching' | 'complete' | 'error'>('idle');
  const [results, setResults] = useState<MatchedResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      analyzeAndSearch(selected);
    }
  };

  const analyzeAndSearch = async (selectedFile: File) => {
    setStatus('analyzing');
    setResults([]);
    setErrorMsg('');

    try {
      // 1. Get Duration using temporary Audio element
      const audio = new Audio(URL.createObjectURL(selectedFile));
      
      await new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => resolve(true));
        audio.addEventListener('error', (e) => reject(new Error('Failed to load audio')));
        setTimeout(() => reject(new Error('Audio load timeout')), 5000);
      });

      const dur = audio.duration;
      setDuration(dur);
      setStatus('searching');

      // 2. Call Matcher Service
      const matches = await identifyTrack(selectedFile, dur);
      setResults(matches);
      setStatus('complete');

      // Cleanup
      URL.revokeObjectURL(audio.src);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
      setStatus('error');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-green-400 border-green-500/50 bg-green-500/10';
    if (score >= 70) return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
    return 'text-red-400 border-red-500/50 bg-red-500/10';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Search className="text-brand-500" /> Smart Metadata Resolver
        </h1>
        <p className="text-gray-400">
          Identify local files using fuzzy matching and MusicBrainz. No fingerprinting required.
        </p>
      </div>

      {/* Upload Zone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-white/10 hover:border-brand-500/50 hover:bg-white/5 rounded-2xl p-10 text-center cursor-pointer transition-all mb-8"
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="audio/*" 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <Upload size={32} className="mx-auto text-gray-500 mb-4" />
        <h3 className="text-xl font-bold text-white">
          {file ? file.name : "Select Audio File"}
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          {status === 'analyzing' && "Extracting duration..."}
          {status === 'searching' && "Querying MusicBrainz..."}
          {status === 'idle' && "Click to analyze"}
        </p>
      </div>

      {/* Error State */}
      {status === 'error' && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 mb-6">
          <AlertCircle size={20} />
          {errorMsg}
        </div>
      )}

      {/* Results List */}
      {status === 'complete' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" /> Matches Found: {results.length}
          </h2>
          
          {results.length === 0 && (
            <p className="text-gray-500 italic">No high-confidence matches found. Try renaming the file (Artist - Title.mp3).</p>
          )}

          {results.map((match) => (
            <div 
              key={match.mbid} 
              className={`relative p-5 rounded-xl border flex flex-col md:flex-row gap-6 items-start md:items-center ${getConfidenceColor(match.confidence)} bg-opacity-5`}
            >
              {/* Score Badge */}
              <div className="flex-shrink-0 text-center">
                <div className="text-3xl font-black">{match.confidence}%</div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Match</div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold truncate text-white">{match.title}</h3>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-sm opacity-80">
                  <span className="flex items-center gap-1"><User size={14} /> {match.artist}</span>
                  <span className="flex items-center gap-1"><Disc size={14} /> {match.album}</span>
                  <span className="flex items-center gap-1"><Clock size={14} /> {match.year}</span>
                </div>
              </div>

              {/* Technical Breakdown */}
              <div className="text-xs space-y-1 opacity-70 font-mono w-full md:w-32">
                <div className="flex justify-between">
                  <span>Title:</span>
                  <span>{match.matchDetails.titleScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Artist:</span>
                  <span>{match.matchDetails.artistScore}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span>{match.matchDetails.durationScore}%</span>
                </div>
              </div>

              <div className="absolute top-2 right-2 text-[10px] opacity-30 font-mono">
                MBID: {match.mbid}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
