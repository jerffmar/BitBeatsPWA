import type { UserStats } from '../types.ts';

const SIGNING_SECRET_KEY = 'bitbeats_signing_secret';
const PEER_PREFIX = 'bitbeats_peer_';
const HEARTBEAT_INTERVAL = 5000;
const PEER_TTL = 8000;

const peerId = `${PEER_PREFIX}${crypto.randomUUID()}`;

const heartbeat = () => {
  localStorage.setItem(peerId, Date.now().toString());
};

setInterval(heartbeat, HEARTBEAT_INTERVAL);
heartbeat();

export const getReputation = (ratio: number, uploads: number): UserStats['reputation'] => {
  if (ratio < 0.5) return 'Leecher';
  if (ratio < 1.0) return 'Member';
  if (ratio >= 1.0 && uploads > 1024 * 1024 * 1024) return 'Archivist';
  if (ratio >= 2.0) return 'Gold Seeder';
  return 'Seeder';
};

export const discoverLocalPeers = async (): Promise<number> => {
  const now = Date.now();
  const keys = Object.keys(localStorage).filter(key => key.startsWith(PEER_PREFIX));
  let active = 0;
  keys.forEach(key => {
    const ts = Number(localStorage.getItem(key));
    if (!ts || now - ts > PEER_TTL) {
      localStorage.removeItem(key);
    } else {
      active += 1;
    }
  });
  return active;
};

export const signUpload = async (_fileBlob: Blob, dataToSign: string): Promise<string> => {
  let secret = localStorage.getItem(SIGNING_SECRET_KEY);
  if (!secret) {
    secret = crypto.randomUUID();
    localStorage.setItem(SIGNING_SECRET_KEY, secret);
  }
  const payload = new TextEncoder().encode(`${secret}:${dataToSign}`);
  const hash = await crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

let ghostAudio: AudioContext | null = null;
export const toggleGhostSeeding = (enable: boolean) => {
  if (enable && !ghostAudio) {
    ghostAudio = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ghostAudio.createOscillator();
    const gain = ghostAudio.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ghostAudio.destination);
    osc.start();
  }
  if (!enable && ghostAudio) {
    ghostAudio.close();
    ghostAudio = null;
  }
};
