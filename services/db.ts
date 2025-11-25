
import { SocialPost, Bounty } from '../types';

// Declare global Gun types since we load via script tag
declare global {
  interface Window {
    Gun: any;
    SEA: any;
  }
}

// Public relay peers for the mesh network
const PEERS = [
  'https://gun-manhattan.herokuapp.com/gun', 
  'https://plato.design/gun'
];

let gun: any;

export const initDB = () => {
  if (!window.Gun) {
    console.warn("Gun.js not loaded yet");
    return null;
  }
  if (!gun) {
    gun = window.Gun({ 
        peers: PEERS,
        localStorage: false // We use OPFS for files, keeping DB in memory/network for now to avoid quota issues
    });
    console.log("🔫 Gun DB Initialized - Connected to Swarm");
  }
  return gun;
};

// --- SOCIAL POSTS ---

export const subscribeToPosts = (callback: (post: SocialPost) => void) => {
    const db = initDB();
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
    const db = initDB();
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
    const db = initDB();
    if (!db) return;

    db.get('bitbeats').get('v1').get('bounties').map().on((data: any, id: string) => {
        if(data && data.query) {
            callback({
                id: id,
                mbid: data.mbid,
                query: data.query,
                reward: data.reward,
                requesterCount: data.requesterCount,
                status: data.status,
                fulfilledBy: data.fulfilledBy
            });
        }
    });
};

export const createBounty = async (mbid: string | undefined, query: string, reward: number) => {
    const db = initDB();
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
