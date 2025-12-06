import type { UserStats } from '../types.ts';
import { getGun } from './db.ts';
import { getKeyPair } from './auth.ts';

const logGunNet = (...args: any[]) => console.debug('[GUN][NET]', ...args);

/**
 * P2P NETWORK SERVICE
 * Simulates the complex interactions of WebTorrent and Gun.js
 */

// --- Ratio Economics ---

export const getReputation = (ratio: number, uploads: number): UserStats['reputation'] => {
    if (ratio < 0.5) return 'Leecher';
    if (ratio < 1.0) return 'Member';
    if (ratio >= 1.0 && uploads > 1024 * 1024 * 1024) return 'Archivist'; // >1GB
    if (ratio >= 2.0) return 'Gold Seeder';
    return 'Seeder';
};

// --- LAN/Mesh Peer Discovery ---

export const discoverLocalPeers = async (): Promise<number> => {
    const gun = getGun();
    if (!gun) return 0;

    // Access internal Gun mesh state (opt.peers)
    // This isn't strictly "LAN" only, but shows active mesh connections
    // @ts-ignore
    const peers = gun._.opt.peers;
    if (!peers) return 0;
    
    const count = Object.keys(peers).length;
    logGunNet('discoverLocalPeers', { peers: count, peerKeys: Object.keys(peers) });
    return count;
};

// --- Crypto Signing (Real SEA) ---

export const signUpload = async (fileBlob: Blob, dataToSign: string): Promise<string> => {
    const pair = getKeyPair();
    if (!pair) throw new Error("User keypair not found. Cannot sign.");

    if (!window.SEA) throw new Error("SEA not loaded");

    console.log("🔐 Signing content with Ed25519...");
    const signature = await window.SEA.sign(dataToSign, pair);
    logGunNet('signUpload', { size: fileBlob.size, dataToSignLen: dataToSign.length });
    return signature;
};

// --- Ghost Seeding ---

let ghostAudio: HTMLAudioElement | null = null;

export const toggleGhostSeeding = (enable: boolean) => {
    if (enable) {
        if (!ghostAudio) {
            // Create silent loop
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.0001; // Not zero, but inaudible to prevent OS sleeping
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            // This is a hacky visualization of what the service worker would do
            console.log("👻 Ghost Seeder Active: Keeping WebRTC connection alive.");
        }
    } else {
        if (ghostAudio) {
            // ghostAudio.pause(); 
            // Cleanup
        }
    }
};
