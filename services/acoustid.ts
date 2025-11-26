
import { DetailedMetadata } from './musicBrainz';

// Toggle this to FALSE when actual fpcalc-browser and WASM files are installed
const USE_MOCK = true;
const ACOUSTID_API_KEY = '8XaBELgH'; // Public demo key, restricted rate limits

export interface IdentificationResult {
  score: number;
  mbid: string; // Recording ID
  title: string;
  artist: string;
  album: string;
  year?: string;
  fingerprint?: string;
  duration?: number;
}

/**
 * 1. Initialize fpcalc
 * 2. Fingerprint Audio (Client-Side WASM)
 * 3. Lookup AcoustID
 */
export const identifyAudioFile = async (file: File): Promise<IdentificationResult> => {
  console.log(`🔍 Starting identification for: ${file.name}`);

  if (USE_MOCK) {
    return mockIdentification(file);
  }

  try {
    // Dynamic import to avoid build errors if package is missing
    // @ts-ignore
    const fpcalc = await import('fpcalc-browser');

    // 1. Calculate Fingerprint locally
    // duration is in seconds, fingerprint is a compressed string
    const { duration, fingerprint } = await fpcalc.calculate(file);
    
    console.log(`Generated Fingerprint (${duration}s): ${fingerprint.substring(0, 20)}...`);

    // 2. Query AcoustID API
    const response = await fetch(
      `https://api.acoustid.org/v2/lookup?client=${ACOUSTID_API_KEY}&meta=recordings+releases+usermeta&duration=${Math.floor(duration)}&fingerprint=${fingerprint}`
    );

    if (!response.ok) {
      throw new Error(`AcoustID API Error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error("No matches found in AcoustID database.");
    }

    // 3. Parse best match
    // Sort by score
    const bestMatch = data.results.sort((a: any, b: any) => b.score - a.score)[0];

    if (bestMatch.score < 0.6) {
      throw new Error("Match confidence too low.");
    }

    const recording = bestMatch.recordings?.[0];
    const release = recording?.releases?.[0];

    if (!recording) {
      throw new Error("Fingerprint matched, but no metadata available.");
    }

    return {
      score: bestMatch.score,
      mbid: recording.id,
      title: recording.title,
      artist: recording.artists?.[0]?.name || 'Unknown Artist',
      album: release?.title || 'Unknown Album',
      year: release?.date?.substring(0, 4) || '',
      fingerprint,
      duration
    };

  } catch (err: any) {
    console.error("Identification Service Error:", err);
    throw err;
  }
};

/**
 * MOCK FALLBACK
 * Simulates the WASM delay and API roundtrip
 */
const mockIdentification = async (file: File): Promise<IdentificationResult> => {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate WASM processing + Network

  // Copyright Trap Mock
  if (file.name.toLowerCase().includes('shake') || file.name.toLowerCase().includes('taylor')) {
    return {
      score: 0.98,
      mbid: 'fake-mbid-ts-123',
      title: "Shake It Off",
      artist: "Taylor Swift",
      album: "1989",
      year: "2014",
      fingerprint: "mock_fp_string",
      duration: 219
    };
  }
  
  // Standard Success Mock
  return {
    score: 0.95,
    mbid: '5b113466-2e9d-4790-b146-4277d337a5c8',
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    year: "2011",
    fingerprint: "mock_fp_string_valid",
    duration: 243
  };
};
