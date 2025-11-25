
import { useState, useCallback } from 'react';
import { decodeAudio, generateFingerprint, lookupAcoustID, enrichMetadata, IdentificationResult } from '../services/fingerprintService';
import { DetailedMetadata } from '../services/musicBrainz';

export type IdentificationStatus = 'idle' | 'decoding' | 'fingerprinting' | 'identifying' | 'success' | 'error';

export interface AudioIdentificationState {
  status: IdentificationStatus;
  metadata: DetailedMetadata | null;
  error: string | null;
  complianceStatus: 'clean' | 'blacklisted' | 'unknown';
}

// Mock Blacklist for Copyright Compliance
const ARTIST_BLACKLIST = [
  'Taylor Swift', 
  'Metallica', 
  'Sony Music', 
  'The Beatles' // Just for demo
];

export const useAudioIdentification = () => {
  const [state, setState] = useState<AudioIdentificationState>({
    status: 'idle',
    metadata: null,
    error: null,
    complianceStatus: 'unknown'
  });

  const processFile = useCallback(async (file: File) => {
    setState({ status: 'decoding', metadata: null, error: null, complianceStatus: 'unknown' });

    try {
      // 1. Decode Audio (Web Audio API)
      const audioBuffer = await decodeAudio(file);

      // 2. Generate Fingerprint (WASM Simulation)
      setState(prev => ({ ...prev, status: 'fingerprinting' }));
      const { fingerprint, duration } = await generateFingerprint(audioBuffer);

      // 3. Identify (AcoustID)
      setState(prev => ({ ...prev, status: 'identifying' }));
      const result: IdentificationResult | null = await lookupAcoustID(fingerprint, duration);

      if (!result) {
        // Fallback if not found (allow manual entry in real app, but error here for demo)
        throw new Error("Could not identify track in Global Database.");
      }

      // 4. Compliance Check (Blacklist)
      if (ARTIST_BLACKLIST.some(blocked => result.artist.includes(blocked))) {
        setState({
          status: 'error',
          metadata: null,
          error: `Copyright Blocked: Content by ${result.artist} is restricted on this network.`,
          complianceStatus: 'blacklisted'
        });
        return;
      }

      // 5. Success - Enrich Metadata
      const fullMetadata = await enrichMetadata(result);
      
      setState({
        status: 'success',
        metadata: fullMetadata,
        error: null,
        complianceStatus: 'clean'
      });

    } catch (err: any) {
      console.error("Identification Flow Error:", err);
      setState({
        status: 'error',
        metadata: null,
        error: err.message || "Failed to process audio file.",
        complianceStatus: 'unknown'
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      metadata: null,
      error: null,
      complianceStatus: 'unknown'
    });
  }, []);

  return {
    ...state,
    processFile,
    reset
  };
};
