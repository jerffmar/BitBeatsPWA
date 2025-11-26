
import { calculateSimilarity } from '../utils/stringDistance';

const MB_API_BASE = 'https://musicbrainz.org/ws/2';

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
  part1: string;
  part2: string;
  hasSplit: boolean;
}

/**
 * Cleans filename by removing common track prefixes.
 */
const cleanFilename = (filename: string) => {
  // Remove extension
  let name = filename.substring(0, filename.lastIndexOf('.')) || filename;
  
  // Regex to remove prefixes like: "01.", "CD1.", "A1.", "1 - ", "CD02.18."
  name = name.replace(/^((?:CD|Dis[ck]|Track|Side|[A-Z])?\s*\d+(?:[\.\-]\d+)*\s*[ ._\-]+)+/i, '');
  
  return name.trim() || name;
};

/**
 * Extracts potential Artist and Title parts.
 */
const parseFilename = (filename: string): FilenameParseResult => {
  const cleanName = cleanFilename(filename);
  
  const hyphenMatch = cleanName.match(/^(.+?)\s*-\s*(.+?)$/);
  if (hyphenMatch) {
    return {
      part1: hyphenMatch[1].trim(),
      part2: hyphenMatch[2].trim(),
      hasSplit: true
    };
  }
  
  return { part1: cleanName, part2: '', hasSplit: false };
};

/**
 * Core Identification Function
 */
export const identifyTrack = async (file: File, durationSec: number): Promise<MatchedResult[]> => {
  const { part1, part2, hasSplit } = parseFilename(file.name);
  console.log(`🧠 Metadata Matcher: Parsed "${file.name}" -> P1: "${part1}", P2: "${part2}"`);

  // 1. Search MusicBrainz (OR Query)
  const p1 = part1.replace(/"/g, '\\"');
  const p2 = part2.replace(/"/g, '\\"');
  let query = '';
  
  if (hasSplit) {
      query = `(recording:"${p1}" AND artist:"${p2}") OR (recording:"${p2}" AND artist:"${p1}")`;
  } else {
      query = `recording:"${p1}"`;
  }
  
  const url = `${MB_API_BASE}/recording?query=${encodeURIComponent(query)}&limit=20&fmt=json`;
  
  let results: any[] = [];
  try {
      const res = await fetch(url, { headers: { 'User-Agent': 'BitBeats/2.0' } });
      const data = await res.json();
      results = data.recordings || [];
  } catch (err) {
      console.error("MB Search Error:", err);
      return [];
  }

  // 2. Score Results
  const candidates: MatchedResult[] = results.map((rec: any) => {
    let titleSim = 0;
    let artistSim = 0;
    const recTitle = rec.title;
    const recArtist = rec['artist-credit']?.[0]?.name || '';

    if (hasSplit) {
        // Evaluate both permutations and take best text match
        // A: P1=Title, P2=Artist
        const tA = calculateSimilarity(part1, recTitle);
        const aA = calculateSimilarity(part2, recArtist);
        const scoreA = (tA * 0.40) + (aA * 0.30);

        // B: P2=Title, P1=Artist
        const tB = calculateSimilarity(part2, recTitle);
        const aB = calculateSimilarity(part1, recArtist);
        const scoreB = (tB * 0.40) + (aB * 0.30);

        if (scoreA >= scoreB) {
            titleSim = tA;
            artistSim = aA;
        } else {
            titleSim = tB;
            artistSim = aB;
        }
    } else {
        titleSim = calculateSimilarity(part1, recTitle);
        artistSim = 0.5; // Neutral
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
    // Title: 40%, Artist: 30%, Duration: 30%
    const finalScore = (titleSim * 0.40) + (artistSim * 0.30) + (durationScore * 0.30);

    return {
      mbid: rec.id,
      title: rec.title,
      artist: recArtist,
      album: rec.releases?.[0]?.title || 'Unknown Album',
      year: rec.releases?.[0]?.date?.substring(0, 4) || '',
      confidence: Math.round(finalScore * 100),
      matchDetails: {
        titleScore: Math.round(titleSim * 100),
        artistScore: Math.round(artistSim * 100),
        durationScore: Math.round(durationScore * 100)
      }
    };
  });

  // 3. Filter and Sort
  // De-duplicate by MBID
  const uniqueCandidates = Array.from(new Map(candidates.map(item => [item.mbid, item])).values());

  return uniqueCandidates
    .filter(c => c.confidence > 40) // Filter junk
    .sort((a, b) => b.confidence - a.confidence); // Highest confidence first
};
