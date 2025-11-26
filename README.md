
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

### 3. Social Swarm (Powered by Gun.js)
- **Decentralized Chat:** Swarm Chatter is now powered by **Gun.js**, a distributed graph database. Messages are propagated peer-to-peer without a central API server.
- **Listen Parties:** Synchronized playback rooms powered by real-time graph updates.
- **LAN Sync:** Discovery of peers on the local network mesh to save internet bandwidth.

### 4. Creator Studio
- **Audio Processing Engine:** Client-side analysis and normalization.
- **Fingerprinting:** Unique content IDs generated from audio data to prevent duplicates.
- **Normalization:** Audio is automatically normalized to -1dB before seeding.

## 🛠 Technical Stack
- **Frontend:** React 18+, Vite, TypeScript
- **Styling:** Tailwind CSS (Dark Mode optimized)
- **Storage:** Native File System Access API (OPFS)
- **Networking:** Gun.js (Decentralized DB), WebTorrent (WebRTC P2P)
- **Audio Engine:** Web Audio API (OfflineAudioContext)

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
- [x] **Remove `MOCK_TRACKS`:** Populated Discovery view entirely from DHT/Tracker infoHashes and MusicBrainz cross-referencing.
- [x] **Remove Auth Mocks:** Replaced `services/auth.ts` (localStorage simulation) with **Gun.js SEA** (User.auth) for true cryptographic identity.
- [x] **Remove `MOCK_BOUNTIES`:** Implemented a real decentralized ledger in Gun.js for creating and fulfilling bounties.
- [x] **Remove `MOCK_PARTIES`:** Replaced simulated parties with real-time Gun.js presence/room sync.
- [x] **Remove `MOCK_POSTS`:** Ensured the social feed pulls 100% of history from the mesh network.
- [x] **Remove `discoverLocalPeers`:** Implemented actual Mesh peer discovery using Gun.js internal peer list.
- [x] **Remove `signUpload`:** Replaced simulated delay with actual Ed25519 content signing logic using `Gun.SEA`.
- [x] **Remove Mock Credits:** Implemented a basic graph node for tracking User Credits.

### Phase 4: Platform (Future)
- [ ] **Mobile Wrapper:** Wrap using Capacitor or Trusted Web Activities (TWA) to enable background audio support on iOS/Android.
- [ ] **Desktop Node:** Electron build for power users to run "Archive Nodes" with massive storage allowances.
- [ ] **Content Encryption:** Allow for private sharing/encrypted blobs for exclusive content.

## 📦 Installation

```bash
npm install
npm run dev
```

## 📄 License
MIT
