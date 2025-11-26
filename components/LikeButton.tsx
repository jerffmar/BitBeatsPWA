
import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { likeService } from '../services/likeService';

interface LikeButtonProps {
    userId: string;
    entityId: string;
    entityType: 'artist' | 'album' | 'track';
    metadata: {
        title: string;
        coverUrl: string;
        subtitle?: string;
    };
    className?: string;
    variant?: 'icon' | 'button';
}

export const LikeButton: React.FC<LikeButtonProps> = ({ 
    userId, entityId, entityType, metadata, className = '', variant = 'icon' 
}) => {
    const [isLiked, setIsLiked] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if(userId && entityId) {
            setIsLiked(likeService.checkIsLiked(userId, entityType, entityId));
        }
    }, [userId, entityId, entityType]);

    const handleToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!userId) return;

        // Optimistic Update
        const newState = !isLiked;
        setIsLiked(newState);
        setIsAnimating(true);

        try {
            await likeService.toggleLike(userId, entityType, entityId, metadata);
        } catch (err) {
            // Revert on error
            setIsLiked(!newState);
            console.error("Failed to toggle like", err);
        }

        setTimeout(() => setIsAnimating(false), 300);
    };

    if (variant === 'button') {
        return (
            <button 
                onClick={handleToggle}
                className={`p-3 border rounded-full transition-colors flex items-center justify-center ${
                    isLiked 
                    ? 'bg-brand-500 text-black border-brand-500' 
                    : 'bg-transparent border-white/10 hover:bg-white/10 text-gray-400 hover:text-white'
                } ${className}`}
            >
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </button>
        );
    }

    return (
        <motion.button 
            onClick={handleToggle}
            whileTap={{ scale: 0.8 }}
            animate={isAnimating ? { scale: [1, 1.2, 1] } : {}}
            className={`transition-colors ${isLiked ? 'text-brand-500' : 'text-gray-400 hover:text-white'} ${className}`}
        >
            <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
        </motion.button>
    );
};
