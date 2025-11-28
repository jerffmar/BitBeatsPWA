import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import WebTorrent from 'webtorrent';
import { readFileSync } from 'fs';

const execFileAsync = promisify(execFile);

const STORAGE_DIR = path.resolve(process.env.BITBEATS_STORAGE_DIR || './uploads');
const META_FILE = path.join(STORAGE_DIR, 'meta.json');
const USER_QUOTA_BYTES = 15 * 1024 * 1024 * 1024; // 15GB
const EXPIRY_DAYS = 90;
const TRACKERS = readFileSync(path.resolve('./trackers.txt'), 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

let meta: Record<string, {
  hash: string;
  filename: string;
  uploaders: { userId: string; expires: number }[];
  size: number;
  magnetURI?: string;
}> = {};

const client = new WebTorrent();

const loadMeta = async () => {
  try {
    const raw = await fs.readFile(META_FILE, 'utf-8');
    meta = JSON.parse(raw);
  } catch {
    meta = {};
  }
};
const saveMeta = async () => {
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2));
};

export const handleUpload = async (userId: string, fileBuffer: Buffer, originalName: string) => {
  await loadMeta();

  // 1. Fingerprint/hash for deduplication
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const filename = `${hash}${path.extname(originalName)}`;
  const filePath = path.join(STORAGE_DIR, filename);

  // 2. Enforce user quota
  const userFiles = Object.values(meta)
    .filter(m => m.uploaders.some(u => u.userId === userId));
  const userUsage = userFiles.reduce((sum, m) => sum + m.size, 0);
  if (userUsage + fileBuffer.length > USER_QUOTA_BYTES) {
    throw new Error('Storage quota exceeded (15GB)');
  }

  // 3. Deduplication & expiry renewal
  let entry = meta[hash];
  const now = Date.now();
  const expires = now + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  if (entry) {
    // Renew expiry for this user
    const uploader = entry.uploaders.find(u => u.userId === userId);
    if (uploader) {
      uploader.expires = expires;
    } else {
      entry.uploaders.push({ userId, expires });
    }
    await saveMeta();
    return entry;
  }

  // 4. Save file
  await fs.writeFile(filePath, fileBuffer);

  // 5. Seed via WebTorrent
  const torrent = await new Promise<any>((resolve, reject) => {
    client.seed(filePath, { announce: TRACKERS }, (t: any) => {
      resolve(t);
    });
  });

  // 6. Store metadata
  entry = {
    hash,
    filename,
    uploaders: [{ userId, expires }],
    size: fileBuffer.length,
    magnetURI: torrent.magnetURI
  };
  meta[hash] = entry;
  await saveMeta();

  return entry;
};

// Periodic cleanup (delete expired files)
export const cleanupExpiredFiles = async () => {
  await loadMeta();
  const now = Date.now();
  for (const [hash, entry] of Object.entries(meta)) {
    entry.uploaders = entry.uploaders.filter(u => u.expires > now);
    if (entry.uploaders.length === 0) {
      // Delete file
      try { await fs.unlink(path.join(STORAGE_DIR, entry.filename)); } catch {}
      delete meta[hash];
    }
  }
  await saveMeta();
};

// Utility to get user usage
export const getUserUsage = async (userId: string) => {
  await loadMeta();
  const userFiles = Object.values(meta)
    .filter(m => m.uploaders.some(u => u.userId === userId));
  return userFiles.reduce((sum, m) => sum + m.size, 0);
};
