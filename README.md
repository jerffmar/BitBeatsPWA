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

### 4. Social Swarm (Powered by Gun.js)
- **Decentralized Chat:** Swarm Chatter is now powered by **Gun.js**, a distributed graph database. Messages are propagated peer-to-peer without a central API server.
- **Listen Parties:** Synchronized playback rooms powered by real-time graph updates.
- **LAN Sync:** Discovery of peers on the local network mesh to save internet bandwidth.

### 5. Creator Studio
- **Audio Processing Engine:** Client-side analysis and normalization.
- **Fingerprinting:** Unique content IDs generated from audio data to prevent duplicates.
- **Normalization:** Audio is automatically normalized to -1dB before seeding.

## 🛠 Technical Stack
- **Frontend:** React 18+, Vite, TypeScript
- **Styling:** Tailwind CSS (Dark Mode optimized)
- **Storage:** Native File System Access API (OPFS)
- **Networking:** Gun.js (Decentralized DB), WebTorrent (WebRTC P2P)
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

## 🔌 Gun Relay Reliability
- Default peers now include `/gun` and auto-detect a same-origin relay at `<your-domain>/gun` (for you: `https://bitbeats-hcx1.onrender.com/gun`).
- To point at your own relay, set `VITE_GUN_PEERS` (comma-separated):
  - Example: `VITE_GUN_PEERS=https://bitbeats-hcx1.onrender.com/gun`
- Run your own relay (local or server): `PORT=8765 npm run relay` (Gun will serve WebSockets at `/gun`).
- If deploying behind a reverse proxy (e.g., Nginx/Render), proxy `/gun` to the relay process and forward WebSocket upgrade headers.

## 🖥️ Single-Server Setup (Frontend + API + Gun Relay)
- This repo runs all services on one host.
- Relay: `npm run relay` (or PM2) binds to `/gun` (default port 8765). Nginx proxies `/gun -> 127.0.0.1:8765/gun`.
- API: `npm start` serves Express on `PORT` (default 3001) with SPA fallback from `dist`.
- Frontend: `npm run build` outputs `dist`, served by Nginx root.
- Override peers via `VITE_GUN_PEERS` if you host a different relay.
- Ensure WebSockets are enabled on your proxy (Upgrade/Connection headers forwarded).