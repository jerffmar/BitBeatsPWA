
import { useState, useCallback } from 'react';
import { identifyAudioFile, IdentificationResult } from '../services/acoustid';

// Hardcoded blacklist of major commercial artists for compliance demonstration
const COMMERCIAL_BLACKLIST = [
  'Taylor Swift',
  'Drake',
  'Ed Sheeran',
  'Sony Music',
  'Warner Music',
  'Universal Music Group',
  'Metallica'
];

export type ProcessStatus = 'idle' | 'processing' | 'identifying' | 'success' | 'error' | 'rejected';

export const useTrackIdentifier = () => {
  const [status, setStatus] = useState<ProcessStatus>('idle');
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<'clean' | 'rejected'>('clean');

  const identify = useCallback(async (file: File) => {
    setStatus('processing');
    setResult(null);
    setError(null);
    setComplianceStatus('clean');

    try {
      // 1. Processing & Identification
      setStatus('identifying');
      const data = await identifyAudioFile(file);
      
      // 2. Compliance Check
      const isBlacklisted = COMMERCIAL_BLACKLIST.some(blocked => 
        data.artist.toLowerCase().includes(blocked.toLowerCase()) || 
        data.title.toLowerCase().includes(blocked.toLowerCase())
      );

      if (isBlacklisted) {
        setComplianceStatus('rejected');
        setStatus('rejected');
        setError(`Compliance Alert: Content by "${data.artist}" is restricted on this network.`);
        setResult(data); // We still return data so UI can show what was rejected
        return;
      }

      setResult(data);
      setStatus('success');

    } catch (err: any) {
      console.error("Hook Error:", err);
      setError(err.message || "Failed to identify track.");
      setStatus('error');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setComplianceStatus('clean');
  }, []);

  return {
    status,
    result,
    error,
    complianceStatus,
    identify,
    reset
  };
};
