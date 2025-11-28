import React, { useState } from "react";

interface LikeButtonProps {
  liked?: boolean;
  onToggle?: (liked: boolean) => void;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ liked = false, onToggle }) => {
  const [isLiked, setIsLiked] = useState(liked);

  const handleClick = () => {
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    if (onToggle) onToggle(newLiked);
  };

  return (
    <button onClick={handleClick} aria-pressed={isLiked}>
      {isLiked ? "♥" : "♡"}
    </button>
  );
};
