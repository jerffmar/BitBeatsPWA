// Console test for fuzzy matching fallback in identificationService

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`❌ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${msg}`);
  }
};

// Mock global fetch for MusicBrainz recording search used in fuzzy flow
globalThis.fetch = async (url, opts = {}) => {
  if (typeof url === 'string' && url.includes('musicbrainz.org/ws/2/recording')) {
    // Return multiple candidates to exercise the scoring and release selection
    return {
      ok: true,
      status: 200,
      json: async () => ({
        recordings: [
          {
            id: 'mb-rec-best',
            title: 'Midnight City',
            length: 243000,
            'artist-credit': [{ name: 'M83' }],
            releases: [
              { id: 'rel-198', title: "Hurry Up, We're Dreaming", date: '2011-10-18', status: 'Official', 'release-group': { 'primary-type': 'Album' } }
            ],
            score: 98
          },
          {
            id: 'mb-rec-alt',
            title: 'Midnight City (Live)',
            length: 260000,
            'artist-credit': [{ name: 'M83' }],
            releases: [
              { id: 'rel-live', title: 'Live in Paris', date: '2012-06-01', status: 'Official', 'release-group': { 'primary-type': 'Album', 'secondary-types': ['Live'] } }
            ],
            score: 80
          }
        ]
      })
    };
  }
  // Default mock
  return { ok: false, status: 404, json: async () => ({}) };
};

(async () => {
  // Import the fuzzy identification flow
  const { identifyAudioFile } = await import('../services/identificationService.ts');

  // Create a fake audio file name that should match "M83 - Midnight City"
  const fakeFile = new File(['dummy'], 'M83 - Midnight City.mp3', { type: 'audio/mpeg' });

  // Drive the service directly to fuzzy (skip fingerprint by making fpcalc import fail)
  // The service already falls back to fuzzy if fpcalc-browser import errors.

  try {
    const result = await identifyAudioFile(fakeFile, (status) => {
      console.log(`status: ${status}`);
    });

    assert(!!result, 'Fuzzy identification returns a result');
    assert(result.title === 'Midnight City', 'Matched title');
    assert(result.artist === 'M83', 'Matched artist');
    assert(result.album === "Hurry Up, We're Dreaming", 'Selected best release album');
    assert(result.year === '2011', 'Extracted release year');
    assert(result.score > 0.4, 'Confidence above threshold');

  } catch (e) {
    console.error('Fuzzy test error:', e);
    process.exitCode = 1;
  }

  if (process.exitCode === 1) {
    console.error('❌ Fuzzy matching test failed');
    process.exit(1);
  } else {
    console.log('🎉 Fuzzy matching test passed');
  }
})();
