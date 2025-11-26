
const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY || '8XaBELgH'; // Use env var in prod
const MB_API_BASE = 'https://musicbrainz.org/ws/2';

interface TrackMetadata {
  mbid: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  year: string;
  tags: string[];
}

// In-memory cache for demo purposes since Prisma is not available in this environment
// This acts as a fallback for the database layer
const MEMORY_CACHE = new Map<string, TrackMetadata>();

/**
 * Metadata Caching Service
 * Implements a "Read-Through" strategy:
 * 1. Check DB/Cache for Fingerprint.
 * 2. If missing, query external APIs (AcoustID -> MusicBrainz).
 * 3. Save result to DB/Cache.
 * 4. Return Data.
 */
export const resolveFingerprint = async (fingerprint: string, duration: number): Promise<TrackMetadata> => {
  
  // 1. Local Lookup
  if (MEMORY_CACHE.has(fingerprint)) {
    console.log("💿 Cache Hit: Returning local metadata.");
    return MEMORY_CACHE.get(fingerprint)!;
  }

  console.log("🌐 Cache Miss: Querying external APIs...");

  // 2. External Lookup (Fallback)
  
  // A. AcoustID Lookup
  const acoustIdUrl = `https://api.acoustid.org/v2/lookup?client=${ACOUSTID_API_KEY}&meta=recordings+releasegroups+compress&duration=${Math.floor(duration)}&fingerprint=${fingerprint}`;
  
  const acResponse = await fetch(acoustIdUrl);
  const acData = await acResponse.json();

  if (!acData.results || acData.results.length === 0) {
    throw new Error("Track not identified by AcoustID");
  }

  // Get best match
  const bestMatch = acData.results.sort((a: any, b: any) => b.score - a.score)[0];
  const recordingMbid = bestMatch.recordings?.[0]?.id;

  if (!recordingMbid) {
    throw new Error("No MusicBrainz ID found for this fingerprint");
  }

  // B. MusicBrainz Lookup (Full Metadata)
  // We need Artist, Release (Album), and Cover Art info
  const mbUrl = `${MB_API_BASE}/recording/${recordingMbid}?inc=artist-credits+releases+tags&fmt=json`;
  const mbResponse = await fetch(mbUrl, { headers: { 'User-Agent': 'BitBeats/2.0.0 ( backend@bitbeats.p2p )' } });
  const mbData = await mbResponse.json();

  const artistData = mbData['artist-credit']?.[0]?.artist;
  const releaseData = mbData.releases?.[0]; // Take first release as default album
  
  if (!artistData || !releaseData) {
    throw new Error("Incomplete metadata from MusicBrainz");
  }

  const coverUrl = `https://coverartarchive.org/release/${releaseData.id}/front-250`;
  // Check if cover exists (optional optimization: head request), otherwise fallback
  // For implementation speed, we store the URL. Frontend handles 404s.

  // 3. Persist (Write-Back)
  const result: TrackMetadata = {
      mbid: recordingMbid,
      title: mbData.title,
      artist: artistData.name,
      album: releaseData.title,
      coverUrl: coverUrl,
      year: releaseData.date ? releaseData.date.substring(0, 4) : '',
      tags: (mbData.tags || []).map((t: any) => t.name)
  };

  // Save to in-memory cache
  MEMORY_CACHE.set(fingerprint, result);

  return result;
};
