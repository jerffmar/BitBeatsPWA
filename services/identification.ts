import { searchGlobalCatalog } from './musicBrainz.ts';
import type { SearchResults, DetailedMetadata } from './musicBrainz.ts';

/**
 * IDENTIFICATION SERVICE
 * 
 * In a full production environment, this would:
 * 1. Take the AudioAnalysis.fingerprint (Chromaprint) from audioEngine.ts
 * 2. Send it to AcoustID API (https://api.acoustid.org/v2/lookup)
 * 3. Receive the MusicBrainz Recording ID (MBID)
 * 
 * Since we cannot use WASM binaries for Chromaprint in this demo,
 * we will implement a "Smart Heuristic" that mimics the result
 * using filename cleaning and duration matching.
 */

export const identifyTrack = async (
    filename: string, 
    duration: number, 
    fingerprint: string
): Promise<DetailedMetadata | null> => {
    console.log(`🔍 Identifying: ${filename} (${duration}s)`);

    const query = filename
        .replace(/\.[^/.]+$/, "")
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .trim();

    // --- Server-side search (fuzzy/Lucene done on API) ---
    const searchRes = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=recording`);
    if (!searchRes.ok) {
        console.warn("Server search failed.");
        return null;
    }
    const searchData = await searchRes.json();
    // Expect: { songs: [{ mbid, title, artist, album, year, coverUrl }] }
    const bestMatch = searchData?.songs?.[0];

    if (!bestMatch) {
        console.warn("No metadata match found.");
        return null;
    }

    // --- Server-side hydration (cover art + album details) ---
    const detailsRes = await fetch(`/api/recording/${bestMatch.mbid}`);
    if (!detailsRes.ok) {
        console.warn("Server recording lookup failed.");
        return null;
    }
    const details = await detailsRes.json();

    return details as DetailedMetadata;
};
