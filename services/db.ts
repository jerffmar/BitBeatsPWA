import type { SocialPost, Bounty, Track, ListenParty } from '../types.ts';

// Declare global Gun types since we load via script tag
declare global {
  interface Window {
    Gun: any;
    SEA: any;
  }
}

// Public relay peers for the mesh network
const LOCAL_RELAY = typeof window !== 'undefined' ? `${window.location.origin}/gun` : null;
const DEFAULT_PEERS = [
  LOCAL_RELAY, // same-origin relay if hosted (e.g., your Render instance pointing to /gun)
  'https://bitbeats-hcx1.onrender.com/gun', // Render relay
  'https://peer.wallie.io/gun',
  'https://gundb-relay-mlccl.ondigitalocean.app/gun',
  'https://plato.design/gun'
].filter(Boolean);

const envPeers =
  (import.meta as any).env?.VITE_GUN_PEERS?.split(',')
    .map((p: string) => p.trim())
    .filter(Boolean) || [];

const PEERS = envPeers.length ? envPeers : DEFAULT_PEERS;

let gun: any;

export const initDB = () => {
  if (!window.Gun) {
    console.warn("Gun.js not loaded yet");
    return null;
  }
  if (!gun) {
    gun = window.Gun({ 
        peers: PEERS,
        localStorage: false // We maintain manual session persistence for keys, keeping graph in memory/network
    });
    console.log("🔫 Gun DB Initialized - Connected to Swarm");
  }
  return gun;
};

export const getGun = () => {
    if (!gun) return initDB();
    return gun;
};

// --- TRACKS (INVENTORY) ---

export const subscribeToTracks = (callback: (track: Track) => void) => {
    const db = getGun();
    if (!db) return;

    // Subscribe to the 'bitbeats/v1/tracks' node
    db.get('bitbeats').get('v1').get('tracks').map().on((data: any, id: string) => {
        if (data && data.title && data.audioUrl) {
            callback({
                id: id, // Gun node ID
                mbid: data.mbid,
                title: data.title,
                artist: data.artist,
                album: data.album,
                coverUrl: data.coverUrl,
                duration: data.duration,
                audioUrl: data.audioUrl, // Magnet URI
                license: data.license || 'CC-BY',
                size: data.size,
                tags: data.tags ? JSON.parse(data.tags) : [],
                bpm: data.bpm,
                networkHealth: Math.floor(Math.random() * 100), // Simulating network health for now
                artistSignature: data.artistSignature
            });
        }
    });
};

export const publishTrackMetadata = async (track: Partial<Track>) => {
    const db = getGun();
    const user = db.user();
    if (!db || !user.is) return;

    const trackId = 't_' + Math.random().toString(36).substr(2, 9);
    
    const trackData = {
        ...track,
        tags: JSON.stringify(track.tags || []), // Gun doesn't store arrays natively well
        uploadedBy: user.is.pub,
        timestamp: Date.now()
    };

    // Index by ID
    db.get('bitbeats').get('v1').get('tracks').get(trackId).put(trackData);
    
    // Also link to user profile (optional, for future "My Uploads" view)
    user.get('uploads').set(db.get('bitbeats').get('v1').get('tracks').get(trackId));
};

// --- SOCIAL POSTS ---

export const subscribeToPosts = (callback: (post: SocialPost) => void) => {
    const db = getGun();
    if (!db) return;
    
    // Subscribe to the 'bitbeats/v1/social' node
    db.get('bitbeats').get('v1').get('social').map().on((data: any, id: string) => {
        if(data && data.content && data.author) {
            callback({
                id: id,
                author: data.author,
                content: data.content,
                timestamp: data.timestamp || Date.now(),
                trackId: data.trackId
            });
        }
    });
};

export const publishPost = async (author: string, content: string, trackId?: string) => {
    const db = getGun();
    if (!db) return;
    
    const post = {
        author,
        content,
        timestamp: Date.now(),
        trackId: trackId || null
    };
    
    db.get('bitbeats').get('v1').get('social').set(post);
};

// --- BOUNTIES ---

export const subscribeToBounties = (callback: (bounty: Bounty) => void) => {
    const db = getGun();
    if (!db) return;

    db.get('bitbeats').get('v1').get('bounties').map().on((data: any, id: string) => {
        if(data && data.query) {
            callback({
                id: id,
                mbid: data.mbid,
                query: data.query,
                reward: data.reward,
                requesterCount: data.requesterCount || 1,
                status: data.status,
                fulfilledBy: data.fulfilledBy
            });
        }
    });
};

export const createBounty = async (mbid: string | undefined, query: string, reward: number) => {
    const db = getGun();
    if (!db) return;

    const bounty = {
        mbid: mbid || null,
        query,
        reward,
        requesterCount: 1,
        status: 'OPEN',
        timestamp: Date.now()
    };

    db.get('bitbeats').get('v1').get('bounties').set(bounty);
};

// --- LISTEN PARTIES ---

export const subscribeToParties = (callback: (party: ListenParty) => void) => {
    const db = getGun();
    if (!db) return;

    db.get('bitbeats').get('v1').get('parties').map().on((data: any, id: string) => {
        if(data && data.host) {
            callback({
                id: id,
                host: data.host,
                currentTrackId: data.currentTrackId,
                timestamp: data.timestamp,
                participants: data.participants || 1,
                status: data.status || 'PLAYING'
            });
        }
    });
};

export const createParty = async (host: string, currentTrackId: string) => {
    const db = getGun();
    const partyId = 'lp_' + Math.random().toString(36).substr(2, 9);
    
    db.get('bitbeats').get('v1').get('parties').get(partyId).put({
        host,
        currentTrackId,
        timestamp: Date.now(),
        participants: 1,
        status: 'PLAYING'
    });
};

// --- USER CREDITS ---

export const subscribeToCredits = (pubKey: string, callback: (credits: number) => void) => {
    const db = getGun();
    // In a real decentralized app, this would query a ledger. 
    // For PoC, we query the user's public profile node.
    db.user(pubKey).get('credits').on((data: any) => {
        // Default to 100 if undefined
        const val = typeof data === 'number' ? data : 100;
        callback(val);
    });
};

export const updateUserCredits = (amount: number) => {
    const db = getGun();
    const user = db.user();
    if (!user.is) return;
    
    // Note: Insecure for real money. Client can manipulate. 
    // Requires Consensus/Smart Contract for real security.
    user.get('credits').put(amount);
};
