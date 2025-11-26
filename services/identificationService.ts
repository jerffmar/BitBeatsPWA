import { calculateSimilarity } from '../utils/stringDistance';

// Toggle this to FALSE when actual backend and WASM are ready
const USE_MOCK = true;

const ACOUSTID_API_KEY = '8XaBELgH'; // Public demo key
const MB_API_BASE = 'https://musicbrainz.org/ws/2';

export interface IdentificationResult {
  mbid: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  coverUrl?: string;
  score: number; // Confidence 0-1 or 0-100
  methodUsed: 'cache' | 'fingerprint' | 'fuzzy';
  duration: number;
}

export class IdentificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentificationError";
  }
}

/**
 * Extracts Artist and Title from filenames.
 * e.g. "The Midnight - Sunset.mp3" -> { artist: "The Midnight", title: "Sunset" }
 */
const parseFilename = (filename: string) => {
  const cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;
  
  // Try "Artist - Title"
  const hyphenMatch = cleanName.match(/^(.+?)\s*-\s*(.+?)$/);
  if (hyphenMatch) {
    return {
      artist: hyphenMatch[1].trim(),
      title: hyphenMatch[2].trim()
    };
  }
  
  // Fallback: Use whole name as title
  return { title: cleanName.trim(), artist: '' };
};

/**
 * Main Orchestrator
 */
export const identifyAudioFile = async (
  file: File, 
  onStatusUpdate?: (status: string) => void
): Promise<IdentificationResult> => {
  
  console.log(`🕵️ Starting Hybrid Identification for: ${file.name}`);

  // --- STEP 1: GENERATE FINGERPRINT ---
  if (onStatusUpdate) onStatusUpdate('fingerprinting');
  
  let fingerprint = '';
  let duration = 0;

  try {
    if (USE_MOCK) {
       await new Promise(r => setTimeout(r, 800)); // Simulate WASM
       duration = 245; // seconds
       fingerprint = 'mock_fingerprint_hash_abc123';
    } else {
        // @ts-ignore
        const fpcalc = await import('fpcalc-browser');
        const result = await fpcalc.calculate(file);
        duration = result.duration;
        fingerprint = result.fingerprint;
    }
  } catch (err) {
    console.warn("Fingerprinting failed, skipping to fuzzy match immediately.");
    // If fingerprinting fails entirely (e.g. WASM error), skip to Fuzzy
    return attemptFuzzyMatch(file, 0); 
  }

  // --- STEP 2: INTERNAL CACHE CHECK ---
  if (onStatusUpdate) onStatusUpdate('checking_db');

  try {
    let internalResult = null;
    
    if (USE_MOCK) {
       // Simulate 30% Cache Hit
       await new Promise(r => setTimeout(r, 600)); 
       if (Math.random() < 0.3) {
           internalResult = {
               mbid: 'internal-db-id-123',
               title: 'Cached Song',
               artist: 'Cached Artist',
               album: 'Cached Album',
               year: '2023',
               coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300',
               tags: ['cached']
           };
       }
    } else {
       // Real Backend Call
       const res = await fetch('/api/identify', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ fingerprint, duration })
       });
       if (res.ok) {
           const json = await res.json();
           if (json.success) internalResult = json.data;
       }
    }

    if (internalResult) {
        console.log("✅ Internal Cache Hit!");
        return {
            ...internalResult,
            score: 1.0,
            methodUsed: 'cache',
            duration
        };
    }

  } catch (e) {
      console.warn("Internal DB check failed, proceeding to external.");
  }

  // --- STEP 3: EXTERNAL ACOUSTID LOOKUP ---
  if (onStatusUpdate) onStatusUpdate('checking_external');

  try {
     let acoustIdResult = null;

     if (USE_MOCK) {
        // Simulate 50% AcoustID Hit if DB missed
        await new Promise(r => setTimeout(r, 1000));
        if (Math.random() < 0.5) {
            acoustIdResult = {
                title: 'Midnight City',
                artist: 'M83',
                album: 'Hurry Up, We\'re Dreaming',
                mbid: '5b113466-2e9d-4790-b146-4277d337a5c8',
                year: '2011',
                score: 0.95
            };
        }
     } else {
        const url = `https://api.acoustid.org/v2/lookup?client=${ACOUSTID_API_KEY}&meta=recordings+releases&duration=${Math.floor(duration)}&fingerprint=${fingerprint}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const best = data.results.sort((a: any, b: any) => b.score - a.score)[0];
            if (best.score > 0.8 && best.recordings?.[0]) {
                const rec = best.recordings[0];
                acoustIdResult = {
                    title: rec.title,
                    artist: rec.artists?.[0]?.name || 'Unknown',
                    album: rec.releases?.[0]?.title || 'Unknown',
                    mbid: rec.id,
                    year: rec.releases?.[0]?.date?.substring(0, 4) || '',
                    score: best.score
                };
            }
        }
     }

     if (acoustIdResult) {
         console.log("✅ AcoustID Hit!");
         return {
             ...acoustIdResult,
             methodUsed: 'fingerprint',
             duration,
             // Add a generic cover if missing (AcoustID doesn't provide art usually)
             coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300'
         };
     }

  } catch (e) {
      console.warn("AcoustID check failed, proceeding to fuzzy.");
  }

  // --- STEP 4: FUZZY FALLBACK ---
  if (onStatusUpdate) onStatusUpdate('fuzzy_matching');
  return attemptFuzzyMatch(file, duration);
};

/**
 * Helper: Fuzzy Match Strategy using Metadata and Levenshtein Distance
 */
const attemptFuzzyMatch = async (file: File, fileDuration: number): Promise<IdentificationResult> => {
    console.log("⚠️ Falling back to Fuzzy Metadata Matching...");
    
    const { artist, title } = parseFilename(file.name);
    
    // Construct Lucene Query
    let query = `recording:"${title.replace(/"/g, '')}"`;
    if (artist) query += ` AND artist:"${artist.replace(/"/g, '')}"`;
    
    const url = `${MB_API_BASE}/recording?query=${encodeURIComponent(query)}&limit=10&fmt=json`;

    let mbCandidates: any[] = [];

    if (USE_MOCK) {
        await new Promise(r => setTimeout(r, 1000));
        // Mock a successful fuzzy match
        if (title.toLowerCase().includes('sunset')) {
             mbCandidates = [{
                 id: 'fuzzy-mbid-789',
                 title: 'Sunset',
                 score: 100,
                 'artist-credit': [{ name: 'The Midnight' }],
                 releases: [{ title: 'Endless Summer', date: '2016-08-05' }],
                 length: 245000 // ms
             }];
        }
    } else {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'BitBeats/2.0' } });
            const data = await res.json();
            mbCandidates = data.recordings || [];
        } catch (e) {
            throw new IdentificationError("MusicBrainz API unreachable.");
        }
    }

    // Rank Candidates
    let bestCandidate = null;
    let highestConfidence = 0;

    for (const rec of mbCandidates) {
        const recTitle = rec.title;
        const recArtist = rec['artist-credit']?.[0]?.name || '';
        const recDuration = rec.length ? rec.length / 1000 : 0;

        // Score Calculation
        const titleScore = calculateSimilarity(title, recTitle);
        
        let artistScore = 0;
        if (artist) {
            artistScore = calculateSimilarity(artist, recArtist);
        } else {
            artistScore = 0.5; // Neutral if we don't know the artist
        }

        let durationScore = 0;
        if (recDuration && fileDuration > 0) {
             const diff = Math.abs(fileDuration - recDuration);
             if (diff < 5) durationScore = 1;
             else if (diff < 15) durationScore = 0.8;
             else if (diff < 30) durationScore = 0.5;
        } else {
            durationScore = 0.5; // Neutral if duration missing
        }

        // Weighted Average
        // Title is king (50%), Artist (30%), Duration (20%)
        const totalScore = (titleScore * 0.5) + (artistScore * 0.3) + (durationScore * 0.2);
        
        if (totalScore > highestConfidence) {
            highestConfidence = totalScore;
            bestCandidate = rec;
        }
    }

    if (bestCandidate && highestConfidence > 0.4) {
        console.log(`✅ Fuzzy Match Found: ${bestCandidate.title} (${(highestConfidence*100).toFixed(0)}%)`);
        return {
            mbid: bestCandidate.id,
            title: bestCandidate.title,
            artist: bestCandidate['artist-credit']?.[0]?.name || 'Unknown',
            album: bestCandidate.releases?.[0]?.title || 'Unknown',
            year: bestCandidate.releases?.[0]?.date?.substring(0, 4) || '',
            coverUrl: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=300', // Fallback
            score: highestConfidence,
            methodUsed: 'fuzzy',
            duration: fileDuration
        };
    }

    throw new IdentificationError("No matches found using any identification method.");
};