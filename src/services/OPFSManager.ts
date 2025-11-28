const TRACKS_DIR = 'tracks';

async function getTracksDir() {
  const root = await (navigator.storage as any).getDirectory();
  let dir = await root.getDirectoryHandle(TRACKS_DIR, { create: true });
  return dir;
}

export async function saveFile(trackId: string, file: Blob) {
  const dir = await getTracksDir();
  const handle = await dir.getFileHandle(trackId, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();
}

export async function getFile(trackId: string): Promise<Blob | null> {
  const dir = await getTracksDir();
  try {
    const handle = await dir.getFileHandle(trackId);
    const file = await handle.getFile();
    return file;
  } catch {
    return null;
  }
}

export async function hasFile(trackId: string): Promise<boolean> {
  const dir = await getTracksDir();
  try {
    await dir.getFileHandle(trackId);
    return true;
  } catch {
    return false;
  }
}

export async function deleteFile(trackId: string) {
  const dir = await getTracksDir();
  await dir.removeEntry(trackId);
}
