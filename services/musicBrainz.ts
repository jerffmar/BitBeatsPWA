import { GlobalCatalogEntry } from '../types.ts';

/**
 * MUSICBRAINZ SERVICE (The Vitrine)
 * Searches the global catalog of metadata for Songs, Albums, and Artists.
 */

const BASE_URL = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'BitBeats/2.0.0 ( contact@bitbeats.p2p )';

export interface MBRecording {
    id: string;
    score: number; // Lucene search score (not our internal confidence)
    title: string;
    length?: number; // duration in ms
    artist: string;
    album: string;
    year: string;
    releases?: any[];
}

export interface SearchResults {
    songs: GlobalCatalogEntry[];
    albums: GlobalCatalogEntry[];
    artists: GlobalCatalogEntry[];
}

export interface DetailedMetadata {
    mbid: string;
    title: string;
    artist: string;
    album: string;
    year: string;
    coverUrl: string;
    tags: string[];
}

export interface MBArtist {
    id: string;
    name: string;
    country: string;
    tags: string[];
    disambiguation: string;
}

export interface MBRelease {
    id: string;
    title: string;
    date: string;
    artist: string;
    coverUrl: string;
    type: string;
}

export interface MBReleaseDetail extends MBRelease {
    tracks: {
        id: string;
        title: string;
        artist: string;
        duration: number; // seconds
        position: number;
    }[];
    about?: string;
}

const getHeaders = () => ({
    'Accept': 'application/json',
    'User-Agent': USER_AGENT
});

/**
 * Searches specifically for recordings using advanced Lucene syntax.
 * Used by the MetadataMatcher service.
 */
export const searchRecordings = async (query: string, artist?: string): Promise<MBRecording[]> => {
    try {
        // Construct Lucene Query
        // Syntax: recording:"Title" AND artist:"Artist"
        let luceneQuery = `recording:"${query.replace(/"/g, '\\"')}"`;
        if (artist) {
            luceneQuery += ` AND artist:"${artist.replace(/"/g, '\\"')}"`;
        }

        const encodedQuery = encodeURIComponent(luceneQuery);
        const url = `${BASE_URL}/recording?query=${encodedQuery}&limit=15&fmt=json`;

        const res = await fetch(url, { headers: getHeaders() });
        
        if (res.status === 503) {
            throw new Error("MusicBrainz Rate Limit Exceeded. Please slow down.");
        }
        
        if (!res.ok) {
            throw new Error(`MusicBrainz API Error: ${res.statusText}`);
        }

        const data = await res.json();

        return (data.recordings || []).map((rec: any) => ({
            id: rec.id,
            score: rec.score,
            title: rec.title,
            length: rec.length, // ms
            artist: rec['artist-credit']?.[0]?.name || 'Unknown',
            album: rec.releases?.[0]?.title || 'Unknown Album',
            year: rec.releases?.[0]?.date?.substring(0, 4) || '',
            releases: rec.releases
        }));

    } catch (err) {
        console.error("MB Search Error:", err);
        throw err; // Propagate to UI
    }
};

// --- LEGACY/GENERAL SEARCH (Used by Search Bar) ---

export const searchGlobalCatalog = async (
    query: string, 
    offset: number = 0, 
    filter: 'ALL' | 'SONG' | 'ALBUM' | 'ARTIST' = 'ALL'
): Promise<SearchResults> => {
    if (!query) return { songs: [], albums: [], artists: [] };

    const encodedQuery = encodeURIComponent(query);
    const limit = 20; // Page size

    // We initialize with empty arrays
    let songs: GlobalCatalogEntry[] = [];
    let albums: GlobalCatalogEntry[] = [];
    let artists: GlobalCatalogEntry[] = [];

    try {
        const promises = [];

        // 1. Fetch Recordings (Songs)
        if (filter === 'ALL' || filter === 'SONG') {
            promises.push(
                fetch(`${BASE_URL}/recording?query=${encodedQuery}&limit=${limit}&offset=${offset}&fmt=json`, { headers: getHeaders() })
                .then(res => res.json())
                .then(data => {
                     songs = (data.recordings || []).map((rec: any) => {
                        // Attempt to find a release ID to get artwork
                        const releaseMbid = rec.releases?.[0]?.id;
                        const coverUrl = releaseMbid 
                            ? `${COVER_ART_BASE}/release/${releaseMbid}/front-250`
                            : null;

                        return {
                            mbid: rec.id,
                            title: rec.title,
                            artist: rec['artist-credit']?.[0]?.name || 'Unknown',
                            album: rec['releases']?.[0]?.title || 'Single',
                            year: rec['first-release-date']?.substring(0, 4) || '',
                            type: 'song',
                            coverUrl: coverUrl
                        };
                    });
                })
            );
        }

        // 2. Fetch Releases (Albums)
        if (filter === 'ALL' || filter === 'ALBUM') {
            promises.push(
                fetch(`${BASE_URL}/release?query=${encodedQuery}&limit=${limit}&offset=${offset}&fmt=json`, { headers: getHeaders() })
                .then(res => res.json())
                .then(data => {
                    albums = (data.releases || []).map((rel: any) => ({
                        mbid: rel.id,
                        title: rel.title,
                        artist: rel['artist-credit']?.[0]?.name || 'Unknown',
                        year: rel.date?.substring(0, 4) || '',
                        type: 'album',
                        // Albums have direct cover art mapping
                        coverUrl: `${COVER_ART_BASE}/release/${rel.id}/front-250`
                    }));
                })
            );
        }

        // 3. Fetch Artists
        if (filter === 'ALL' || filter === 'ARTIST') {
            promises.push(
                fetch(`${BASE_URL}/artist?query=${encodedQuery}&limit=${limit}&offset=${offset}&fmt=json`, { headers: getHeaders() })
                .then(res => res.json())
                .then(data => {
                    artists = (data.artists || []).map((art: any) => ({
                        mbid: art.id,
                        title: art.name,
                        artist: art.area?.name || art.country || 'Artist',
                        year: art['life-span']?.begin?.substring(0, 4) || '',
                        type: 'artist',
                        coverUrl: null // Artists rarely have direct covers in this API
                    }));
                })
            );
        }

        await Promise.all(promises);

        return { songs, albums, artists };

    } catch (err) {
        console.error("MusicBrainz Search Failed:", err);
        return { songs: [], albums: [], artists: [] };
    }
};

// --- LOOKUP & ENRICHMENT ---

/**
 * Gets the High-Res Cover Art for a Release MBID
 */
export const getCoverArt = async (releaseMbid: string): Promise<string> => {
    try {
        // Try to fetch the front cover
        const res = await fetch(`${COVER_ART_BASE}/release/${releaseMbid}`);
        if (!res.ok) return '';
        
        const data = await res.json();
        const front = data.images.find((img: any) => img.front);
        
        // Return 500px thumbnail or full size
        return front?.thumbnails?.['500'] || front?.image || '';
    } catch (e) {
        return '';
    }
};

/**
 * Hydrates a Recording MBID with full metadata (Album, Cover, Year)
 */
export const lookupRecording = async (mbid: string): Promise<DetailedMetadata | null> => {
    try {
        // Fetch recording with artist-credits, releases, and tags
        const url = `${BASE_URL}/recording/${mbid}?inc=artist-credits+releases+tags&fmt=json`;
        const res = await fetch(url, { headers: getHeaders() });
        const data = await res.json();

        const bestRelease = data.releases?.[0]; // Usually the first release is the most relevant
        
        let coverUrl = '';
        if (bestRelease?.id) {
            coverUrl = await getCoverArt(bestRelease.id);
        }

        return {
            mbid: data.id,
            title: data.title,
            artist: data['artist-credit']?.[0]?.name || 'Unknown',
            album: bestRelease?.title || 'Unknown Album',
            year: bestRelease?.date?.substring(0, 4) || '',
            tags: (data.tags || []).map((t: any) => t.name).slice(0, 5),
            coverUrl: coverUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400' // Fallback
        };

    } catch (err) {
        console.error("Metadata Lookup Failed:", err);
        return null;
    }
};


export const lookupArtist = async (mbid: string): Promise<MBArtist | null> => {
    try {
        const url = `${BASE_URL}/artist/${mbid}?inc=tags+ratings&fmt=json`;
        const res = await fetch(url, { headers: getHeaders() });
        if(!res.ok) return null;
        const data = await res.json();
        return {
            id: data.id,
            name: data.name,
            country: data.area?.name || data.country || '',
            tags: (data.tags || []).sort((a:any,b:any) => b.count - a.count).map((t: any) => t.name).slice(0, 5),
            disambiguation: data.disambiguation || ''
        };
    } catch {
        return null;
    }
};

export const getArtistDiscography = async (artistMbid: string): Promise<MBRelease[]> => {
    try {
        // Fetch Release Groups (Distinct Albums)
        const url = `${BASE_URL}/release-group?artist=${artistMbid}&type=album&limit=20&fmt=json`;
        const res = await fetch(url, { headers: getHeaders() });
        if(!res.ok) return [];
        const data = await res.json();
        
        return (data['release-groups'] || []).map((rg: any) => ({
            id: rg.id, // Release Group ID
            title: rg.title,
            date: rg['first-release-date']?.substring(0, 4) || '',
            artist: '', 
            coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
            type: 'album'
        }));
    } catch {
        return [];
    }
};

// Helper to resolve a Release Group ID to a specific Release ID (Official preference)
export const resolveReleaseGroup = async (releaseGroupId: string): Promise<string | null> => {
     try {
        const url = `${BASE_URL}/release-group/${releaseGroupId}?inc=releases&fmt=json`;
        const res = await fetch(url, { headers: getHeaders() });
        const data = await res.json();
        const releases = data.releases || [];
        // Prefer official, then US/UK/International, or just first
        const official = releases.find((r:any) => r.status === 'Official');
        return official ? official.id : releases[0]?.id;
     } catch {
         return null;
     }
}

export const lookupRelease = async (mbid: string): Promise<MBReleaseDetail | null> => {
    try {
        // First try as a standard Release ID
        let url = `${BASE_URL}/release/${mbid}?inc=recordings+artist-credits+release-groups&fmt=json`;
        let res = await fetch(url, { headers: getHeaders() });
        
        if (!res.ok && res.status === 404) {
             // If 404, assume it might be a Release Group ID passed from Discography
             const realId = await resolveReleaseGroup(mbid);
             if(realId) {
                 url = `${BASE_URL}/release/${realId}?inc=recordings+artist-credits+release-groups&fmt=json`;
                 res = await fetch(url, { headers: getHeaders() });
             }
        }
        
        if(!res.ok) return null;
        
        const data = await res.json();
        const rgId = data['release-groups']?.[0]?.id;
        
        return {
            id: data.id,
            title: data.title,
            artist: data['artist-credit']?.[0]?.name || 'Unknown',
            date: data.date?.substring(0,4),
            // Prefer RG cover if available as it's often better quality/consistent
            coverUrl: rgId ? `https://coverartarchive.org/release-group/${rgId}/front-500` : `https://coverartarchive.org/release/${data.id}/front-500`, 
            type: 'album',
            about: data.disambiguation,
            tracks: (data.media?.[0]?.tracks || []).map((t: any) => ({
                id: t.recording.id,
                title: t.title,
                artist: t['artist-credit']?.[0]?.name || 'Unknown',
                duration: t.length ? t.length / 1000 : 0,
                position: t.position
            }))
        };
    } catch {
        return null;
    }
};
