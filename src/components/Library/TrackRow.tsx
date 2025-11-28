import React, { useState } from 'react';
import { useOfflineVault } from '../../hooks/useOfflineVault';

interface Track {
  id: string;
  title: string;
  artist: string;
  // ...other fields...
}

interface Props {
  track: Track;
  index: number;
  onPlay: (track: Track) => void;
}

const TrackRow: React.FC<Props> = ({ track, index, onPlay }) => {
  const { offlineMap, downloadTrack, checkOffline } = useOfflineVault();
  const [hover, setHover] = useState(false);
  const isOffline = offlineMap[track.id];

  React.useEffect(() => {
    checkOffline(track.id);
  }, [track.id]);

  return (
    <div
      className="track-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #222',
        cursor: 'pointer',
        background: hover ? '#222' : 'transparent'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ width: 32, textAlign: 'center' }}>
        {hover ? (
          <button onClick={() => onPlay(track)}>
            <span role="img" aria-label="Play">▶️</span>
          </button>
        ) : (
          <span>{index + 1}</span>
        )}
      </div>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <div style={{ fontWeight: 500 }}>{track.title}</div>
        <div style={{ fontSize: 12, color: '#aaa' }}>{track.artist}</div>
      </div>
      <div style={{ marginLeft: 12 }}>
        {isOffline ? (
          <span style={{ color: 'limegreen' }} title="Downloaded">✔️</span>
        ) : (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              await downloadTrack(track);
            }}
            title="Download"
          >
            <span role="img" aria-label="Download">⬇️</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TrackRow;
