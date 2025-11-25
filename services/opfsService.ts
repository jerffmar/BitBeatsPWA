/**
 * OPFS Service - The "Vault"
 * Handles persistent storage of audio blobs using the File System Access API.
 */

export const opfsSupported = 'storage' in navigator && 'getDirectory' in navigator.storage;

// Helper to get the root directory handle
const getRoot = async () => {
  if (!opfsSupported) throw new Error("OPFS not supported");
  return await navigator.storage.getDirectory();
};

export const saveTrackToVault = async (trackId: string, data: ArrayBuffer): Promise<boolean> => {
  try {
    if (!opfsSupported) {
      console.warn("OPFS not supported, skipping persistence");
      return false;
    }
    const root = await getRoot();
    const trackDir = await root.getDirectoryHandle('tracks', { create: true });
    const fileHandle = await trackDir.getFileHandle(`${trackId}.mp3`, { create: true });
    
    // In a real app, we might use FileSystemSyncAccessHandle in a worker for performance
    // For this UI demo, standard writable is sufficient
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  } catch (err) {
    console.error("Failed to save to OPFS", err);
    return false;
  }
};

export const getTrackFromVault = async (trackId: string): Promise<string | null> => {
  try {
    if (!opfsSupported) return null;
    const root = await getRoot();
    const trackDir = await root.getDirectoryHandle('tracks', { create: false });
    const fileHandle = await trackDir.getFileHandle(`${trackId}.mp3`, { create: false });
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (err) {
    // File doesn't exist or error
    return null;
  }
};

export const checkVaultStatus = async (trackId: string): Promise<boolean> => {
  try {
    if (!opfsSupported) return false;
    const root = await getRoot();
    try {
        const trackDir = await root.getDirectoryHandle('tracks');
        await trackDir.getFileHandle(`${trackId}.mp3`);
        return true;
    } catch {
        return false;
    }
  } catch {
    return false;
  }
};

export const getVaultUsage = async (): Promise<number> => {
    // This is an estimation/mock because iterating all files is heavy
    // Real implementation would track usage in a separate metadata file
    return Math.floor(Math.random() * 500) + 120; // Mock MB usage
};