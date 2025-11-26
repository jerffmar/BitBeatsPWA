
/**
 * Calculates the Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to change one word into the other.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Calculates a normalized similarity score between 0 and 1.
 * 1.0 = Identical
 * 0.0 = Completely different
 * 
 * Ignores case and whitespace for better music metadata matching.
 */
export const calculateSimilarity = (s1: string, s2: string): number => {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;

  const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');
  
  const a = normalize(s1);
  const b = normalize(s2);

  if (a === b) return 1;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  if (maxLength === 0) return 1;

  return 1 - (distance / maxLength);
};
