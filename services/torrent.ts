
import { Track } from '../types';

declare global {
  interface Window {
    WebTorrent: any;
  }
}

// Default fallback if trackers.txt fails to load
const DEFAULT_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
  'wss://spacetradersapi-chatbox.herokuapp.com:443/announce'
];

let client: any = null;
let initPromise: Promise<any> | null = null;

const fetchTrackers = async (): Promise<string[]> => {
    try {
        const response = await fetch('/trackers.txt');
        if (!response.ok) {
            console.warn("trackers.txt not found, using defaults.");
            return DEFAULT_TRACKERS;
        }
        const text = await response.text();
        const list = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#')); // Filter empty lines and comments
        
        return list.length > 0 ? list : DEFAULT_TRACKERS;
    } catch (err) {
        console.warn("Failed to fetch trackers.txt:", err);
        return DEFAULT_TRACKERS;
    }
};

export const initTorrentClient = async () => {
  if (client) return client;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
      if (!window.WebTorrent) {
        console.error("WebTorrent script not loaded");
        return null;
      }
      
      const trackers = await fetchTrackers();
      console.log(`🌊 Initializing WebTorrent with ${trackers.length} trackers loaded from config.`);
      
      client = new window.WebTorrent({
        tracker: {
            announce: trackers
        }
      });

      client.on('error', (err: any) => {
        console.error('[WebTorrent] Error:', err);
      });

      return client;
  })();

  return initPromise;
};

// Synchronous accessor for stats loops (returns null if not yet initialized)
export const getClient = () => client;

/**
 * Seeds a file to the P2P network
 */
export const seedFile = (file: File | Blob, name: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    const c = client || await initTorrentClient();
    if (!c) return reject("Client not ready");

    // Check if already seeding
    const existing = c.torrents.find((t: any) => t.name === name);
    if (existing) {
        console.log("Already seeding:", existing.magnetURI);
        resolve(existing.magnetURI);
        return;
    }

    // Use client default trackers (configured in init)
    c.seed(file, { name: name }, (torrent: any) => {
      console.log('✅ Seeding started:', torrent.infoHash);
      resolve(torrent.magnetURI);
    });
  });
};

/**
 * Adds a magnet link to start downloading/streaming
 */
export const addTorrent = (magnetURI: string, onProgress: (prog: number, speed: number) => void): Promise<{ file: any, url: string }> => {
    return new Promise(async (resolve, reject) => {
        const c = client || await initTorrentClient();
        if (!c) return reject("Client not ready");
        
        // Check duplication
        const existing = c.get(magnetURI);
        if (existing) {
            // If exists, find file and return
            const file = existing.files.find((f: any) => f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.webm'));
            if(file) {
                 file.getBlobURL((err: any, url: string) => {
                     if(err) reject(err);
                     else resolve({ file, url });
                 });
                 return;
            }
        }

        // Add torrent
        c.add(magnetURI, (torrent: any) => {
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
