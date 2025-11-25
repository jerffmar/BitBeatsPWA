
import { GlobalCatalogEntry } from '../types';

/**
 * MUSICBRAINZ SERVICE (The Vitrine)
 * Searches the global catalog of metadata for Songs, Albums, and Artists.
 */

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'BitBeats/2.0.0 ( contact@bitbeats.p2p )';

export interface SearchResults {
    songs: GlobalCatalogEntry[];
    albums: GlobalCatalogEntry[];
    artists: GlobalCatalogEntry[];
}

export const searchGlobalCatalog = async (query: string): Promise<SearchResults> => {
    if (!query) return { songs: [], albums: [], artists: [] };

    const headers = {
        'User-Agent': USER_AGENT
    };
    const encodedQuery = encodeURIComponent(query);

    try {
        // Execute parallel searches for Recordings (Songs), Releases (Albums), and Artists
        const [songsRes, albumsRes, artistsRes] = await Promise.all([
            fetch(`${BASE_URL}/recording?query=${encodedQuery}&limit=10&fmt=json`, { headers }),
            fetch(`${BASE_URL}/release?query=${encodedQuery}&limit=10&fmt=json`, { headers }),
            fetch(`${BASE_URL}/artist?query=${encodedQuery}&limit=10&fmt=json`, { headers })
        ]);

        const songsData = await songsRes.json();
        const albumsData = await albumsRes.json();
        const artistsData = await artistsRes.json();

        // Process Songs
        const songs: GlobalCatalogEntry[] = (songsData.recordings || []).map((rec: any) => ({
            mbid: rec.id,
            title: rec.title,
            artist: rec['artist-credit']?.[0]?.name || 'Unknown',
            album: rec['releases']?.[0]?.title || 'Single',
            year: rec['first-release-date']?.substring(0, 4) || '',
            type: 'song',
            coverUrl: null
        }));

        // Process Albums
        const albums: GlobalCatalogEntry[] = (albumsData.releases || []).map((rel: any) => ({
            mbid: rel.id,
            title: rel.title,
            artist: rel['artist-credit']?.[0]?.name || 'Unknown',
            year: rel.date?.substring(0, 4) || '',
            type: 'album',
            coverUrl: null // In production, query Cover Art Archive here
        }));

        // Process Artists
        const artists: GlobalCatalogEntry[] = (artistsData.artists || []).map((art: any) => ({
            mbid: art.id,
            title: art.name,
            artist: art.area?.name || art.country || 'Artist', // Using subtitle slot for location/type
            year: art['life-span']?.begin?.substring(0, 4) || '',
            type: 'artist',
            coverUrl: null
        }));

        return { songs, albums, artists };

    } catch (err) {
        console.error("MusicBrainz Search Failed:", err);
        return { songs: [], albums: [], artists: [] };
    }
};
