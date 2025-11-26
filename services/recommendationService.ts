
// Mock storage for demo purposes
interface PlaybackHistoryItem {
  userId: string;
  trackId: string;
  timestamp: Date;
  track?: any;
}

const playbackHistory: PlaybackHistoryItem[] = [];

export const recommendationService = {
  /**
   * Log a user interaction to build history
   */
  async logInteraction(userId: string, trackId: string) {
    try {
      playbackHistory.push({
        userId,
        trackId,
        timestamp: new Date()
      });
      console.log(`[MockDB] Logged interaction: User ${userId} played Track ${trackId}`);
    } catch (error) {
      console.error("Failed to log interaction:", error);
    }
  },

  /**
   * Get Recent Rotation (Last 7 Days)
   * Returns unique tracks and artists played recently.
   */
  async getRecentRotation(userId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Mock Logic
    const history = playbackHistory.filter(h => 
        h.userId === userId && h.timestamp >= sevenDaysAgo
    ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // In a real app with Prisma, we would include relational data here.
    // For this mock, we return empty arrays as we don't have the full track database in memory.
    return {
      tracks: [],
      artists: []
    };
  },

  /**
   * Generate Discovery Feed (Taste Profile Engine)
   * Logic: Top 3 Genres from last 30 days -> Find new Albums in those genres excluding known artists.
   */
  async getDiscoveryFeed(userId: string) {
    // Mock implementation
    return {
      recommendations: [],
      context: {
        topGenres: ['Synthwave', 'Electronic', 'Pop'],
        message: "Discovery feed running in offline demo mode."
      }
    };
  }
};
