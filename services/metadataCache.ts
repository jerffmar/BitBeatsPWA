
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client (Singleton is recommended in production)
const prisma = new PrismaClient();

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

/**
 * Metadata Caching Service
 * Implements a "Read-Through" strategy:
 * 1. Check DB for Fingerprint.
 * 2. If missing, query external APIs (AcoustID -> MusicBrainz).
 * 3. Save result to DB.
 * 4. Return Data.
 */
export const resolveFingerprint = async (fingerprint: string, duration: number): Promise<TrackMetadata> => {
  
  // 1. Local Lookup
  const cachedHit = await prisma.audioFingerprint.findUnique({
    where: { hash: fingerprint },
    include: {
      track: {
        include: {
          album: {
            include: {
              artist: true
            }
          }
        }
      }
    }
  });

  if (cachedHit && cachedHit.track && cachedHit.track.album) {
    console.log("💿 Cache Hit: Returning local metadata.");
    const t = cachedHit.track;
    const a = t.album!;
    const art = a.artist;

    return {
      mbid: t.mbId,
      title: t.title,
      artist: art.name,
      album: a.title,
      coverUrl: a.coverUrl,
      year: a.releaseDate ? a.releaseDate.toISOString().substring(0, 4) : '',
      tags: art.tags
    };
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
  // We use a transaction or careful upserts to ensure data integrity
  
  const result = await prisma.$transaction(async (tx) => {
    // Upsert Artist
    const artist = await tx.artist.upsert({
      where: { mbId: artistData.id },
      update: {},
      create: {
        mbId: artistData.id,
        name: artistData.name,
        tags: (mbData.tags || []).map((t: any) => t.name)
      }
    });

    // Upsert Album
    const album = await tx.album.upsert({
      where: { mbId: releaseData.id },
      update: {},
      create: {
        mbId: releaseData.id,
        title: releaseData.title,
        artistId: artist.id,
        releaseDate: releaseData.date ? new Date(releaseData.date) : null,
        coverUrl: coverUrl
      }
    });

    // Upsert Track
    const track = await tx.track.upsert({
      where: { mbId: recordingMbid },
      update: {}, // If exists, don't change
      create: {
        mbId: recordingMbid,
        title: mbData.title,
        duration: duration,
        albumId: album.id
      }
    });

    // Create Fingerprint
    // We assume this exact hash doesn't exist (since we checked cache), 
    // but another hash might point to this track.
    await tx.audioFingerprint.create({
      data: {
        hash: fingerprint,
        duration: duration,
        trackId: track.id
      }
    });

    return {
      mbid: track.mbId,
      title: track.title,
      artist: artist.name,
      album: album.title,
      coverUrl: album.coverUrl,
      year: album.releaseDate ? album.releaseDate.toISOString().substring(0, 4) : '',
      tags: artist.tags
    };
  });

  return result;
};
