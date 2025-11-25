
import { Track, Bounty, SocialPost, ListenParty } from '../types';

export const MOCK_TRACKS: Track[] = [
  {
    id: 't1',
    title: 'Neon Horizon',
    artist: 'Synthwave Boy',
    album: 'Digital Dreams',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop',
    duration: 215,
    audioUrl: 'https://commondatastorage.googleapis.com/codeskulptor-assets/Epoq-Lepidoptera.ogg',
    license: 'CC-BY',
    size: 4.2,
    bpm: 128,
    tags: ['synthwave', 'electronic', 'retro'],
    networkHealth: 95 // Very common
  },
  {
    id: 't2',
    title: 'Urban Jungle',
    artist: 'LoFi Beats',
    album: 'Chill Sessions Vol. 4',
    coverUrl: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=400&auto=format&fit=crop',
    duration: 184,
    audioUrl: 'https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/soundtrack.mp3',
    license: 'CC0',
    size: 3.8,
    bpm: 85,
    tags: ['lofi', 'chill', 'study'],
    networkHealth: 40 // Moderate
  },
  {
    id: 't3',
    title: 'Deep Focus',
    artist: 'Mindful Noise',
    album: 'Work Flow',
    coverUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=400&auto=format&fit=crop',
    duration: 300,
    audioUrl: 'https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/win.ogg',
    license: 'CC-BY',
    size: 6.5,
    bpm: 60,
    tags: ['ambient', 'focus'],
    networkHealth: 88
  },
  {
    id: 't4',
    title: 'Retro Gaming',
    artist: '8-Bit Hero',
    album: 'Pixel Perfect',
    coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&auto=format&fit=crop',
    duration: 145,
    audioUrl: 'https://commondatastorage.googleapis.com/codeskulptor-demos/pyman_assets/intromusic.ogg',
    license: 'CC-BY',
    size: 2.9,
    bpm: 140,
    tags: ['chiptune', 'game'],
    networkHealth: 10 // RARE!
  },
  {
    id: 't5',
    title: 'Acoustic Breeze',
    artist: 'Nature Sounds',
    album: 'Organic',
    coverUrl: 'https://images.unsplash.com/photo-1444464666117-26f60312fa72?q=80&w=400&auto=format&fit=crop',
    duration: 240,
    audioUrl: 'https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/start.ogg',
    license: 'Public Domain',
    size: 5.1,
    bpm: 100,
    tags: ['acoustic', 'folk'],
    networkHealth: 70
  }
];

export const MOCK_BOUNTIES: Bounty[] = [
    { id: 'b1', query: 'Jazz Classics 1998 (FLAC)', reward: 500, requesterCount: 12, status: 'OPEN' },
    { id: 'b2', query: 'Underground Techno Berlin Vol 2', reward: 1200, requesterCount: 34, status: 'OPEN' },
    { id: 'b3', query: 'Lost Tapes of Synthia', reward: 50, requesterCount: 2, status: 'FULFILLED', fulfilledBy: 'User_X99' },
];

export const MOCK_POSTS: SocialPost[] = [
    { id: 'p1', author: 'AudioPhile_99', content: 'Just found this gem. The bass response at 1:30 is insane.', timestamp: Date.now() - 100000, trackId: 't1' },
    { id: 'p2', author: 'TechnoViking', content: 'Does anyone have the FLAC version? I will pay 200 credits bounty.', timestamp: Date.now() - 500000, trackId: 't1' },
];

export const MOCK_PARTIES: ListenParty[] = [
    { id: 'lp1', host: 'DJ_Algorithm', currentTrackId: 't4', timestamp: Date.now(), participants: 142, status: 'PLAYING' },
    { id: 'lp2', host: 'Chill_Lounge', currentTrackId: 't2', timestamp: Date.now(), participants: 28, status: 'PLAYING' },
];

export const calculateRatio = (down: number, up: number) => {
    if (down === 0) return up > 0 ? 999 : 0;
    return parseFloat((up / down).toFixed(2));
};
