import React from 'react';
import TrackRow from '../components/Library/TrackRow';

const MOCK_ALBUM = {
  id: 'album1',
  title: 'BitBeats Demo Album',
  artist: 'Various Artists',
  cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
  duration: 42 * 60, // seconds
  tracks: [
    { id: 'track1', title: 'Genesis', artist: 'DJ Hybrid' },
    { id: 'track2', title: 'Pulse', artist: 'Synthwave' },
    { id: 'track3', title: 'Echoes', artist: 'Bitstream' },
  ],
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const AlbumDetails: React.FC = () => (
  <div
    className="min-h-screen"
    style={{
      background: `linear-gradient(135deg, #232526 0%, #414345 100%)`,
      padding: '32px',
    }}
  >
    <div className="flex items-center gap-8 mb-10">
      <img
        src={MOCK_ALBUM.cover}
        alt="Album Art"
        className="w-48 h-48 rounded-lg shadow-lg object-cover"
      />
      <div>
        <h1 className="text-4xl font-bold mb-2">{MOCK_ALBUM.title}</h1>
        <h2 className="text-xl text-zinc-400 mb-4">{MOCK_ALBUM.artist}</h2>
        <div className="text-zinc-300">Total Duration: {formatDuration(MOCK_ALBUM.duration)}</div>
      </div>
    </div>
    <div className="bg-zinc-900 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Tracks</h3>
      <div>
        {MOCK_ALBUM.tracks.map((track, idx) => (
          <TrackRow
            key={track.id}
            track={track}
            index={idx}
            onPlay={() => alert(`Play ${track.title}`)}
          />
        ))}
      </div>
    </div>
  </div>
);

export default AlbumDetails;
