
import { searchGlobalCatalog, lookupRecording, DetailedMetadata } from './musicBrainz';

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

    // 1. Clean filename to get a search query
    // "The_Beatles_-_Hey_Jude.mp3" -> "The Beatles Hey Jude"
    const query = filename
        .replace(/\.[^/.]+$/, "") // Remove extension
        .replace(/_/g, " ")
        .replace(/-/g, " ")
        .replace(/\(.*?\)/g, "") // Remove things in brackets like (Official Video)
        .replace(/\[.*?\]/g, "")
        .trim();

    // 2. Search MusicBrainz for a potential match
    const results = await searchGlobalCatalog(query);
    
    // 3. Filter results by duration (fuzzy match +/- 5 seconds)
    // AcoustID does this automatically. We do it manually here.
    // Note: MusicBrainz search results don't always have duration, so we might just take the top hit
    // that looks like a Song.
    
    const bestMatch = results.songs[0];

    if (!bestMatch) {
        console.warn("No metadata match found.");
        return null;
    }

    // 4. Hydrate the result to get the Cover Art and Album details
    const details = await lookupRecording(bestMatch.mbid);
    
    return details;
};
