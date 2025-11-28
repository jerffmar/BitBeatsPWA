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
 * Helper: Fuzzy Match Strategy using multiple query orders and relaxed tolerance
 */
const attemptFuzzyMatch = async (file: File, fileDuration: number): Promise<IdentificationResult> => {
  const { a, t, hasArtist } = parseFilenameSmart(file.name);
  console.log('⚠️ Falling back to Fuzzy Metadata Matching...');

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

  // --- NEW: Minimal fallback if all else fails ---
  const cleanedTitle = cleanFilename(file.name);
  console.warn('⚠️ No fuzzy match found. Returning minimal fallback metadata.');
  return {
    mbid: '',
    title: cleanedTitle,
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    year: '',
    coverUrl: undefined,
    score: 0.2,
    methodUsed: 'fuzzy',
    duration: fileDuration
  };
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

const identifyViaServerUpload = async (file: File): Promise<IdentificationResult | null> => {
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/identify/upload', { method: 'POST', body: form });
    if (!res.ok) {
      console.warn(`[ID] Server upload endpoint returned ${res.status}`);
      return null;
    }
    const json = await res.json();
    if (!json.success || !json.data) return null;

    const payload = json.data;
    return {
      mbid: payload.mbid || '',
      title: payload.title || file.name,
      artist: payload.artist || 'Unknown',
      album: payload.album || 'Unknown Album',
      year: payload.year || '',
      coverUrl: payload.coverUrl,
      score: payload.score ?? 1,
      methodUsed: 'fingerprint',
      duration: payload.duration ?? 0
    };
  } catch (error) {
    console.error('[ID] Server upload fingerprinting failed.', error);
    return null;
  }
};

export const identifyAudioFile = async (
  file: File,
  onStatusUpdate?: (status: string) => void
): Promise<IdentificationResult> => {
  console.log(`🕵️ Starting Hybrid Identification for: ${file.name}`);
  onStatusUpdate?.('fingerprinting');

  const ENABLE_FINGERPRINTING = import.meta.env.VITE_ENABLE_FINGERPRINTING !== 'false';
  const FINGERPRINT_REQUIRED_ERR = 'Fingerprinting disabled. Set VITE_ENABLE_FINGERPRINTING to true.';

  if (!ENABLE_FINGERPRINTING) {
    console.warn('[ID] Fingerprinting disabled; falling back to fuzzy identification.', FINGERPRINT_REQUIRED_ERR);
    onStatusUpdate?.('fuzzy_matching');
    return attemptFuzzyMatch(file, 0);
  }

  let fingerprint = '';
  let duration = 0;
  let fingerprintReady = false;

  try {
    console.log('[ID] Loading fpcalc-browser module…');
    // @ts-ignore
    const fpcalc = await import('fpcalc-browser');
    console.log('[ID] Module loaded. Generating fingerprint…');
    const result = await fpcalc.calculate(file);
    duration = result.duration;
    fingerprint = result.fingerprint;
    fingerprintReady = true;
    console.log(`[ID] Fingerprint generated (${duration.toFixed(2)}s). Hash preview: ${fingerprint.slice(0, 24)}…`);
  } catch (err) {
    console.error('[ID] Fingerprinting failed before lookup.', err);
    console.log('[ID] Attempting server-side fingerprint fallback…');
    const serverResult = await identifyViaServerUpload(file);
    if (serverResult) {
      console.log('[ID] Server-side fingerprint succeeded. Returning metadata.');
      return serverResult;
    }
    console.warn('[ID] No fingerprint available; continuing with fuzzy strategy.');
    onStatusUpdate?.('fuzzy_matching');
    return attemptFuzzyMatch(file, 0);
  }

  onStatusUpdate?.('checking_db');
  console.log('[ID] Checking internal cache via /api/identify…');
  try {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, duration })
    });
    console.log(`[ID] Cache response: ${res.status}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        console.log('✅ Cache hit. Returning stored metadata.');
        return {
          ...json.data,
          score: 1.0,
          methodUsed: 'cache',
          duration
        };
      }
    }
  } catch (e) {
    console.warn('[ID] Internal cache lookup failed, proceeding to external.', e);
  }

  onStatusUpdate?.('checking_external');
  console.log('[ID] Querying AcoustID…');
  try {
    const url = `https://api.acoustid.org/v2/lookup?client=${ACOUSTID_API_KEY}&meta=recordings+releases&duration=${Math.floor(duration)}&fingerprint=${fingerprint}`;
    const res = await fetch(url);
    console.log(`[ID] AcoustID response: ${res.status}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const best = data.results.sort((a: any, b: any) => b.score - a.score)[0];
      if (best.score > 0.8 && best.recordings?.[0]) {
        console.log(`✅ AcoustID hit (score ${best.score}).`);
        const rec = best.recordings[0];
        const bestRelease = getBestReleaseInfo(rec.releases);
        return {
          title: rec.title,
          artist: rec.artists?.[0]?.name || 'Unknown',
          album: bestRelease.title,
          mbid: rec.id,
          year: bestRelease.year,
          score: best.score,
          methodUsed: 'fingerprint',
          duration,
          coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300'
        };
      }
    }
    console.warn('[ID] AcoustID returned no confident matches.');
  } catch (e) {
    console.warn('[ID] AcoustID lookup failed.', e);
  }

  console.warn('[ID] Falling back to fuzzy strategy.');
  onStatusUpdate?.('fuzzy_matching');
  return attemptFuzzyMatch(file, duration);
};