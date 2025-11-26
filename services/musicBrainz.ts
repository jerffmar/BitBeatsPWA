
import { GlobalCatalogEntry } from '../types';

/**
 * MUSICBRAINZ SERVICE (The Vitrine)
 * Searches the global catalog of metadata for Songs, Albums, and Artists.
 */

const BASE_URL = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'BitBeats/2.0.0 ( contact@bitbeats.p2p )';

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

const getHeaders = () => ({
    'Accept': 'application/json',
    'User-Agent': USER_AGENT
});

// --- SEARCH ---

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
                     songs = (data.recordings || []).map((rec: any) => ({
                        mbid: rec.id,
                        title: rec.title,
                        artist: rec['artist-credit']?.[0]?.name || 'Unknown',
                        album: rec['releases']?.[0]?.title || 'Single',
                        year: rec['first-release-date']?.substring(0, 4) || '',
                        type: 'song',
                        coverUrl: null
                    }));
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
                        coverUrl: null
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
                        coverUrl: null
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
