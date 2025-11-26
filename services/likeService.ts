
import { LikedItem } from '../types';

const STORAGE_PREFIX = 'bitbeats_likes_';

const getStorageKey = (userId: string, type: 'artist' | 'album' | 'track') => {
    return `${STORAGE_PREFIX}${userId}_${type}`;
};

/**
 * Service to manage User Likes (Favorites).
 * Persists to localStorage to mimic a DB in this PWA environment.
 */
export const likeService = {
    /**
     * Toggles the like status of an entity.
     * Returns the NEW status (true = liked, false = unliked).
     */
    toggleLike: async (
        userId: string, 
        type: 'artist' | 'album' | 'track', 
        entityId: string, 
        metadata: { title: string, coverUrl: string, subtitle?: string }
    ): Promise<boolean> => {
        const key = getStorageKey(userId, type);
        const stored = localStorage.getItem(key);
        let items: LikedItem[] = stored ? JSON.parse(stored) : [];

        const existingIndex = items.findIndex(i => i.entityId === entityId);
        let isLiked = false;

        if (existingIndex >= 0) {
            // Un-like
            items.splice(existingIndex, 1);
            isLiked = false;
        } else {
            // Like
            items.unshift({
                entityId,
                userId,
                type,
                title: metadata.title,
                subtitle: metadata.subtitle,
                coverUrl: metadata.coverUrl,
                addedAt: Date.now()
            });
            isLiked = true;
        }

        localStorage.setItem(key, JSON.stringify(items));
        return isLiked;
    },

    /**
     * Checks if an item is currently liked.
     */
    checkIsLiked: (userId: string, type: 'artist' | 'album' | 'track', entityId: string): boolean => {
        const key = getStorageKey(userId, type);
        const stored = localStorage.getItem(key);
        if (!stored) return false;
        
        const items: LikedItem[] = JSON.parse(stored);
        return items.some(i => i.entityId === entityId);
    },

    /**
     * Fetches the preview list (top 9 recent) for the widgets.
     */
    getLikedPreview: async (userId: string, type: 'artist' | 'album' | 'track') => {
        const key = getStorageKey(userId, type);
        const stored = localStorage.getItem(key);
        const items: LikedItem[] = stored ? JSON.parse(stored) : [];

        // Sort by recency (just in case)
        items.sort((a, b) => b.addedAt - a.addedAt);

        return {
            total: items.length,
            preview: items.slice(0, 9)
        };
    },

    /**
     * Fetch all liked items for a specific type (Pagination simulated)
     */
    getAllLiked: async (userId: string, type: 'artist' | 'album' | 'track') => {
        const key = getStorageKey(userId, type);
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) as LikedItem[] : [];
    }
};
