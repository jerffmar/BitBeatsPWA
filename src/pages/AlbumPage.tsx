import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Heart, Clock, Cloud, CheckCircle, Share2, MoreHorizontal, Loader, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Track } from '../types';
import { lookupRelease, MBReleaseDetail, searchRecordings } from '../services/musicBrainz';
import { createBounty } from '../services/db';
import { LikeButton } from '../components/LikeButton';
import { getSession } from '../services/auth';
import { CoverImage } from '../components/ui/CoverImage';

interface AlbumPageProps {
  onPlay: (track: Track) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  swarmTracks: Track[]; // Injected to check for availability
}

export const AlbumPage: React.FC<AlbumPageProps> = ({ onPlay, currentTrackId, isPlaying, swarmTracks }) => {
  const { id } = useParams();
  const [album, setAlbum] = useState<MBReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [mbMatches, setMbMatches] = useState<Record<string, { title: string; artist?: string; id?: string; score?: number }>>({});

  useEffect(() => {
    getSession().then(user => {
        if (user) setUserId(user.id);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    lookupRelease(id).then(data => {
        setAlbum(data);
        setLoading(false);
    });
  }, [id]);

  // After album loads, query MusicBrainz for each track to get canonical metadata candidates
  useEffect(() => {
    if (!album) return;
    let active = true;
    (async () => {
      const map: Record<string, any> = {};
      for (const t of album.tracks) {
        try {
          const results = await searchRecordings(t.title, album.artist);
          if (!active) return;
          if (results && results.length) {
            // pick best by score/duration similarity if available
            const best = results[0];
            map[t.title] = { title: best.title, artist: best.artist, id: best.id, score: best.score };
          }
        } catch (err) {
          // ignore per-track errors
          console.debug('[AlbumPage] MB lookup failed for', t.title, err);
        }
      }
      if (active) setMbMatches(map);
    })();
    return () => { active = false; };
  }, [album]);

  const handleRequest = (trackTitle: string, trackArtist: string) => {
      // Create Bounty
      createBounty(id, `${trackArtist} - ${trackTitle}`, 50);
      alert(`Requested "${trackTitle}"!`);
  };

  // Replace the previous strict match with a tolerant fuzzy matcher
  const normalize = (s?: string) => {
    if (!s) return '';
    return s.toLowerCase()
            .normalize('NFKD') // normalize accents
            .replace(/[\u0300-\u036f]/g, '') // remove diacritics
            .replace(/[^a-z0-9\s]/g, ' ') // remove punctuation
            .replace(/\s+/g, ' ')
            .trim();
  };

  const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const v0 = new Array(bl + 1).fill(0);
    const v1 = new Array(bl + 1).fill(0);
    for (let j = 0; j <= bl; j++) v0[j] = j;
    for (let i = 0; i < al; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < bl; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= bl; j++) v0[j] = v1[j];
    }
    return v1[bl];
  };

  const getSwarmMatch = (trackTitle: string, trackArtist?: string) => {
      // Loose/fuzzy match for availability using normalization + Levenshtein and MusicBrainz candidate
      const targetTitle = normalize(trackTitle);
      const targetArtist = normalize(trackArtist || album?.artist || '');

      // incorporate MB candidate (if present) as an alternate canonical title
      const mbCandidate = mbMatches[trackTitle];
      const mbTitle = mbCandidate ? normalize(mbCandidate.title) : '';

      if (!targetTitle && !mbTitle) return undefined;

      // 1) Exact or strong substring matches first (including MB candidate)
      for (const t of swarmTracks) {
          const sTitle = normalize(t.title);
          const sArtist = normalize(t.artist);
          if (
             (sTitle === targetTitle || (mbTitle && sTitle === mbTitle)) &&
             (targetArtist === '' || sArtist === targetArtist)
          ) return t;
          if (
             (sTitle.includes(targetTitle) || (mbTitle && sTitle.includes(mbTitle))) &&
             (targetArtist === '' || sArtist.includes(targetArtist))
          ) return t;
      }

      // 2) Compute best fuzzy candidate (same as before, but prefer matches that match MB candidate)
      let best: { track: Track; score: number } | null = null;
      for (const t of swarmTracks) {
          const sTitle = normalize(t.title);
          const sArtist = normalize(t.artist);

          // measure distance against both original title and MB canonical title (if present)
          const titleDist = mbTitle
            ? Math.min(levenshtein(targetTitle, sTitle), levenshtein(mbTitle, sTitle))
            : levenshtein(targetTitle, sTitle);

          const maxLen = Math.max((mbTitle ? Math.max(targetTitle.length, mbTitle.length) : targetTitle.length), sTitle.length) || 1;
          const titleRatio = titleDist / maxLen;

          let artistRatio = 1;
          if (targetArtist) {
            const artistDist = levenshtein(targetArtist, sArtist);
            const maxA = Math.max(targetArtist.length, sArtist.length) || 1;
            artistRatio = artistDist / maxA;
          }

          const score = (titleRatio * 0.7) + (artistRatio * 0.3);

          if
