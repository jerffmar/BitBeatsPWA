import { useEffect, useState } from 'react';
import useTorrentClient from './useTorrentClient';

interface StreamState {
  audioUrl: string | null;
  downloadSpeed: number;
  progress: number;
  peers: number;
}

export default function useStreamEngine(magnetLink: string) {
  const client = useTorrentClient();
  const [state, setState] = useState<StreamState>({
    audioUrl: null,
    downloadSpeed: 0,
    progress: 0,
    peers: 0,
  });

  useEffect(() => {
    if (!magnetLink || !client) return;

    let fileUrl: string | null = null;
    client.add(magnetLink, (torrent) => {
      const audioFile = torrent.files.find(f =>
        f.name.endsWith('.mp3') || f.name.endsWith('.flac')
      );
      if (!audioFile) return;

      // Deselect all, then select only the audio file
      torrent.files.forEach(f => f.deselect());
      audioFile.select();

      // Prioritize first and last pieces for streaming
      audioFile.select(0);
      audioFile.select(audioFile._lastPiece);

      audioFile.getBlobURL((err, url) => {
        if (!err && url) {
          fileUrl = url;
          setState(s => ({ ...s, audioUrl: url }));
        }
      });

      const updateStats = () => {
        setState(s => ({
          ...s,
          downloadSpeed: torrent.downloadSpeed,
          progress: torrent.progress,
          peers: torrent.numPeers,
        }));
      };
      torrent.on('download', updateStats);
      torrent.on('wire', updateStats);
      torrent.on('done', updateStats);
    });

    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      // Remove torrent if needed
      client.torrents.forEach(t => {
        if (t.magnetURI === magnetLink) client.remove(t.magnetURI);
      });
    };
  }, [magnetLink, client]);

  return state;
}
