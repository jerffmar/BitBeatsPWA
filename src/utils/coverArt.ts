
/**
 * Generates a direct URL to the Cover Art Archive for a given MusicBrainz ID (MBID).
 * 
 * @param mbid - The MusicBrainz Release ID
 * @param size - 'small' (250px) or 'large' (500px/Full)
 * @returns The image URL
 */
export const getCoverArtUrl = (mbid: string | null | undefined, size: 'small' | 'large' = 'large'): string => {
  if (!mbid) return '';
  return `https://coverartarchive.org/release/${mbid}/front${size === 'small' ? '-250' : ''}`;
};
