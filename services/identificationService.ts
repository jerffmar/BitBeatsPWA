
import { calculateSimilarity } from '../utils/stringDistance';

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
 * Cleans filename by removing common track prefixes.
 * Examples: 
 * "01. Song.mp3" -> "Song"
 * "CD01.01. Song.mp3" -> "Song"
 * "A1 - Song.mp3" -> "Song"
 */
const cleanFilename = (filename: string) => {
  // Remove extension
  let name = filename.substring(0, filename.lastIndexOf('.')) || filename;
  
  // Regex to remove prefixes like: "01.", "CD1.", "A1.", "1 - ", "CD02.18. "
  // Matches optional text prefix (CD/Track) followed by digits and optional sub-digits/separators
  name = name.replace(/^((?:CD|Dis[ck]|Track|Side|[A-Z])?\s*\d+(?:[\.\-]\d+)*\s*[ ._\-]+)+/i, '');
  
  return name.trim() || name; 
};

/**
 * Extracts potential Artist and Title parts.
 */
const parseFilename = (filename: string) => {
  const cleanName = cleanFilename(filename);
  
  // Try "Part 1 - Part 2"
  const hyphenMatch = cleanName.match(/^(.+?)\s*-\s*(.+?)$/);
  if (hyphenMatch) {
    return {
      part1: hyphenMatch[1].trim(),
      part2: hyphenMatch[2].trim(),
      hasSplit: true
    };
  }
  
  // Fallback: Use whole name
  return { part1: cleanName, part2: '', hasSplit: false };
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
    // Dynamic import to support optional installation of the heavy WASM library
    // @ts-ignore
    const fpcalc = await import('fpcalc-browser');
    const result = await fpcalc.calculate(file);
    duration = result.duration;
    fingerprint = result.fingerprint;
  } catch (err) {
    console.warn("Fingerprinting skipped (fpcalc-browser missing or error). Falling back to Fuzzy Match.");
    // If fingerprinting fails entirely (e.g. library missing), skip to Fuzzy
    return attemptFuzzyMatch(file, 0); 
  }

  // --- STEP 2: INTERNAL CACHE CHECK ---
  if (onStatusUpdate) onStatusUpdate('checking_db');

  try {
    let internalResult = null;
    
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
    
    const { part1, part2, hasSplit } = parseFilename(file.name);
    
    // Construct Lucene Query
    // Use an OR query to handle both "Artist - Title" and "Title - Artist" formats
    // Escape quotes for Lucene
    let query = '';
    const p1 = part1.replace(/"/g, '\\"');
    const p2 = part2.replace(/"/g, '\\"');
    
    if (hasSplit) {
        query = `(recording:"${p1}" AND artist:"${p2}") OR (recording:"${p2}" AND artist:"${p1}")`;
    } else {
        query = `recording:"${p1}"`;
    }
    
    const url = `${MB_API_BASE}/recording?query=${encodeURIComponent(query)}&limit=15&fmt=json`;

    let mbCandidates: any[] = [];

    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'BitBeats/2.0' } });
        const data = await res.json();
        mbCandidates = data.recordings || [];
    } catch (e) {
        throw new IdentificationError("MusicBrainz API unreachable.");
    }

    // Rank Candidates
    let bestCandidate = null;
    let highestConfidence = 0;

    for (const rec of mbCandidates) {
        const recTitle = rec.title;
        const recArtist = rec['artist-credit']?.[0]?.name || '';
        const recDuration = rec.length ? rec.length / 1000 : 0;

        let maxTextScore = 0;

        if (hasSplit) {
            // Scenario A: Part1 = Title, Part2 = Artist
            const tA = calculateSimilarity(part1, recTitle);
            const aA = calculateSimilarity(part2, recArtist);
            const scoreA = (tA * 0.6) + (aA * 0.4);

            // Scenario B: Part2 = Title, Part1 = Artist (Swap)
            const tB = calculateSimilarity(part2, recTitle);
            const aB = calculateSimilarity(part1, recArtist);
            const scoreB = (tB * 0.6) + (aB * 0.4);

            maxTextScore = Math.max(scoreA, scoreB);
        } else {
            // Only have one part, assume it's the title
            const titleScore = calculateSimilarity(part1, recTitle);
            maxTextScore = (titleScore * 0.8) + 0.1; // Slight penalty for missing artist verification
        }

        // Duration Check
        let durationScore = 0;
        if (recDuration && fileDuration > 0) {
             const diff = Math.abs(fileDuration - recDuration);
             if (diff < 5) durationScore = 1;
             else if (diff < 15) durationScore = 0.8;
             else if (diff < 30) durationScore = 0.5;
        } else {
            durationScore = 0.5; // Neutral if duration missing in metadata
        }

        // Weighted Average: Text Score (80%) + Duration (20%)
        const totalScore = (maxTextScore * 0.8) + (durationScore * 0.2);
        
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
