import { calculateSimilarity } from '../utils/stringDistance.ts';

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
 * Helper: Smartly selects the "Best" release from a list.
 * Prioritizes: Albums > EPs > Singles, Official status, and Earliest Date.
 */
const getBestReleaseInfo = (releases: any[] = []) => {
  if (!releases || releases.length === 0) {
    return { title: 'Unknown Album', year: '' };
  }

  const best = releases.sort((a, b) => {
    // 1. Type Priority (Album > EP > Single > Compilation)
    const getScore = (r: any) => {
      const type = r['release-group']?.['primary-type'] || '';
      const secondary = r['release-group']?.['secondary-types'] || [];
      
      let score = 0;
      if (type === 'Album') score += 10;
      if (type === 'EP') score += 5;
      if (type === 'Single') score += 2;
      
      // Penalize Compilations/Live unless they are the only option
      if (secondary.includes('Compilation') || secondary.includes('Live')) score -= 2;
      
      // 2. Status Priority
      if (r.status === 'Official') score += 3;
      
      return score;
    };

    const scoreA = getScore(a);
    const scoreB = getScore(b);

    if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first

    // 3. Date Priority (Prefer older/original releases)
    const dateA = a.date || '9999';
    const dateB = b.date || '9999';
    return dateA.localeCompare(dateB);
  })[0];

  return {
    title: best.title,
    year: best.date?.substring(0, 4) || ''
  };
};

/**
 * Cleans filename by removing common track prefixes.
 * Examples: "01. Song.mp3" -> "Song", "CD01.01. Song.mp3" -> "Song", "A1 - Song.mp3" -> "Song"
 */
const cleanFilename = (filename: string) => {
  // Remove extension
  let name = filename.substring(0, filename.lastIndexOf('.')) || filename;
  // Remove bracketed annotations
  name = name.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
  // Normalize separators
  name = name.replace(/_/g, ' ').replace(/-/g, ' ');
  // Remove common numeric prefixes "01.", "1 -", "CD1.02." etc.
  name = name.replace(/^((?:CD|Dis[ck]|Track|Side|[A-Z])?\s*\d+(?:[.\-]\d+)*\s*[ ._\-]+)+/i, '');
  return name.trim();
};

/**
 * Extracts candidate parts with multiple heuristics:
 * - Artist - Title
 * - Album - NN - Title
 * - Title only
 */
const parseFilenameSmart = (filename: string) => {
  const clean = cleanFilename(filename);

  // Pattern: Artist - Title
  let m = clean.match(/^(.+?)\s*-\s*(.+?)$/);
  if (m) {
    return { a: m[1].trim(), t: m[2].trim(), hasArtist: true };
  }

  // Pattern: Album - NN - Title (use last segment as title)
  const parts = clean.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const title = parts[parts.length - 1];
    const artistOrAlbum = parts[0]; // Often album or artist; we will try both orders later
    return { a: artistOrAlbum, t: title, hasArtist: true };
  }

  // Fallback: Title only
  return { a: '', t: clean, hasArtist: false };
};

// Prefer best release by type/status/date
const pickBestRelease = (releases: any[] = []) => {
  if (!releases || releases.length === 0) return { title: 'Unknown Album', year: '' };

  const scoreRelease = (r: any) => {
    const type = r['release-group']?.['primary-type'] || '';
    const secondary = r['release-group']?.['secondary-types'] || [];
    let score = 0;
    if (type === 'Album') score += 10;
    if (type === 'EP') score += 5;
    if (type === 'Single') score += 2;
    if (r.status === 'Official') score += 3;
    if (secondary.includes('Compilation') || secondary.includes('Live')) score -= 2;
    return score;
  };

  const sorted = releases.slice().sort((a, b) => {
    const sa = scoreRelease(a);
    const sb = scoreRelease(b);
    if (sa !== sb) return sb - sa;
    const da = a.date || '9999';
    const db = b.date || '9999';
    return da.localeCompare(db);
  });

  const best = sorted[0];
  return { title: best?.title || 'Unknown Album', year: best?.date?.substring(0, 4) || '' };
};

/**
 * Try one Lucene search strategy and return the top-scoring fuzzy candidate.
 */
const fuzzySearchStrategy = async (title: string, artist?: string, fileDuration?: number) => {
  // Build Lucene query
  let lucene = `recording:"${title.replace(/"/g, '\\"')}"`;
  if (artist) lucene += ` AND artist:"${artist.replace(/"/g, '\\"')}"`;

  const url = `${MB_API_BASE}/recording?query=${encodeURIComponent(lucene)}&limit=15&fmt=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'BitBeats/2.0' } });
  const data = await res.json();
  const mbCandidates = data.recordings || [];

  let bestCandidate: any = null;
  let highestConfidence = 0;

  for (const rec of mbCandidates) {
    const recTitle = rec.title;
    const recArtist = rec['artist-credit']?.[0]?.name || '';
    const recDuration = rec.length ? rec.length / 1000 : 0;

    // Title/Artist similarity
    const titleScore = calculateSimilarity(title, recTitle);
    const artistScore = artist ? calculateSimilarity(artist, recArtist) : 0.5;

    // Duration tolerance (±30s strong, ±60s weak)
    let durationScore = 0.5;
    if (fileDuration && recDuration) {
      const diff = Math.abs(fileDuration - recDuration);
      if (diff <= 10) durationScore = 1.0;
      else if (diff <= 30) durationScore = 0.8;
      else if (diff <= 60) durationScore = 0.6;
      else durationScore = 0.4;
    }

    // Weighted score: Title (55%) + Artist (25%) + Duration (20%)
    const total = (titleScore * 0.55) + (artistScore * 0.25) + (durationScore * 0.20);
    if (total > highestConfidence) {
      highestConfidence = total;
      bestCandidate = rec;
    }
  }

  if (!bestCandidate || highestConfidence < 0.35) return null;

  const bestRelease = pickBestRelease(bestCandidate.releases);
  return {
    id: bestCandidate.id,
    title: bestCandidate.title,
    artist: bestCandidate['artist-credit']?.[0]?.name || 'Unknown',
    album: bestRelease.title,
    year: bestRelease.year,
    confidence: highestConfidence
  };
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
            const bestRelease = getBestReleaseInfo(rec.releases);
            
            acoustIdResult = {
                title: rec.title,
                artist: rec.artists?.[0]?.name || 'Unknown',
                album: bestRelease.title,
                mbid: rec.id,
                year: bestRelease.year,
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
 * Helper: Fuzzy Match Strategy using multiple query orders and relaxed tolerance
 */
const attemptFuzzyMatch = async (file: File, fileDuration: number): Promise<IdentificationResult> => {
  const { a, t, hasArtist } = parseFilenameSmart(file.name);
  console.log("⚠️ Falling back to Fuzzy Metadata Matching...");

  // Try Artist+Title first
  let candidate = await fuzzySearchStrategy(t, hasArtist ? a : undefined, fileDuration);
  // If not found, try Title-only
  if (!candidate) candidate = await fuzzySearchStrategy(t, undefined, fileDuration);
  // If still not found and we had "Album - NN - Title", try swapped (Title, Artist)
  if (!candidate && hasArtist) candidate = await fuzzySearchStrategy(a, t, fileDuration);

  if (candidate) {
    return {
      mbid: candidate.id,
      title: candidate.title,
      artist: candidate.artist,
      album: candidate.album,
      year: candidate.year,
      coverUrl: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=300',
      score: candidate.confidence,
      methodUsed: 'fuzzy',
      duration: fileDuration
    };
  }

  // Last resort: read embedded tags and keep metadata as-is
  const tagResult = await readEmbeddedTags(file);
  if (tagResult) {
    console.warn('ℹ️ Using embedded tags as last resort identification.');
    return tagResult;
  }

  throw new IdentificationError("No matches found using any identification method.");
};

// --- Last-Resort: Read embedded tags from file ---
const readEmbeddedTags = async (file: File): Promise<IdentificationResult | null> => {
  try {
    // Dynamic import to avoid hard dependency when not installed
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mm = await import('music-metadata-browser');
    const metadata = await mm.parseBlob(file);

    const common = metadata?.common || {};
    const title = common.title || file.name.replace(/\.[^/.]+$/, '');
    const artist = (common.artists && common.artists[0]) || common.artist || 'Unknown Artist';
    const album = common.album || 'Unknown Album';
    const year = common.year ? String(common.year) : '';
    const picture = (common.picture && common.picture[0]) ? common.picture[0] : null;
    
    // Build a data URL for embedded cover art if present
    let coverUrl: string | undefined;
    if (picture?.data && picture?.format) {
      const blob = new Blob([picture.data], { type: picture.format });
      coverUrl = URL.createObjectURL(blob);
    }

    return {
      mbid: '', // Unknown without MB lookup
      title,
      artist,
      album,
      year,
      coverUrl,
      score: 0.5, // Neutral confidence
      methodUsed: 'fuzzy', // keep pipeline consistent; visually it will show fallback result
      duration: 0
    };
  } catch {
    return null;
  }
};
