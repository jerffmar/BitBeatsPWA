import { useRef, useEffect } from 'react';
import WebTorrent from 'webtorrent';

export default function useTorrentClient() {
  const clientRef = useRef<WebTorrent.Instance | null>(null);

  if (!clientRef.current) {
    clientRef.current = new WebTorrent();
  }

  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  return clientRef.current;
}
