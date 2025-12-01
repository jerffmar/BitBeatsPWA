import WebTorrent from 'webtorrent-hybrid';

class SeedService {
  constructor() {
    if (!SeedService.instance) {
      this.client = new WebTorrent();
      this.seededFiles = new Map();
      SeedService.instance = this;
    }
    return SeedService.instance;
  }

  async seedFile(filePath) {
    return new Promise((resolve, reject) => {
      if (this.seededFiles.has(filePath)) {
        return resolve(this.seededFiles.get(filePath).magnetURI);
      }

      const torrent = this.client.seed(filePath, (torrentInstance) => {
        this.seededFiles.set(filePath, torrentInstance);
        resolve(torrentInstance.magnetURI);
      });

      torrent.on('error', (err) => {
        this.seededFiles.delete(filePath);
        reject(err);
      });
    });
  }

  async pruneSeeders(tracks) {
    // tracks: Array of { filePath, uploadedAt }
    const now = new Date();
    tracks.forEach(track => {
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      if (now - new Date(track.uploadedAt) > ninetyDaysMs) {
        const torrent = this.seededFiles.get(track.filePath);
        if (torrent) {
          torrent.destroy();
          this.seededFiles.delete(track.filePath);
        }
      }
    });
  }
}

export default new SeedService();
