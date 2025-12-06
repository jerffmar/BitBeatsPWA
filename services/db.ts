import type { SocialPost, Bounty, Track, ListenParty } from '../types.ts';

// Declare global Gun types since we load via script tag
declare global {
  interface Window {
    Gun: any;
    SEA: any;
  }
}

const logGun = (...args: any[]) => console.debug('[GUN]', ...args);

// Force a single hosted relay. Remove any local/same-origin relay attempts to avoid mixed-content or repeated failed wss dials.
const PEERS = ['https://bitbeatsrelay.duckdns.org/gun'];

let gun: any;

export const initDB = () => {
  if (!window.Gun) {
    console.warn("Gun.js not loaded yet");
    return null;
  }
  if (!gun) {
    gun = window.Gun({ 
        peers: PEERS,
        localStorage: false
    });
    logGun('initDB peers', PEERS);
  }
  return gun;
};

export const getGun = () => {
    if (!gun) {
      logGun('getGun -> init');
      return initDB();
    }
    return gun;
};

// --- NEW: Replicate to Relay Helper ---
// Writes a deterministic archival copy under `bitbeats/relay_archive/...` so the relay persists it to disk.
// This complements the normal distributed set/put which may use `.set()` or ephemeral keys.
const replicateToRelay = (path: string[], payload: any) => {
  try {
    const db = getGun();
    if (!db) return;
    let node: any = db.get('bitbeats').get('relay_archive');
    for (const p of path) node = node.get(p);
    // include a small metadata envelope
    node.put({ ...payload, _relayArchivedAt: Date.now() });
    logGun('replicateToRelay', { path, id: payload.id || payload.mbid || null });
  } catch (err) {
    console.warn('replicateToRelay failed', err);
  }
};

// --- TRACKS (INVENTORY) ---

export const subscribeToTracks = (callback: (track: Track) => void) => {
    const db = getGun();
    if (!db) return;
    logGun('subscribeToTracks');
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
    logGun('publishTrackMetadata', { trackId, uploadedBy: user.is.pub });
    
    // Also link to user profile (optional, for future "My Uploads" view)
    user.get('uploads').set(db.get('bitbeats').get('v1').get('tracks').get(trackId));

    // Ensure an archival copy is written to the relay for persistence
    try {
      replicateToRelay(['tracks', trackId], { id: trackId, ...trackData });
    } catch (e) {
      console.warn('Failed to replicate track to relay', e);
    }
};

// --- SOCIAL POSTS ---

export const subscribeToPosts = (callback: (post: SocialPost) => void) => {
    const db = getGun();
    if (!db) return;
    logGun('subscribeToPosts');
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
    
    // Use deterministic id so we can archive reliably
    const postId = 'p_' + Math.random().toString(36).substr(2, 9);

    const post = {
        id: postId,
        author,
        content,
        timestamp: Date.now(),
        trackId: trackId || null
    };
    
    // Put into live social feed (indexed by id)
    db.get('bitbeats').get('v1').get('social').get(postId).put(post);
    logGun('publishPost', { author, trackId, postId });

    // Archive to relay
    replicateToRelay(['social', postId], post);
};

// --- BOUNTIES ---

export const subscribeToBounties = (callback: (bounty: Bounty) => void) => {
    const db = getGun();
    if (!db) return;
    logGun('subscribeToBounties');
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

    const bountyId = 'b_' + Math.random().toString(36).substr(2, 9);

    const bounty = {
        id: bountyId,
        mbid: mbid || null,
        query,
        reward,
        requesterCount: 1,
        status: 'OPEN',
        timestamp: Date.now()
    };

    db.get('bitbeats').get('v1').get('bounties').get(bountyId).put(bounty);
    logGun('createBounty', { mbid, query, reward, bountyId });

    // Archive to relay
    replicateToRelay(['bounties', bountyId], bounty);
};

// --- LISTEN PARTIES ---

export const subscribeToParties = (callback: (party: ListenParty) => void) => {
    const db = getGun();
    if (!db) return;
    logGun('subscribeToParties');
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
    
    const party = {
        id: partyId,
        host,
        currentTrackId,
        timestamp: Date.now(),
        participants: 1,
        status: 'PLAYING'
    };

    db.get('bitbeats').get('v1').get('parties').get(partyId).put(party);
    logGun('createParty', { partyId, host, currentTrackId });

    // Archive to relay
    replicateToRelay(['parties', partyId], party);
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
    
    user.get('credits').put(amount);
    logGun('updateUserCredits', { pub: user.is.pub, amount });

    // Also archive user's credits snapshot for relay persistence
    try {
      replicateToRelay(['userCredits', user.is.pub], { pub: user.is.pub, credits: amount, timestamp: Date.now() });
    } catch (e) {
      console.warn('Failed to replicate credits to relay', e);
    }
};
