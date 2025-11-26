
import { Track } from '../types';

export interface MockArtist {
  id: string;
  name: string;
  bio: string;
  monthlyListeners: number;
  verified: boolean;
  tags: string[];
  coverImage: string;
  backgroundImage: string;
}

export interface MockAlbum {
  id: string;
  artistId: string;
  title: string;
  description: string;
  year: number;
  coverUrl: string;
  genre: string[];
  duration: string; // e.g. "42 min"
  tracks: MockTrack[];
}

export interface MockTrack extends Partial<Track> {
  id: string;
  index: number;
  title: string;
  plays: number;
  duration: number; // seconds
  isCached: boolean; // For green dot indicator
  needsRequest: boolean; // For grey cloud indicator
}

export const MOCK_ARTIST: MockArtist = {
  id: 'ar_the_midnight',
  name: 'The Midnight',
  verified: true,
  monthlyListeners: 1420500,
  tags: ['Synthwave', 'Retrowave', 'Electronic', 'Indie'],
  coverImage: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=800',
  backgroundImage: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1600',
  bio: "The Midnight is a synthwave band composed of Atlanta-based singer-songwriter Tyler Lyle and Los Angeles-based Danish producer, songwriter, and singer Tim McEwan. The band was formed as a result of the two meeting during a co-writing workshop in North Hollywood, CA in 2012. Inspired by the score for Drive and the retro-synth genre growing around the time, the pair wrote two singles 'WeMoveForward' and 'Gloria', which would be released two years later as part of their debut EP 'Days of Thunder'. Their sound is characterized by nostalgic 80s synths, saxophone solos, and driving beats."
};

export const MOCK_ALBUMS: MockAlbum[] = [
  {
    id: 'al_endless_summer',
    artistId: 'ar_the_midnight',
    title: 'Endless Summer',
    description: "The sophomore album that defined a generation of synthwave lovers. A perfect blend of nostalgic beats and summer vibes.",
    year: 2016,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600',
    genre: ['Synthwave', 'Pop'],
    duration: '54 min',
    tracks: Array.from({ length: 10 }).map((_, i) => ({
      id: `t_es_${i}`,
      index: i + 1,
      title: ['Endless Summer', 'Sunset', 'Daytona', 'Jason', 'Synthetic', 'The Comeback Kid', 'Vampires', 'Crockett\'s Revenge', 'Nighthawks', 'Lonely City'][i],
      artist: 'The Midnight',
      album: 'Endless Summer',
      duration: 200 + Math.floor(Math.random() * 120),
      plays: Math.floor(Math.random() * 500000),
      isCached: i % 3 === 0, // Mock cached status
      needsRequest: i === 7,
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600',
      audioUrl: 'magnet:?xt=urn:btih:mock_magnet_link' // Mock
    }))
  },
  {
    id: 'al_monsters',
    artistId: 'ar_the_midnight',
    title: 'Monsters',
    description: "A slightly darker tone exploring the internet age and connection.",
    year: 2020,
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600',
    genre: ['Dream Pop', 'Synthwave'],
    duration: '48 min',
    tracks: Array.from({ length: 10 }).map((_, i) => ({
      id: `t_mon_${i}`,
      index: i + 1,
      title: ['1991', 'America Online', 'Dance with Somebody', 'Seventeen', 'Dream Away', 'The Search for Ecco', 'Prom Night', 'Fire in the Sky', 'Monsters', 'Last Train'][i],
      artist: 'The Midnight',
      album: 'Monsters',
      duration: 180 + Math.floor(Math.random() * 100),
      plays: Math.floor(Math.random() * 200000),
      isCached: i < 2,
      needsRequest: false,
      coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600',
      audioUrl: 'magnet:?xt=urn:btih:mock_magnet_link'
    }))
  }
];
