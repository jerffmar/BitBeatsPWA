import type { SocialPost, Bounty, Track, ListenParty } from '../types.ts';

type MeshStore = {
  tracks: Track[];
  posts: SocialPost[];
  bounties: Bounty[];
  parties: ListenParty[];
  credits: Record<string, number>;
};

const STORE_KEY = 'bitbeats_mesh_store';
const CHANNEL_NAME = 'bitbeats_mesh_channel';

const defaultStore: MeshStore = {
  tracks: [],
  posts: [],
  bounties: [],
  parties: [],
  credits: {}
};

let store: MeshStore = loadStore();
const channel = new BroadcastChannel(CHANNEL_NAME);
const listeners: Record<string, Set<(...args: any[]) => void>> = {};

function loadStore(): MeshStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...defaultStore, ...JSON.parse(raw) } : structuredClone(defaultStore);
  } catch {
    return structuredClone(defaultStore);
  }
}

const persistStore = () => localStorage.setItem(STORE_KEY, JSON.stringify(store));

const emit = (type: keyof MeshStore | 'credits_update', payload: any) => {
  channel.postMessage({ type, payload });
  listeners[type]?.forEach(listener => listener(payload));
};

const registerListener = (type: string, callback: (...args: any[]) => void) => {
  if (!listeners[type]) listeners[type] = new Set();
  listeners[type].add(callback);
  return () => listeners[type].delete(callback);
};

channel.onmessage = (event) => {
  const { type, payload } = event.data || {};
  listeners[type]?.forEach(listener => listener(payload));
};

export const initDB = () => {
  store = loadStore();
};

export const subscribeToTracks = (callback: (track: Track) => void) => {
  store.tracks.forEach(callback);
  registerListener('tracks', callback);
};

export const publishTrackMetadata = async (track: Partial<Track>) => {
  const record: Track = {
    id: track.id || `track_${crypto.randomUUID()}`,
    mbid: track.mbid,
    title: track.title || 'Untitled',
    artist: track.artist || 'Unknown Artist',
    album: track.album || 'Unknown Album',
    coverUrl: track.coverUrl || '',
    duration: track.duration || 0,
    audioUrl: track.audioUrl || '',
    license: track.license || 'CC-BY',
    size: track.size || 0,
    tags: track.tags || [],
    bpm: track.bpm,
    networkHealth: track.networkHealth ?? 50,
    artistSignature: track.artistSignature
  };
  store.tracks = [record, ...store.tracks.filter(t => t.id !== record.id)];
  persistStore();
  emit('tracks', record);
};

export const subscribeToPosts = (callback: (post: SocialPost) => void) => {
  store.posts.forEach(callback);
  registerListener('posts', callback);
};

export const publishPost = async (author: string, content: string, trackId?: string) => {
  const post: SocialPost = {
    id: `post_${crypto.randomUUID()}`,
    author,
    content,
    timestamp: Date.now(),
    trackId
  };
  store.posts = [post, ...store.posts].slice(0, 200);
  persistStore();
  emit('posts', post);
};

export const subscribeToBounties = (callback: (bounty: Bounty) => void) => {
  store.bounties.forEach(callback);
  registerListener('bounties', callback);
};

export const createBounty = async (mbid: string | undefined, query: string, reward: number) => {
  const bounty: Bounty = {
    id: `bounty_${crypto.randomUUID()}`,
    mbid,
    query,
    reward,
    requesterCount: 1,
    status: 'OPEN'
  };
  store.bounties = [bounty, ...store.bounties];
  persistStore();
  emit('bounties', bounty);
};

export const subscribeToParties = (callback: (party: ListenParty) => void) => {
  store.parties.forEach(callback);
  registerListener('parties', callback);
};

export const createParty = async (host: string, currentTrackId: string) => {
  const party: ListenParty = {
    id: `party_${crypto.randomUUID()}`,
    host,
    currentTrackId,
    timestamp: Date.now(),
    participants: 1,
    status: 'PLAYING'
  };
  store.parties = [party, ...store.parties];
  persistStore();
  emit('parties', party);
};

export const subscribeToCredits = (userId: string, callback: (credits: number) => void) => {
  callback(store.credits[userId] ?? 100);
  registerListener('credits_update', (payload: { userId: string; credits: number }) => {
    if (payload.userId === userId) callback(payload.credits);
  });
};

export const updateUserCredits = (amount: number) => {
  const sessionRaw = localStorage.getItem('bitbeats_session');
  if (!sessionRaw) return;
  const session = JSON.parse(sessionRaw) as { id: string };
  store.credits[session.id] = amount;
  persistStore();
  emit('credits_update', { userId: session.id, credits: amount });
};
