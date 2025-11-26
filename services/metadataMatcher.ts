
import { calculateSimilarity } from '../utils/stringDistance';
import { searchRecordings, MBRecording } from './musicBrainz';

export interface MatchedResult {
  mbid: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  confidence: number; // 0-100
  matchDetails: {
    titleScore: number;
    artistScore: number;
    durationScore: number;
  };
}

interface FilenameParseResult {
  artist?: string;
  title: string;
}

/**
 * Extracts Artist and Title from filenames.
 * Supports patterns:
 * "Artist - Title.mp3"
 * "Title.mp3"
 * "01. Artist - Title.mp3"
 */
const parseFilename = (filename: string): FilenameParseResult => {
  // Remove extension
  const cleanName = filename.substring(0, filename.lastIndexOf('.')) || filename;

  // Pattern: Artist - Title (Most common)
  const hyphenMatch = cleanName.match(/^(.+?)\s*-\s*(.+?)$/);
  if (hyphenMatch) {
    // Basic cleanup of track numbers "01. Artist" -> "Artist"
    const artistClean = hyphenMatch[1].replace(/^\d+\.\s*/, '').trim();
    return {
      artist: artistClean,
      title: hyphenMatch[2].trim()
    };
  }

  // Fallback: Use whole name as title
  return {
    title: cleanName.replace(/^\d+\.\s*/, '').trim()
  };
};

/**
 * Core Identification Function
 */
export const identifyTrack = async (file: File, durationSec: number): Promise<MatchedResult[]> => {
  const { artist, title } = parseFilename(file.name);
  console.log(`🧠 Metadata Matcher: Parsed "${file.name}" -> Artist: "${artist}", Title: "${title}"`);

  // 1. Search MusicBrainz
  const results: MBRecording[] = await searchRecordings(title, artist);

  if (!results || results.length === 0) {
    return [];
  }

  // 2. Score Results
  const candidates: MatchedResult[] = results.map(rec => {
    // A. Title Similarity (40%)
    const titleSim = calculateSimilarity(title, rec.title);
    
    // B. Artist Similarity (30%)
    let artistSim = 0;
    if (artist) {
      artistSim = calculateSimilarity(artist, rec.artist);
    } else {
      // If we didn't have a local artist, we can't penalize heavily, 
      // but we also can't verify. Give neutral score or rely on Title/Duration more.
      // Strategy: Check if the filename title actually contained the artist name?
      // For now, simpler approach: Normalize weight.
      // If no artist, we will re-distribute weights later.
      artistSim = 0.5; 
    }

    // C. Duration Match (30%)
    let durationScore = 0;
    if (rec.length) {
      const apiDurationSec = rec.length / 1000;
      const diff = Math.abs(durationSec - apiDurationSec);
      
      if (diff < 2.0) {
        durationScore = 1.0; // Perfect match (within 2s)
      } else if (diff < 10.0) {
        // Linear decay from 2s to 10s
        durationScore = 1.0 - ((diff - 2.0) / 8.0);
      } else {
        durationScore = 0;
      }
    }

    // Calculate Final Weighted Score
    let finalScore = 0;
    
    if (artist) {
      // Standard Weighting
      // Title: 40%, Artist: 30%, Duration: 30%
      finalScore = (titleSim * 0.40) + (artistSim * 0.30) + (durationScore * 0.30);
    } else {
      // Rebalanced Weighting (No Artist known)
      // Title: 60%, Duration: 40%
      finalScore = (titleSim * 0.60) + (durationScore * 0.40);
    }

    return {
      mbid: rec.id,
      title: rec.title,
      artist: rec.artist,
      album: rec.album,
      year: rec.year,
      confidence: Math.round(finalScore * 100),
      matchDetails: {
        titleScore: Math.round(titleSim * 100),
        artistScore: Math.round(artistSim * 100),
        durationScore: Math.round(durationScore * 100)
      }
    };
  });

  // 3. Filter and Sort
  return candidates
    .filter(c => c.confidence > 40) // Filter junk
    .sort((a, b) => b.confidence - a.confidence); // Highest confidence first
};
