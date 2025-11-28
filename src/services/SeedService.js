const WebTorrent = require('webtorrent-hybrid');
const path = require('path');
const fs = require('fs');

class SeedService {
  constructor() {
    if (!SeedService.instance) {
      this.client = new WebTorrent();
      this.seededFiles = new Map(); // filePath -> torrent
      SeedService.instance = this;
    }
    return SeedService.instance;
  }

  async seedFile(filePath) {
    return new Promise((resolve, reject) => {
      if (this.seededFiles.has(filePath)) {
        const torrent = this.seededFiles.get(filePath);
        return resolve(torrent.magnetURI);
      }
      this.client.seed(filePath, (torrent) => {
        this.seededFiles.set(filePath, torrent);
        resolve(torrent.magnetURI);
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

module.exports = new SeedService();
