/**
 * Server-side Seeding Service
 * Seeds user-imported songs for 90 days from import.
 * Tracks seeding status and expiration for each track.
 */

type SeedingEntry = {
  trackId: string;
  userId: string;
  seededAt: number;
  expiresAt: number;
};

const SEEDING_PERIOD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

// In-memory registry (replace with DB in production)
const seedingRegistry: SeedingEntry[] = [];

/**
 * Register a track for seeding for a user.
 */
export function registerSeeding(trackId: string, userId: string) {
  const now = Date.now();
  const entry: SeedingEntry = {
    trackId,
    userId,
    seededAt: now,
    expiresAt: now + SEEDING_PERIOD_MS
  };
  seedingRegistry.push(entry);
}

/**
 * Get all currently seeded tracks for a user.
 */
export function getSeededTracks(userId: string): SeedingEntry[] {
  const now = Date.now();
  return seedingRegistry.filter(
    entry => entry.userId === userId && entry.expiresAt > now
  );
}

/**
 * Check if a track is still being seeded for a user.
 */
export function isTrackSeeded(trackId: string, userId: string): boolean {
  const now = Date.now();
  return seedingRegistry.some(
    entry => entry.trackId === trackId && entry.userId === userId && entry.expiresAt > now
  );
}

/**
 * Cleanup expired seeding entries.
 */
export function cleanupExpiredSeeding() {
  const now = Date.now();
  for (let i = seedingRegistry.length - 1; i >= 0; i--) {
    if (seedingRegistry[i].expiresAt <= now) {
      seedingRegistry.splice(i, 1);
    }
  }
}
