import React, { useEffect, useState } from 'react';
import { Server, Users, Wifi, Globe, List, Loader } from 'lucide-react';
import { getClient, initTorrentClient } from '../services/torrent';
import { fetchServerSeeds, ServerSeedInfo } from '../src/services/serverSeeding';

const TRACKERS = [
  'udp://tracker.openbittorrent.com:80/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://exodus.desync.com:6969/announce'
];

function appendTrackers(magnet: string) {
  let url = magnet;
  TRACKERS.forEach(tr => {
    if (!url.includes(encodeURIComponent(tr))) {
      url += `&tr=${encodeURIComponent(tr)}`;
    }
  });
  return url;
}

const fetchTrackersList = async (): Promise<string[]> => {
  try {
    const response = await fetch('/trackers.txt');
    if (!response.ok) return [];
    const text = await response.text();
    return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  } catch {
    return [];
  }
};

export const SeedingInfo: React.FC = () => {
  const [trackers, setTrackers] = useState<string[]>([]);
  const [torrents, setTorrents] = useState<any[]>([]);
  const [serverSeeds, setServerSeeds] = useState<ServerSeedInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedMagnet, setCopiedMagnet] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackersList().then(setTrackers);
    (async () => {
      await initTorrentClient();
      setLoading(false);
      const update = () => {
        const client = getClient();
        setTorrents(client?.torrents ? [...client.torrents] : []);
      };
      update();
      const interval = setInterval(update, 2000);
      return () => clearInterval(interval);
    })();
    fetchServerSeeds().then(setServerSeeds);
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
        <Server size={28} className="text-brand-500" /> Seeding Information
      </h1>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Globe size={18} className="text-brand-500" /> Trackers
        </h2>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          {trackers.length === 0 ? (
            <span className="text-gray-500">No trackers loaded.</span>
          ) : (
            <ul className="text-xs text-gray-300 space-y-1">
              {trackers.map((tr, idx) => (
                <li key={tr + '-' + idx} className="break-all">{tr}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <List size={18} className="text-brand-500" /> Torrents
        </h2>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400"><Loader className="animate-spin" /> Loading...</div>
          ) : torrents.length === 0 ? (
            <span className="text-gray-500">No active torrents.</span>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="py-2 px-2 text-left">Name</th>
                  <th className="py-2 px-2 text-left">Seeders</th>
                  <th className="py-2 px-2 text-left">Leechers</th>
                  <th className="py-2 px-2 text-left">Peers</th>
                  <th className="py-2 px-2 text-left">Progress</th>
                  <th className="py-2 px-2 text-left">Download Speed</th>
                  <th className="py-2 px-2 text-left">Upload Speed</th>
                  <th className="py-2 px-2 text-left">Magnet</th>
                </tr>
              </thead>
              <tbody>
                {torrents.map(t => (
                  <tr key={t.infoHash} className="border-b border-white/10">
                    <td className="py-2 px-2 text-white font-medium">{t.name}</td>
                    <td className="py-2 px-2 text-emerald-400">{t.numPeers - t._numWant}</td>
                    <td className="py-2 px-2 text-yellow-400">{t._numWant}</td>
                    <td className="py-2 px-2 text-gray-400">{t.numPeers}</td>
                    <td className="py-2 px-2">
                      <div className="w-24 bg-black/30 rounded-full h-2 relative">
                        <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.round((t.progress ?? 0) * 100)}%` }}></div>
                      </div>
                      <span className="text-xs text-gray-400 ml-2">{Math.round((t.progress ?? 0) * 100)}%</span>
                    </td>
                    <td className="py-2 px-2 text-blue-400">{(t.downloadSpeed / 1024).toFixed(1)} KB/s</td>
                    <td className="py-2 px-2 text-green-400">{(t.uploadSpeed / 1024).toFixed(1)} KB/s</td>
                    <td className="py-2 px-2 font-mono text-xs break-all">
                      <a href={t.magnetURI} target="_blank" rel="noopener noreferrer" className="text-brand-500 underline">Magnet</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Wifi size={18} className="text-brand-500" /> Server-Seeding Info
        </h2>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <table className="min-w-full text-sm bg-white/5 rounded-xl overflow-hidden">
            <thead>
              <tr className="text-gray-400 border-b border-white/10">
                <th className="py-2 px-2 text-left">Cover</th>
                <th className="py-2 px-2 text-left">Title</th>
                <th className="py-2 px-2 text-left">Magnet Link</th>
                <th className="py-2 px-2 text-left">Torrent ID</th>
                <th className="py-2 px-2 text-left">Seeders</th>
                <th className="py-2 px-2 text-left">Leechers</th>
                <th className="py-2 px-2 text-left">File Size</th>
                <th className="py-2 px-2 text-left">Expires</th>
              </tr>
            </thead>
            <tbody>
              {/* Server seeds */}
              {serverSeeds.map(seed => (
                <tr key={seed.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                  <td className="py-2 px-2">
                    {seed.coverUrl ? (
                      <img src={seed.coverUrl} className="w-10 h-10 object-cover rounded" alt={seed.title} />
                    ) : (
                      <div className="w-10 h-10 bg-gray-800 rounded"></div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-white font-medium">{seed.title} <span className="text-xs text-brand-500 ml-1">[Server]</span></td>
                  <td className="py-2 px-2">
                    <button
                      className="text-brand-500 flex items-center gap-1 underline"
                      onClick={() => {
                        const magnetWithTrackers = appendTrackers(seed.magnet);
                        navigator.clipboard.writeText(magnetWithTrackers);
                        setCopiedMagnet(seed.id);
                        setTimeout(() => setCopiedMagnet(null), 2000);
                      }}
                      title="Copy magnet link with all trackers"
                    >
                      <LinkIcon size={14} /> Magnet
                      {copiedMagnet === seed.id && (
                        <span className="ml-2 text-xs text-green-400">Copied!</span>
                      )}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-gray-400">{seed.torrentId || '-'}</td>
                  <td className="py-2 px-2 text-green-400 flex items-center gap-1">
                    <Upload size={14} /> {typeof seed.seeders === 'number' && !isNaN(seed.seeders) ? seed.seeders : '-'}
                  </td>
                  <td className="py-2 px-2 text-yellow-400 flex items-center gap-1">
                    <Download size={14} /> {typeof seed.leechers === 'number' && !isNaN(seed.leechers) ? seed.leechers : '-'}
                  </td>
                  <td className="py-2 px-2 text-gray-400">{typeof seed.fileSize === 'number' && !isNaN(seed.fileSize) ? `${(seed.fileSize / (1024*1024)).toFixed(2)} MB` : '-'}</td>
                  <td className="py-2 px-2 text-gray-400">{seed.expiresAt ? new Date(seed.expiresAt).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
