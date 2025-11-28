# BitBeats

**Decentralized, Duty-Free Audio Streaming**

BitBeats is a Proof-of-Concept (PoC) Progressive Web App (PWA) demonstrating a decentralized music streaming architecture. It shifts the paradigm from "Rent-to-Listen" (Subscription models) to "Seed-to-Stream," where users earn bandwidth credits by hosting content for the community.

## 🌟 Core Features

### 1. Offline-First "Vault" Architecture
- **OPFS (Origin Private File System):** Unlike standard caching, content is persisted locally in a high-performance, sandboxed file system (`services/storage.ts`).
- **Smart Eviction:** An intelligent storage manager that automatically frees space based on a custom algorithm:
  - **Rarity:** Preserves files that have low network availability (Keep the rare stuff alive).
  - **Recency:** Deletes common files that haven't been played recently (LRU).

### 2. P2P Economy & Gamification
- **Ratio System:** Users are ranked (Leecher → Gold Seeder) based on their upload/download ratio.
- **Bounty Board:** Users can spend earned credits to request rare tracks. Seeders who fulfill requests earn the bounty.
- **Network Health:** Visual indicators showing how "rare" or "common" a track is in the swarm.

### 3. Smart Metadata Matching (New)
- **Hybrid Identification Flow:** Combines Client-Side Fingerprinting (`fpcalc-browser`) with a robust fuzzy matcher fallback.
- **Algorithm:** Uses **Levenshtein Distance** to fuzzy match filenames against the **MusicBrainz** global database.
- **Weighted Scoring:** Calculates confidence scores based on Title (40%), Artist (30%), and Duration (30%) similarity.
- **Real-time Lookup:** Fetches metadata directly from MusicBrainz API (Lucene) and AcoustID without relying on static mocks.

### 4. Social Swarm (Self-Hosted Mesh)
- **Local Mesh Bus:** Chats, bounties, parties, and metadata replicate via an in-browser mesh built on `BroadcastChannel` + durable storage, so no third-party relays are required.
- **Offline-Ready Auth:** Credentials are salted/hashed locally with Web Crypto and never leave the device, enabling air-gapped demos.

### 5. Creator Studio
- **Audio Processing Engine:** Client-side analysis and normalization.
- **Fingerprinting:** Unique content IDs generated from audio data to prevent duplicates.
- **Normalization:** Audio is automatically normalized to -1dB before seeding.

## 🛠 Technical Stack
- **Frontend:** React 18+, Vite, TypeScript
- **Styling:** Tailwind CSS (Dark Mode optimized)
- **Storage:** Native File System Access API (OPFS)
- **Networking:** Local Mesh Bus (BroadcastChannel + persistent storage), WebTorrent (WebRTC P2P)
- **Metadata:** MusicBrainz API, Levenshtein Algorithm

## 🚀 Roadmap & To-Do Goals

### Phase 1: Networking (Completed)
- [x] **Decentralized DB:** Integrated **Gun.js** for real-time, peer-to-peer chat ("Swarm Chatter").
- [x] **WebTorrent Integration:** Replaced simulation with **WebTorrent** library. The app now supports Magnet URIs.
- [x] **Signaling Server:** Configured to use public WebSocket trackers (OpenWebTorrent, etc.).

### Phase 2: Audio Engine (Completed)
- [x] **Audio Fingerprinting:** Implemented client-side audio buffer analysis to generate unique content signatures (`services/audioEngine.ts`).
- [x] **Transcoding:** Implemented `normalizeAndTranscode` using the Web Audio API to standardize uploads to WAV/WebM.
- [x] **Streaming Optimization:** Updated playback engine to stream directly from Torrent blobs or OPFS blobs.

### Phase 3: De-Mocking & Real Implementation (Completed)
- [x] **Smart Metadata Matcher:** Implemented robust file identification using MusicBrainz and fuzzy string matching (`services/metadataMatcher.ts`), replacing mock fingerprinting services.
- [x] **Remove `MOCK_TRACKS`:** Populated Discovery view entirely from DHT/Tracker infoHashes and MusicBrainz cross-referencing.
- [x] **Remove Auth Mocks:** Replaced `services/auth.ts` (localStorage simulation) with **Gun.js SEA** (User.auth) for true cryptographic identity.
- [x] **Remove `MOCK_BOUNTIES`:** Implemented a real decentralized ledger in Gun.js for creating and fulfilling bounties.
- [x] **Remove `MOCK_PARTIES`:** Replaced simulated parties with real-time Gun.js presence/room sync.
- [x] **Remove `MOCK_POSTS`:** Ensured the social feed pulls 100% of history from the mesh network.
- [x] **Remove `discoverLocalPeers`:** Implemented actual Mesh peer discovery using Gun.js internal peer list.
- [x] **Remove `signUpload`:** Replaced simulated delay with actual Ed25519 content signing logic using `Gun.SEA`.
- [x] **Remove Identification Mocks:** Replaced simulated AcoustID checks with real API calls and fallback fuzzy logic (`services/identificationService.ts`).

### Phase 4: Platform (Future)
- [ ] **Mobile Wrapper:** Wrap using Capacitor or Trusted Web Activities (TWA) to enable background audio support on iOS/Android.
- [ ] **Desktop Node:** Electron build for power users to run "Archive Nodes" with massive storage allowances.
- [ ] **Content Encryption:** Allow for private sharing/encrypted blobs for exclusive content.

## 📦 Installation

```bash
npm install
npm run dev
```

**Note:** The `fpcalc-browser` package requires WASM support. Ensure your dev server serves `.wasm` files with the correct MIME type.

## 📄 License
MIT

### Server-Side Fingerprinting

- Install `libchromaprint-tools` (already baked into `setup.sh`) so the backend can invoke `fpcalc`.
- POST raw audio via `multipart/form-data` to `/api/identify/upload` (field name `file`) and the server will:
  1. Run `fpcalc` to extract the Chromaprint fingerprint.
  2. Resolve metadata via AcoustID/MusicBrainz using the shared cache.
  3. Return the normalized metadata payload used throughout the app.

This removes the need for the browser to ship heavy WASM binaries while keeping fingerprint identification mandatory.

## 🗄 Server-Side Storage & Seeding

- Each user can upload up to **15GB** of audio files.
- Uploaded files are stored server-side and seeded via WebTorrent using all trackers in `trackers.txt`.
- Files are deleted after **90 days** unless re-uploaded or renewed by any user.
- If multiple users upload the same file (by fingerprint/hash), the expiry is renewed and all uploaders are tracked.
- Deduplication ensures only one copy of each unique file is stored and seeded.