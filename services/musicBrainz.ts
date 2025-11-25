
import { GlobalCatalogEntry } from '../types';

/**
 * MUSICBRAINZ SERVICE (The Vitrine)
 * Searches the global catalog of metadata.
 */

const BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'BitBeats/2.0.0 ( contact@bitbeats.p2p )';

export const searchGlobalCatalog = async (query: string): Promise<GlobalCatalogEntry[]> => {
    if (!query) return [];

    try {
        const response = await fetch(`${BASE_URL}/recording?query=${encodeURIComponent(query)}&fmt=json`, {
            headers: {
                'User-Agent': USER_AGENT
            }
        });

        if (!response.ok) throw new Error('MusicBrainz API Error');

        const data = await response.json();

        return data.recordings.map((rec: any) => ({
            mbid: rec.id,
            title: rec.title,
            artist: rec['artist-credit']?.[0]?.name || 'Unknown Artist',
            album: rec['releases']?.[0]?.title || 'Single',
            year: rec['first-release-date']?.substring(0, 4) || 'Unknown',
            // MusicBrainz doesn't provide direct image URLs in search easily.
            // We would usually query CoverArtArchive, but for this PoC we use a placeholder or Unsplash
            coverUrl: null 
        }));

    } catch (err) {
        console.error("MusicBrainz Search Failed:", err);
        return [];
    }
};
