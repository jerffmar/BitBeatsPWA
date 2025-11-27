// Minimal test harness for critical features

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${msg}`);
  }
};

// --- Mock global fetch for services that use it ---
globalThis.fetch = async (url, opts = {}) => {
  // Simple router for identification.ts server endpoints
  if (typeof url === 'string' && url.startsWith('/api/search')) {
    return {
      ok: true,
      json: async () => ({
        songs: [
          { mbid: 'rec-123', title: 'Test Song', artist: 'Test Artist', album: 'Test Album', year: '2020', coverUrl: 'https://example.com/cover.jpg' }
        ]
      })
    };
  }
  if (typeof url === 'string' && url.startsWith('/api/recording/')) {
    return {
      ok: true,
      json: async () => ({
        mbid: 'rec-123',
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        year: '2020',
        coverUrl: 'https://example.com/cover.jpg',
        tags: ['electronic', 'indie']
      })
    };
  }
  // musicBrainz service tests: return a minimal recording search payload
  if (typeof url === 'string' && url.includes('musicbrainz.org/ws/2/recording')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        recordings: [
          {
            id: 'mb-rec-1',
            score: 95,
            title: 'Alpha',
            length: 180000,
            'artist-credit': [{ name: 'Artist A' }],
            releases: [{ id: 'rel-1', title: 'Album A', date: '2019-01-01' }]
          }
        ]
      })
    };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

(async () => {
  // Import ESM TypeScript via transpiled JS if present; fallback to ts-node-like dynamic using Vite paths.
  // We rely on Node's ESM resolution with TS compiled by Vite build in CI; for local runs, dynamic import of TS works in Node 22.
  const p2p = await import('../services/p2pNetwork.ts');
  const idSvc = await import('../services/identification.ts');
  const mb = await import('../services/musicBrainz.ts');

  // --- Test: Reputation logic ---
  try {
    const rep1 = p2p.getReputation(0.1, 0);
    assert(rep1 === 'Leecher', 'getReputation: ratio 0.1 -> Leecher');

    const rep2 = p2p.getReputation(0.8, 0);
    assert(rep2 === 'Member', 'getReputation: ratio 0.8 -> Member');

    const rep3 = p2p.getReputation(1.2, 2 * 1024 * 1024 * 1024);
    assert(rep3 === 'Archivist', 'getReputation: ratio >=1 and uploads >1GB -> Archivist');

    const rep4 = p2p.getReputation(2.1, 0);
    assert(rep4 === 'Gold Seeder', 'getReputation: ratio >=2 -> Gold Seeder');

    const rep5 = p2p.getReputation(1.5, 10);
    assert(rep5 === 'Seeder', 'getReputation: default -> Seeder');
  } catch (e) {
    console.error('Reputation test error:', e);
    process.exitCode = 1;
  }

  // --- Test: Identification service (server-backed) ---
  try {
    const details = await idSvc.identifyTrack('Test_Artist - Test_Song.mp3', 180, 'fp_mock');
    assert(!!details, 'identifyTrack: returns details');
    assert(details.title === 'Test Song', 'identifyTrack: title resolved');
    assert(details.artist === 'Test Artist', 'identifyTrack: artist resolved');
    assert(details.album === 'Test Album', 'identifyTrack: album resolved');
  } catch (e) {
    console.error('Identification service test error:', e);
    process.exitCode = 1;
  }

  // --- Test: MusicBrainz searchRecordings mapping ---
  try {
    const recs = await mb.searchRecordings('Alpha', 'Artist A');
    assert(Array.isArray(recs) && recs.length === 1, 'searchRecordings: returns one mapped recording');
    assert(recs[0].id === 'mb-rec-1', 'searchRecordings: preserves recording id');
    assert(recs[0].artist === 'Artist A', 'searchRecordings: maps artist-credit');
    assert(recs[0].album === 'Album A', 'searchRecordings: maps album from releases');
    assert(recs[0].year === '2019', 'searchRecordings: maps year from release date');
  } catch (e) {
    console.error('MusicBrainz service test error:', e);
    process.exitCode = 1;
  }

  if (process.exitCode === 1) {
    console.error('❌ Critical tests failed');
    process.exit(1);
  } else {
    console.log('🎉 All critical tests passed');
  }
})();
