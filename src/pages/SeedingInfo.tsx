import React, { useEffect, useState } from 'react';
import { Server, Link as LinkIcon, Users, Download, Upload } from 'lucide-react';
import { getTorrentStats } from '../services/torrent';
import { CoverImage } from '../components/ui/CoverImage';
import { Track, LibraryEntry } from '../types';

interface SeedingInfoProps {
  library: Record<string, LibraryEntry>;
  tracks: Track[];
}

export const SeedingInfo: React.FC<SeedingInfoProps> = ({ library, tracks }) => {
  const [torrentStats, setTorrentStats] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchStats = async () => {
      const stats: Record<string, any> = {};
      for (const entry of Object.values(library)) {
        const track = tracks.find(t => t.id === entry.trackId);
        if (track && track.audioUrl.startsWith('magnet:')) {
          stats[track.id] = await getTorrentStats(track.audioUrl);
        }
      }
      setTorrentStats(stats);
    };
    fetchStats();
  }, [library, tracks]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
        <Server size={28} className="text-brand-500" /> Seeding Info
      </h1>
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
          </tr>
        </thead>
        <tbody>
          {Object.values(library).map((entry) => {
            const track = tracks.find(t => t.id === entry.trackId);
            if (!track || !track.audioUrl.startsWith('magnet:')) return null;
            const stats = torrentStats[track.id] || {};
            return (
              <tr key={track.id} className="border-b border-white/10 hover:bg-white/10 transition-colors">
                <td className="py-2 px-2">
                  <CoverImage
                    mbid={track.mbid}
                    fallbackSrc={track.coverUrl}
                    type="track"
                    size="small"
                    className="w-10 h-10 object-cover rounded"
                    alt={track.title}
                  />
                </td>
                <td className="py-2 px-2 text-white font-medium">{track.title}</td>
                <td className="py-2 px-2">
                  <a href={track.audioUrl} className="text-brand-500 flex items-center gap-1" target="_blank" rel="noopener noreferrer">
                    <LinkIcon size={14} /> Magnet
                  </a>
                </td>
                <td className="py-2 px-2 text-gray-400">{stats.torrentId || '-'}</td>
                <td className="py-2 px-2 text-green-400 flex items-center gap-1">
                  <Upload size={14} /> {stats.seeders ?? '-'}
                </td>
                <td className="py-2 px-2 text-yellow-400 flex items-center gap-1">
                  <Download size={14} /> {stats.leechers ?? '-'}
                </td>
                <td className="py-2 px-2 text-gray-400">{stats.fileSize ? `${(stats.fileSize / (1024*1024)).toFixed(2)} MB` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {Object.keys(library).length === 0 && (
        <p className="text-gray-500 text-sm italic mt-8">No seeding data available.</p>
      )}
    </div>
  );
};
