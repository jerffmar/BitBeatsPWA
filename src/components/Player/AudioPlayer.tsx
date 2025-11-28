import React, { useRef, useEffect } from 'react';

interface Props {
  audioUrl: string | null;
  onEnded?: () => void;
}

const AudioPlayer: React.FC<Props> = ({ audioUrl, onEnded }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);

  const play = () => audioRef.current?.play();
  const pause = () => audioRef.current?.pause();
  const setVolume = (v: number) => {
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <audio
      ref={audioRef}
      controls
      onEnded={onEnded}
      style={{ width: '100%' }}
    />
  );
};

export default AudioPlayer;
