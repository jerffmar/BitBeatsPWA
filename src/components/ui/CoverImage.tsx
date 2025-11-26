
import React, { useState, useEffect } from 'react';
import { Disc, Mic2, Music, ImageOff } from 'lucide-react';
import { getCoverArtUrl } from '../../utils/coverArt';

interface CoverImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  mbid?: string;
  size?: 'small' | 'large';
  type?: 'artist' | 'album' | 'track';
  fallbackSrc?: string;
}

export const CoverImage: React.FC<CoverImageProps> = ({ 
  mbid, 
  size = 'large', 
  type = 'album',
  fallbackSrc,
  className = '', 
  alt,
  ...props 
}) => {
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>('');

  useEffect(() => {
    setError(false);
    
    // 1. Try MBID URL first
    if (mbid) {
       setImgSrc(getCoverArtUrl(mbid, size));
    } 
    // 2. Fallback to provided source (e.g. existing metadata url)
    else if (fallbackSrc) {
       setImgSrc(fallbackSrc);
    } 
    // 3. No sources available
    else {
       setError(true);
    }
  }, [mbid, size, fallbackSrc]);

  const handleError = () => {
    // If we were trying MBID and failed, try fallbackSrc if different
    if (mbid && imgSrc === getCoverArtUrl(mbid, size) && fallbackSrc) {
        setImgSrc(fallbackSrc);
    } else {
        setError(true);
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-800 text-gray-600 border border-white/5 ${className}`}>
        {type === 'artist' && <Mic2 size={24} className="opacity-50" />}
        {type === 'album' && <Disc size={24} className="opacity-50" />}
        {type === 'track' && <Music size={24} className="opacity-50" />}
        {!['artist', 'album', 'track'].includes(type) && <ImageOff size={24} className="opacity-50" />}
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt={alt || 'Cover Art'} 
      className={`${className} bg-gray-900`}
      onError={handleError}
      loading="lazy"
      {...props}
    />
  );
};
