const API_BASE = 'http://localhost:3001/api/seeding'; // <-- Update to your backend server address

export interface ServerSeedInfo {
  id: string;
  magnet: string;
  torrentId: string;
  seeders: number;
  leechers: number;
  fileSize: number;
  expiresAt: number;
  title: string;
  artist: string;
  coverUrl?: string;
}

export async function uploadToServer(file: File, metadata: { title: string; artist: string; coverUrl?: string }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', metadata.title);
  formData.append('artist', metadata.artist);
  if (metadata.coverUrl) formData.append('coverUrl', metadata.coverUrl);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return await res.json() as ServerSeedInfo;
}

export async function fetchServerSeeds(): Promise<ServerSeedInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/list`);
    if (!res.ok) return [];
    return await res.json() as ServerSeedInfo[];
  } catch (err) {
    console.warn('Failed to fetch server seeds:', err);
    return [];
  }
}
