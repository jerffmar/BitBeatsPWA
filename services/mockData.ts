
import { Track, Bounty, SocialPost, ListenParty } from '../types';

// MOCKS REMOVED - NOW USING REAL GUN.JS DB
export const MOCK_TRACKS: Track[] = [];

export const MOCK_BOUNTIES: Bounty[] = [];

export const MOCK_POSTS: SocialPost[] = [];

export const MOCK_PARTIES: ListenParty[] = [
    { id: 'lp1', host: 'DJ_Algorithm', currentTrackId: 't4', timestamp: Date.now(), participants: 142, status: 'PLAYING' },
    { id: 'lp2', host: 'Chill_Lounge', currentTrackId: 't2', timestamp: Date.now(), participants: 28, status: 'PLAYING' },
];

export const calculateRatio = (down: number, up: number) => {
    if (down === 0) return up > 0 ? 999 : 0;
    return parseFloat((up / down).toFixed(2));
};
