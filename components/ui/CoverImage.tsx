import React from "react";

interface CoverImageProps {
  src: string;
  alt?: string;
  className?: string;
}

export const CoverImage: React.FC<CoverImageProps> = ({ src, alt = "", className }) => (
  <img src={src} alt={alt} className={className} />
);
