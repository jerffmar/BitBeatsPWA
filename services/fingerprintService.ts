import type { DetailedMetadata } from './musicBrainz.ts';

export interface IdentificationResult {
  title: string;
  artist: string;
  album: string;
  mbid: string; // Recording MBID
  score: number; // Confidence 0-1
}

// In a real implementation, you would import the WASM module here
// import chromaprint from 'chromaprint-js-wasm';

const CONTEXT_OPTIONS = { sampleRate: 44100 }; // Standardize sample rate for fingerprinting

/**
 * Decodes the uploaded audio file into a PCM Buffer.
 * We use the Web Audio API's decodeAudioData.
 */
export const decodeAudio = async (file: File): Promise<AudioBuffer> => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(CONTEXT_OPTIONS);
  const arrayBuffer = await file.arrayBuffer();
  
  // NOTE: decodeAudioData decodes the whole file. 
  // Ideally, we would use the WebCodecs API (AudioDecoder) to stream-decode 
  // only the first 120s, but support is less universal than Web Audio API.
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return audioBuffer;
};

/**
 * Generates an acoustic fingerprint from the audio buffer.
 * MOCKS the WASM Chromaprint implementation.
 */
export const generateFingerprint = async (audioBuffer: AudioBuffer): Promise<{ fingerprint: string; duration: number }> => {
  // 1. Slice buffer to max 120 seconds to optimize processing time
  const maxDuration = 120;
  const duration = Math.min(audioBuffer.duration, maxDuration);
  
  // In a real WASM implementation, we would pass the raw PCM data:
  // const pcmData = audioBuffer.getChannelData(0); // Left channel usually sufficient
  // const fp = await chromaprint.getFingerprint(pcmData, audioBuffer.sampleRate);
  
  // --- MOCK WASM DELAY ---
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate WASM computation
  
  // Generate a fake hash based on duration to be deterministic for the demo
  const mockHash = `AQAA${Math.floor(duration * 1000).toString(36)}_${Math.random().toString(36).substring(2)}`;
  
  return {
    fingerprint: mockHash,
    duration: audioBuffer.duration // We send full duration to AcoustID for better matching
  };
};

/**
 * MOCKS the AcoustID API lookup.
 * In production, this would POST the fingerprint to https://api.acoustid.org/v2/lookup
 */
export const lookupAcoustID = async (fingerprint: string, duration: number): Promise<IdentificationResult | null> => {
  // --- MOCK NETWORK REQUEST ---
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simulating random success/fail for demo purposes
  // In real app, we would fetch(API_URL)
  
  // Let's pretend we found a match
  const isMatch = Math.random() > 0.1; // 90% success rate

  if (!isMatch) return null;

  return {
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    mbid: "b8e1a8a3-2c3a-4d7a-b9e1-2f3a4b5c6d7e",
    score: 0.98
  };
};

/**
 * Helper to enrich the AcoustID result with cover art (from existing service)
 */
export const enrichMetadata = async (idResult: IdentificationResult): Promise<DetailedMetadata> => {
  // In a real flow, we would use the MBID to fetch high-res art from Cover Art Archive
  // For this mock, we return a compatible structure
  return {
    mbid: idResult.mbid,
    title: idResult.title,
    artist: idResult.artist,
    album: idResult.album,
    year: '2011',
    tags: ['electronic', 'synthpop'],
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400'
  };
};
