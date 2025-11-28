import { useState } from 'react';
import { saveFile, getFile, hasFile } from '../services/OPFSManager';
import useTorrentClient from './useTorrentClient';

export function useOfflineVault() {
  const client = useTorrentClient();
  const [offlineMap, setOfflineMap] = useState<Record<string, boolean>>({});

  const checkOffline = async (trackId: string) => {
    const exists = await hasFile(trackId);
    setOfflineMap(map => ({ ...map, [trackId]: exists }));
    return exists;
  };

  const downloadTrack = async (track: any) => {
    if (!client || !track.magnetLink) return;
    return new Promise<void>((resolve, reject) => {
      client.add(track.magnetLink, { announce: [] }, async (torrent) => {
        const audioFile = torrent.files.find(f =>
          f.name.endsWith('.mp3') || f.name.endsWith('.flac')
        );
        if (!audioFile) return reject('No audio file found');
        audioFile.select();
        const blob = await audioFile.getBlob();
        await saveFile(track.id, blob);
        setOfflineMap(map => ({ ...map, [track.id]: true }));
        client.remove(torrent.infoHash);
        resolve();
      });
    });
  };

  const getTrackSrc = async (track: any): Promise<string | null> => {
    if (offlineMap[track.id] || await hasFile(track.id)) {
      const blob = await getFile(track.id);
      if (blob) return URL.createObjectURL(blob);
    }
    return null;
  };

  return { offlineMap, checkOffline, downloadTrack, getTrackSrc };
}
