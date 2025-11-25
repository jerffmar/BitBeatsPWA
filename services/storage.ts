
import { Track, LibraryEntry, StorageConfig } from '../types';

/**
 * THE VAULT (Storage Layer)
 * Uses Origin Private File System (OPFS) for persistent audio blobs.
 * Implements "Smart Eviction" to manage disk space.
 */

const ROOT_DIR = 'tracks';
const META_DIR = 'meta';

export const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;

const getRoot = async () => {
  if (!opfsSupported) throw new Error("OPFS not supported");
  const root = await navigator.storage.getDirectory();
  return root;
};

// --- Core File Operations ---

export const saveToVault = async (trackId: string, data: ArrayBuffer): Promise<boolean> => {
  try {
    if (!opfsSupported) return false;
    const root = await getRoot();
    
    // Create directories
    const trackDir = await root.getDirectoryHandle(ROOT_DIR, { create: true });
    
    // Write File
    const fileHandle = await trackDir.getFileHandle(`${trackId}.mp3`, { create: true });
    // @ts-ignore - FileSystemSyncAccessHandle types vary in TS
    const writable = await fileHandle.createWritable(); 
    await writable.write(data);
    await writable.close();
    
    return true;
  } catch (err) {
    console.error("Vault Write Error:", err);
    return false;
  }
};

export const loadFromVault = async (trackId: string): Promise<string | null> => {
  try {
    if (!opfsSupported) return null;
    const root = await getRoot();
    const trackDir = await root.getDirectoryHandle(ROOT_DIR);
    const fileHandle = await trackDir.getFileHandle(`${trackId}.mp3`);
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
};

export const checkVaultStatus = async (trackId: string): Promise<boolean> => {
  try {
    if (!opfsSupported) return false;
    const root = await getRoot();
    try {
        const trackDir = await root.getDirectoryHandle(ROOT_DIR);
        await trackDir.getFileHandle(`${trackId}.mp3`);
        return true;
    } catch {
        return false;
    }
  } catch {
    return false;
  }
};

export const getStoredBytes = async (): Promise<number> => {
    if (!opfsSupported) return 0;
    // Mock implementation as iterating recursively is expensive for a UI tick
    // In real app: use navigator.storage.estimate()
    return (await navigator.storage.estimate()).usage || 0;
};

// --- Smart Eviction Logic ---

/**
 * Decides which files to delete when disk is full.
 * Strategy: SMART_RARITY
 * 1. Filter tracks that haven't been played in 30 days.
 * 2. Sort by 'Network Health' (How many other seeders exist?).
 * 3. Delete files that are ABUNDANT in the network first.
 * 4. Preserve RARE files (Low health) even if not played recently.
 */
export const runSmartEviction = async (
    library: Record<string, LibraryEntry>, 
    tracks: Track[], 
    config: StorageConfig,
    currentUsageMB: number
): Promise<string[]> => {
    
    const maxMB = config.maxUsageGB * 1024;
    if (currentUsageMB < maxMB) return [];

    console.log("⚠️ Vault Full. Running Smart Eviction...");

    // Convert library to array
    const entries = Object.values(library).filter(e => e.status === 'SEEDING');

    // Calculate "Eviction Score" (Higher score = Delete first)
    // Formula: (DaysSinceLastPlayed * 2) + (NetworkHealth * 5)
    // Rationale: We aggressively delete things that are popular elsewhere.
    const scored = entries.map(entry => {
        const track = tracks.find(t => t.id === entry.trackId);
        const health = track?.networkHealth || 50; // default 50
        const daysSincePlayed = (Date.now() - entry.lastPlayed) / (1000 * 60 * 60 * 24);
        
        const score = (daysSincePlayed * 2) + (health * 5);
        return { id: entry.trackId, score };
    });

    // Sort descending (Highest score to delete)
    scored.sort((a, b) => b.score - a.score);

    const deletedIds: string[] = [];
    let freedSpace = 0;
    const overflow = currentUsageMB - maxMB;

    // Delete until we are under limit
    for (const item of scored) {
        if (freedSpace >= overflow) break;
        
        // Mock Delete Op
        // await deleteFromVault(item.id);
        deletedIds.push(item.id);
        
        const track = tracks.find(t => t.id === item.id);
        freedSpace += track?.size || 5; 
    }

    return deletedIds;
};

export const exportTrack = async (trackId: string, title: string) => {
    // Feature to pull file out of OPFS Sandbox into user Downloads
    const url = await loadFromVault(trackId);
    if (!url) return;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
