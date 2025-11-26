import { useState, useCallback } from 'react';
import { identifyAudioFile, IdentificationResult, IdentificationError } from '../services/identificationService';

export type IdentificationStatus = 
  | 'idle' 
  | 'fingerprinting' 
  | 'checking_db' 
  | 'checking_external' 
  | 'fuzzy_matching' 
  | 'success' 
  | 'error' 
  | 'rejected';

// Hardcoded blacklist of major commercial artists
const BLACKLIST = [
  'Taylor Swift',
  'Drake',
  'Ed Sheeran',
  'Sony Music',
  'Warner Music',
  'Universal Music Group',
  'Metallica',
  'The Beatles'
];

export const useTrackIdentifier = () => {
  const [status, setStatus] = useState<IdentificationStatus>('idle');
  const [result, setResult] = useState<IdentificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complianceStatus, setComplianceStatus] = useState<'clean' | 'rejected'>('clean');

  const identify = useCallback(async (file: File) => {
    // Reset state
    setStatus('fingerprinting'); // Start state
    setResult(null);
    setError(null);
    setComplianceStatus('clean');

    try {
      // Execute Hybrid Flow
      const data = await identifyAudioFile(file, (currentStatus) => {
          // Map service status strings to our state type if needed
          // The service uses strings that match our type, but we cast to be safe
          setStatus(currentStatus as IdentificationStatus);
      });

      // Compliance Check (Client-Side)
      const artist = data.artist.toLowerCase();
      const title = data.title.toLowerCase();
      
      const isBlacklisted = BLACKLIST.some(blocked => 
          artist.includes(blocked.toLowerCase()) || 
          title.includes(blocked.toLowerCase())
      );

      if (isBlacklisted) {
          setResult(data); // Store data to show WHAT was rejected
          setComplianceStatus('rejected');
          setStatus('rejected');
          setError(`Compliance Alert: Content by "${data.artist}" is restricted on this network.`);
          return;
      }

      // Success
      setResult(data);
      setStatus('success');

    } catch (err: any) {
      console.error("Identification Hook Error:", err);
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