
import { Track } from '../types';

declare global {
  interface Window {
    WebTorrent: any;
  }
}

// Public WebSocket Trackers (Signaling Servers)
const TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
  'wss://spacetradersapi-chatbox.herokuapp.com:443/announce'
];

let client: any = null;

export const initTorrentClient = () => {
  if (client) return client;
  if (!window.WebTorrent) {
    console.error("WebTorrent script not loaded");
    return null;
  }
  
  client = new window.WebTorrent({
    tracker: {
        announce: TRACKERS
    }
  });

  client.on('error', (err: any) => {
    console.error('[WebTorrent] Error:', err);
  });

  console.log("🌊 WebTorrent Client Initialized with Public Trackers");
  return client;
};

export const getClient = () => client || initTorrentClient();

/**
 * Seeds a file to the P2P network
 */
export const seedFile = (file: File | Blob, name: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const c = getClient();
    if (!c) return reject("Client not ready");

    // Check if already seeding
    const existing = c.torrents.find((t: any) => t.name === name);
    if (existing) {
        console.log("Already seeding:", existing.magnetURI);
        resolve(existing.magnetURI);
        return;
    }

    c.seed(file, { name: name, announce: TRACKERS }, (torrent: any) => {
      console.log('✅ Seeding started:', torrent.infoHash);
      resolve(torrent.magnetURI);
    });
  });
};

/**
 * Adds a magnet link to start downloading/streaming
 */
export const addTorrent = (magnetURI: string, onProgress: (prog: number, speed: number) => void): Promise<{ file: any, url: string }> => {
    return new Promise((resolve, reject) => {
        const c = getClient();
        if (!c) return reject("Client not ready");
        
        // Check duplication
        const existing = c.get(magnetURI);
        if (existing) {
            // If exists, find file and return
            const file = existing.files.find((f: any) => f.name.endsWith('.mp3') || f.name.endsWith('.wav'));
            if(file) {
                 file.getBlobURL((err: any, url: string) => {
                     if(err) reject(err);
                     else resolve({ file, url });
                 });
                 return;
            }
        }

        c.add(magnetURI, { announce: TRACKERS }, (torrent: any) => {
            console.log('⬇️ Torrent added:', torrent.infoHash);
            
            // Assume single audio file for simplicity in this PoC
            const file = torrent.files.find((f: any) => f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.webm'));
            
            if (!file) {
                reject("No audio file found in torrent");
                return;
            }

            // Monitor Progress
            torrent.on('download', (bytes: number) => {
                onProgress(torrent.progress, torrent.downloadSpeed);
            });

            // Stream URL
            file.getBlobURL((err: any, url: string) => {
                if (err) reject(err);
                else resolve({ file, url });
            });
        });
    });
};

export const getTorrentStats = (magnetURI: string) => {
    const c = getClient();
    if(!c) return null;
    const torrent = c.get(magnetURI);
    if(!torrent) return null;
    return {
        peers: torrent.numPeers,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        progress: torrent.progress,
        ratio: torrent.ratio
    };
};
