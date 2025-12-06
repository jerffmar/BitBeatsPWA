#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/bitbeats"
REPO_URL="${REPO_URL:-https://github.com/jerffmar/bitbeatspwa.git}"
DB_USER="bitbeats_user"
DB_PASS="bitbeats_secure_password"
DB_NAME="bitbeats_db"
NODE_PORT=3001
NGINX_PORT=80

log(){ echo -e "\033[0;32m[$(date +'%H:%M:%S')] $1\033[0m"; }
warn(){ echo -e "\033[1;33m[WARN] $1\033[0m"; }
err(){ echo -e "\033[0;31m[ERR] $1\033[0m"; exit 1; }

log "1) Updating system and installing dependencies..."
sudo apt-get update -y
sudo apt-get install -y curl git ufw nginx postgresql postgresql-contrib build-essential

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null || echo v0)" != v22* ]]; then
  log "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

log "Installing global tools (pm2, tsx)..."
sudo npm install -g pm2 tsx

log "2) Configuring PostgreSQL..."
sudo systemctl enable --now postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename='${DB_USER}'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "ALTER USER ${DB_USER} CREATEDB;"

log "3) Preparing application directory..."
if [ ! -d "${APP_DIR}" ]; then
  sudo mkdir -p "${APP_DIR}"
  sudo chown -R "$USER":"$USER" "${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
else
  cd "${APP_DIR}"
  git fetch origin
  git reset --hard origin/main
fi
cd "${APP_DIR}"

log "4) Self-correcting critical files..."

cat <<'EOF' > package.json
{
  "name": "bitbeats",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "tsx src/server/index.ts",
    "relay": "node scripts/gun-relay.mjs"
  },
  "dependencies": {
    "express": "^4.19.2",
    "serve": "^14.2.3",
    "@prisma/client": "5.22.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.3",
    "lucide-react": "^0.344.0",
    "framer-motion": "^11.0.8",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "gun": "^0.2020.1237"
  },
  "devDependencies": {
    "prisma": "5.22.0",
    "tsx": "^4.7.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.4",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.24"
  }
}
EOF

mkdir -p services
cat <<'EOF' > services/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Genre {
  id    String  @id @default(uuid())
  name  String  @unique
  slug  String  @unique
  artistGenres ArtistGenre[]
  albumGenres  AlbumGenre[]
  @@index([slug])
}

model ArtistGenre {
  artistId String
  genreId  String
  artist Artist @relation(fields: [artistId], references: [id], onDelete: Cascade)
  genre  Genre  @relation(fields: [genreId], references: [id], onDelete: Cascade)
  @@id([artistId, genreId])
  @@index([genreId])
}

model AlbumGenre {
  albumId String
  genreId String
  album Album @relation(fields: [albumId], references: [id], onDelete: Cascade)
  genre Genre @relation(fields: [genreId], references: [id], onDelete: Cascade)
  @@id([albumId, genreId])
  @@index([genreId])
}

model PlaybackHistory {
  id       String   @id @default(uuid())
  userId   String
  trackId  String
  playedAt DateTime @default(now())
  context  String?
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  track Track @relation(fields: [trackId], references: [id], onDelete: Cascade)
  @@index([userId, playedAt])
}

model UserLikedArtist {
  userId   String
  artistId String
  likedAt  DateTime @default(now())
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  artist Artist @relation(fields: [artistId], references: [id], onDelete: Cascade)
  @@id([userId, artistId])
  @@index([userId])
  @@index([artistId])
}

model UserLikedAlbum {
  userId  String
  albumId String
  likedAt DateTime @default(now())
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  album Album @relation(fields: [albumId], references: [id], onDelete: Cascade)
  @@id([userId, albumId])
  @@index([userId])
  @@index([albumId])
}

model UserLikedTrack {
  userId  String
  trackId String
  likedAt DateTime @default(now())
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  track Track @relation(fields: [trackId], references: [id], onDelete: Cascade)
  @@id([userId, trackId])
  @@index([userId])
  @@index([trackId])
}

model Artist {
  id        String   @id @default(uuid())
  mbId      String   @unique
  name      String
  tags      String[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  albums  Album[]
  genres  ArtistGenre[]
  likedBy UserLikedArtist[]
  @@index([mbId])
  @@index([name])
}

model Album {
  id          String    @id @default(uuid())
  mbId        String    @unique
  title       String
  releaseDate DateTime?
  coverUrl    String?
  artistId    String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  artist  Artist         @relation(fields: [artistId], references: [id], onDelete: Cascade)
  tracks  Track[]
  genres  AlbumGenre[]
  likedBy UserLikedAlbum[]
  @@index([mbId])
  @@index([artistId])
}

model Track {
  id        String   @id @default(uuid())
  mbId      String   @unique
  title     String
  duration  Int
  albumId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  album        Album              @relation(fields: [albumId], references: [id], onDelete: Cascade)
  fingerprints AudioFingerprint[]
  playbacks    PlaybackHistory[]
  likedBy      UserLikedTrack[]
  @@index([mbId])
  @@index([albumId])
}

model AudioFingerprint {
  id        String   @id @default(uuid())
  hash      String   @unique
  duration  Int
  trackId   String
  createdAt DateTime @default(now())
  track Track @relation(fields: [trackId], references: [id], onDelete: Cascade)
  @@index([hash])
  @@index([trackId])
}

model User {
  id String @id
  playbacks    PlaybackHistory[]
  likedArtists UserLikedArtist[]
  likedAlbums  UserLikedAlbum[]
  likedTracks  UserLikedTrack[]
}
EOF

rm -f prisma.config.ts

mkdir -p src/server
cat <<'EOF' > src/server/index.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { identifyHandler } from '../controllers/identifyController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API routes
app.post('/api/identify', identifyHandler);

// Placeholder /api routes (extend as needed)
app.get('/api/search', (_req, res) => res.json({ songs: [] }));
app.get('/api/recording/:mbid', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Static frontend
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
EOF

log "5) Generating .env..."
cat <<EOF > .env
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
PORT=${NODE_PORT}
EOF

log "6) Clean install & build..."
rm -rf node_modules package-lock.json
npm install
npx prisma generate --schema services/schema.prisma
npx prisma db push --schema services/schema.prisma
npm run build

log "7) Configure PM2..."
pm2 delete bitbeats-api 2>/dev/null || true
pm2 start src/server/index.ts --name bitbeats-api --interpreter="$(which node)" --node-args="--import tsx" --env production
pm2 save

log "8) Configure Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/bitbeats >/dev/null <<EOL
server {
    listen ${NGINX_PORT};
    server_name _;

    root ${APP_DIR}/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location /api {
        proxy_pass http://localhost:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOL
sudo ln -sfn /etc/nginx/sites-available/bitbeats /etc/nginx/sites-enabled/bitbeats
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

log "9) Configure UFW..."
sudo ufw allow ${NGINX_PORT}/tcp
sudo ufw allow 443/tcp
sudo ufw allow ssh
echo "y" | sudo ufw --force enable || true

log "✅ Deployment finished. Access app on port ${NGINX_PORT} (e.g., http://<server>:${NGINX_PORT})"