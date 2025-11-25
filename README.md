
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
- **Listen Parties:** Synchronized playback rooms.
- **LAN Sync:** Discovery of peers on the local network to save internet bandwidth.

### 4. Creator Studio
- **Identity:** Ed25519 cryptographic identity management.
- **Direct Upload:** Artists sign their tracks; no middlemen.

## 🛠 Technical Stack
- **Frontend:** React 18+, Vite, TypeScript
- **Styling:** Tailwind CSS (Dark Mode optimized)
- **Storage:** Native File System Access API (OPFS)
- **Networking:** Gun.js (Decentralized DB), Simulated WebTorrent
- **Icons:** Lucide React

## 🚀 Roadmap & To-Do Goals

### Phase 1: Networking (In Progress)
- [x] **Decentralized DB:** Integrated **Gun.js** for real-time, peer-to-peer chat ("Swarm Chatter").
- [ ] **WebTorrent Integration:** Replace the simulation loop in `App.tsx` with actual WebRTC data channels and torrent protocol.
- [ ] **Signaling Server:** Deploy a lightweight WebSocket tracker for initial peer discovery.

### Phase 2: Audio Engine
- [ ] **Audio Fingerprinting:** Integrate Chromaprint/AcoustID (via WASM) to verify files match the metadata and prevent duplicate uploads.
- [ ] **Transcoding:** Client-side FFmpeg (WASM) to normalize audio formats before seeding.
- [ ] **Streaming Range Requests:** Optimize the OPFS reader to support HTTP Range requests for instant seeking in large files.

### Phase 3: Cryptography & Security
- [ ] **Real Signatures:** Implement `libsodium-wrappers` for actual Ed25519 signing of uploads.
- [ ] **Content Encryption:** Allow for private sharing/encrypted blobs for exclusive content.

### Phase 4: Platform
- [ ] **Mobile Wrapper:** Wrap using Capacitor or Trusted Web Activities (TWA) to enable background audio support on iOS/Android (currently limited by browser PWA restrictions).
- [ ] **Desktop Node:** Electron build for power users to run "Archive Nodes" with massive storage allowances.

## 📦 Installation

```bash
npm install
npm run dev
```

## 📄 License
MIT
