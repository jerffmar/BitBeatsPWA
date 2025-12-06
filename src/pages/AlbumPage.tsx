import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Heart, Clock, Cloud, CheckCircle, Share2, MoreHorizontal, Loader, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Track } from '../types';
import { lookupRelease, MBReleaseDetail, searchRecordings } from '../services/musicBrainz';
import { createBounty, publishTrackMetadata } from '../services/db';
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

  // NEW: identification UI state
  const [identifying, setIdentifying] = useState<Record<string, boolean>>({});
  const [candidates, setCandidates] = useState<Record<string, any[]>>({});
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [applying, setApplying] = useState<Record<string, boolean>>({});

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

          if (!best || score < best.score) {
            best = { track: t, score };
          }
      }
      return best.track;
  };

  // NEW: run MusicBrainz search for a specific track (manual identify)
  const handleIdentifyClick = async (trackTitle: string) => {
    if (!album) return;
    const key = trackTitle;
    setIdentifying(prev => ({ ...prev, [key]: true }));
    try {
      const results = await searchRecordings(trackTitle, album.artist);
      setCandidates(prev => ({ ...prev, [key]: results || [] }));
      setExpandedTrackId(key);
    } catch (err) {
      console.error('[AlbumPage] manual identify failed', err);
      setCandidates(prev => ({ ...prev, [key]: [] }));
      setExpandedTrackId(key);
    } finally {
      setIdentifying(prev => ({ ...prev, [key]: false }));
    }
  };

  // NEW: apply selected MB candidate and publish metadata (also archived on relay)
  const handleApplyCandidate = async (origTrackId: string, candidate: any) => {
    const key = origTrackId;
    setApplying(prev => ({ ...prev, [key]: true }));
    try {
      const meta: Partial<Track> = {
        mbid: candidate.id,
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.release || candidate.album || album?.title || '',
        coverUrl: candidate.coverUrl || album?.coverUrl || '',
        duration: candidate.length || 0,
        audioUrl: candidate.magnet || '', // if unknown leave blank (metadata-only)
        license: 'CC-BY',
        size: 0,
        tags: ['identified', 'manual'],
        networkHealth: 0
      };
      await publishTrackMetadata(meta);
      alert('Metadata published to swarm and archived on relay.');
      // update local mbMatches cache so fuzzy matching uses canonical title next
      setMbMatches(m => ({ ...m, [origTrackId]: { title: candidate.title, artist: candidate.artist, id: candidate.id, score: candidate.score } }));
      setExpandedTrackId(null);
    } catch (err) {
      console.error('[AlbumPage] apply candidate failed', err);
      alert('Failed to publish metadata. See console.');
    } finally {
      setApplying(prev => ({ ...prev, [key]: false }));
    }
  };

  // Install helper (uses global deferred prompt if App captured it)
  const handleInstall = () => {
    const promptEvent = (window as any).__bb_deferred;
    if (promptEvent) {
      promptEvent.prompt();
      promptEvent.userChoice.then((choice: any) => {
        if (choice.outcome === 'accepted') {
          alert('Thanks! App installed.');
        } else {
          alert('Install dismissed.');
        }
        (window as any).__bb_deferred = undefined;
      }).catch(() => {
        alert('Install prompt failed. Try using browser menu > Add to Home screen.');
      });
    } else {
      // Fallback message/instructions
      alert('To install BitBeats: open your browser menu and choose "Add to Home screen" (Android Chrome) or use the Share / Add to Home Screen option.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin text-white" size={48} />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="px-4 py-8 text-center">
        <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
        <h1 className="text-2xl font-bold text-white mb-2">Album Not Found</h1>
        <p className="text-gray-400">We couldn't find the album you're looking for.</p>
        <Link to="/" className="mt-4 inline-block text-brand-500 hover:underline">
          Browse All Albums
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-dark-bg min-h-full pb-20 overflow-x-hidden font-sans">
      {/* --- HEADER / ARTIST NAV --- */}
      <div className="px-4 md:px-8 py-6 border-b border-white/5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          {/* Album Art & Info */}
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden">
              <CoverImage src={album.coverUrl} alt={album.title} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-400 mb-1">
                {album.artist}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
                {album.title}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-[10px] text-gray-500 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                  <Clock size={12} className="text-gray-400" />
                  {Math.floor((album.duration || 0) / 60)}:{((album.duration || 0) % 60).toString().padStart(2, '0')} minutes
                </div>
                {userId && (
                  <div className="ml-auto">
                    <LikeButton
                      userId={userId}
                      entityId={id}
                      entityType="album"
                      metadata={{
                        title: album.title,
                        subtitle: album.artist,
                        coverUrl: album.coverUrl
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- DESCRIPTION / ACTIONS --- */}
      <div className="px-4 md:px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Description / Notes */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-sm font-bold text-gray-300 mb-2">Description</div>
          <div className="text-sm text-white whitespace-pre-line">
            {album.notes || 'No description available.'}
          </div>
        </div>

        {/* Actions (Download / Share) */}
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-sm font-bold text-gray-300 mb-2">Actions</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={album.magnet}
              download
              className="flex items-center justify-center gap-2 text-sm bg-brand-500 text-black px-3 py-2 rounded-lg font-semibold hover:bg-brand-600 transition-colors w-full sm:w-auto"
            >
              <Cloud size={14} /> Download Album
            </a>
            <button className="flex items-center justify-center gap-2 text-sm bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10">
              <Share2 size={14} /> Share Album
            </button>
            {/* Install App button (mobile CTA) */}
            <button
              onClick={handleInstall}
              className="flex items-center justify-center gap-2 text-sm bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-lg border border-white/10"
            >
              Install App
            </button>
          </div>
        </div>
      </div>

      {/* --- TRACKLIST --- */}
      <div className="px-4 md:px-8">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 text-xs font-bold text-gray-500 uppercase px-4 py-2 border-b border-white/5 mb-2">
          <div className="w-8 text-center">#</div>
          <div>Title</div>
          <div className="hidden md:block">Action</div>
          <div className="w-12 text-right"><Clock size={14} className="inline" /></div>
        </div>

        <div className="space-y-1">
          {album.tracks.map((track) => {
            const swarmMatch = getSwarmMatch(track.title);
            const active = swarmMatch && currentTrackId === swarmMatch.id;
            const isPlayable = !!swarmMatch;
            const key = track.id;

            return (
              <React.Fragment key={track.id}>
                <div
                  onClick={() => { if (isPlayable && swarmMatch) onPlay(swarmMatch); }}
                  className={clsx(
                    "group grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-3 rounded-lg transition-colors",
                    active ? "bg-white/10" : "hover:bg-white/5",
                    isPlayable ? "cursor-pointer" : "opacity-70 cursor-default"
                  )}
                >
                  {/* Index / Play Icon */}
                  <div className="w-8 text-center text-sm font-medium text-gray-400 relative">
                    <span className={clsx("group-hover:hidden", active && "text-brand-500")}>
                      {active && isPlaying ? <div className="w-3 h-3 mx-auto bg-brand-500 rounded-full animate-pulse" /> : track.position}
                    </span>
                    {isPlayable ? (
                      <Play size={14} className="hidden group-hover:block mx-auto text-white" fill="currentColor" />
                    ) : (
                      <span className="hidden group-hover:block mx-auto text-gray-600">-</span>
                    )}
                  </div>

                  {/* Title & Icons */}
                  <div className="min-w-0 pr-4 flex items-center gap-3">
                    <div className="min-w-0">
                      <div className={clsx("font-medium truncate text-base", active ? "text-brand-400" : "text-white")}>
                        {track.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isPlayable ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-500 bg-green-500/10 px-1.5 rounded border border-green-500/20">
                            <CheckCircle size={10} /> Available in Swarm
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-white/5 px-1.5 rounded border border-white/10">
                            Not Cached
                          </span>
                        )}
                      </div>
                    </div>
                    {userId && isPlayable && swarmMatch && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                        <LikeButton
                          userId={userId}
                          entityId={swarmMatch.id}
                          entityType="track"
                          metadata={{
                            title: swarmMatch.title,
                            subtitle: swarmMatch.artist,
                            coverUrl: swarmMatch.coverUrl
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="hidden md:block text-sm flex items-center gap-2">
                    {!isPlayable && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRequest(track.title, track.artist); }}
                          className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 text-brand-500 px-2 py-1 rounded border border-brand-500/20"
                        >
                          <Cloud size={10} /> Request Bounty
                        </button>

                        {/* Identify button for manual MB lookup */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleIdentifyClick(track.title); }}
                          className="flex items-center gap-1 text-xs bg-white/5 hover:bg-white/10 text-white px-2 py-1 rounded border border-white/10"
                        >
                          {identifying[track.title] ? 'Searching...' : 'Identify'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="w-12 text-right text-sm text-gray-500 font-mono">
                    {Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}
                  </div>
                </div>

                {/* Expanded candidate panel (manual identification) */}
                {expandedTrackId === track.title && (
                  <div className="px-6 md:px-8">
                    <div className="bg-white/5 border border-white/5 rounded-lg p-3 mt-2 mb-3">
                      <div className="text-sm font-bold mb-2">Candidate Matches for “{track.title}”</div>
                      {(!candidates[track.title] || candidates[track.title].length === 0) && (
                        <div className="text-gray-400 text-sm">No candidates found.</div>
                      )}
                      <div className="space-y-2">
                        {candidates[track.title]?.map((cand: any) => (
                          <div key={cand.id || cand.title} className="flex items-center justify-between bg-dark-highlight p-2 rounded">
                            <div>
                              <div className="text-sm font-medium">{cand.title} <span className="text-xs text-gray-400">— {cand.artist}</span></div>
                              <div className="text-xs text-gray-500">{cand.release || cand.album} {cand.score ? `• score ${cand.score}` : ''}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApplyCandidate(track.id, cand)}
                                disabled={applying[track.id]}
                                className="text-xs bg-brand-500 text-black px-3 py-1 rounded font-bold"
                              >
                                {applying[track.id] ? 'Applying...' : 'Use this Match'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-right">
                        <button onClick={() => setExpandedTrackId(null)} className="text-xs text-gray-400 hover:text-white">Close</button>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
