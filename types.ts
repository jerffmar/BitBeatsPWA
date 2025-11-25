
export interface Track {
  id: string;
  mbid?: string; // MusicBrainz ID for linking
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number; // seconds
  audioUrl: string; // Remote source
  license: 'CC-BY' | 'CC0' | 'Public Domain';
  size: number; // MB
  // New Metadata
  bpm?: number;
  tags: string[];
  artistSignature?: string; // Ed25519 signature
  networkHealth: number; // 0-100 (Availability in swarm)
}

export interface User {
  id: string;
  username: string;
  handle: string;
  joinedAt: number;
}

export interface UserStats {
  downloadedBytes: number;
  uploadedBytes: number;
  ratio: number;
  reputation: 'Leecher' | 'Member' | 'Seeder' | 'Archivist' | 'Gold Seeder';
  credits: number; // Virtual currency for Bounties
}

export interface Bounty {
  id: string;
  mbid?: string; // Link to specific MusicBrainz Entry
  query: string;
  reward: number; // Credits
  requesterCount: number;
  status: 'OPEN' | 'FULFILLED';
  fulfilledBy?: string;
}

export interface SocialPost {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  trackId?: string; // Contextual comment
}

export interface ListenParty {
  id: string;
  host: string;
  currentTrackId: string;
  timestamp: number;
  participants: number;
  status: 'PLAYING' | 'PAUSED';
}

export interface LibraryEntry {
  trackId: string;
  status: 'REMOTE' | 'DOWNLOADING' | 'SEEDING' | 'PAUSED';
  progress: number;
  localPath?: string;
  lastPlayed: number;
  addedAt: number;
}

// Result from MusicBrainz API (The Vitrine)
export interface GlobalCatalogEntry {
  mbid: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  coverUrl?: string;
}

export type ViewState = 'DISCOVERY' | 'LIBRARY' | 'BOUNTIES' | 'SWARM' | 'STUDIO' | 'SEARCH_RESULTS';

export interface StorageConfig {
  maxUsageGB: number;
  evictionStrategy: 'LRU' | 'SMART_RARITY'; // Least Recently Used vs Rarity (Keep rare files)
  ghostSeeding: boolean;
}