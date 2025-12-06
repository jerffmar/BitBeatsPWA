#!/bin/bash

# ==============================================================================
# BitBeats - Script de Deploy "All-in-One" (Corrigido)
# Ubuntu 24.04 LTS
# ==============================================================================

set -e # Encerra o script se houver erro crítico

# --- Variáveis de Configuração ---
APP_DIR="/var/www/bitbeats"
REPO_URL="https://github.com/jerffmar/bitbeatspwa.git"
DOMAIN="localhost" # Em produção, altere para seu domínio/IP
DB_USER="bitbeats_user"
DB_PASS="bitbeats_secure_password" # ALERTA: Altere em produção
DB_NAME="bitbeats_db"
NODE_PORT=3001

# Funções de Log
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[AVISO] $1${NC}"; }
error() { echo -e "${RED}[ERRO] $1${NC}"; exit 1; }

# ==============================================================================
# 1. Preparação do Sistema
# ==============================================================================
log "1. Atualizando sistema e instalando dependências..."
sudo apt-get update -y
sudo apt-get install -y curl git ufw build-essential nginx postgresql postgresql-contrib

# Instala Node.js 22 se não existir
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
    log "Instalando Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Instala PM2 e TSX globalmente
sudo npm install -g pm2 tsx

# ==============================================================================
# 2. Configuração do Banco de Dados
# ==============================================================================
log "2. Configurando PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Criação idempotente do usuário e banco
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 

# ==============================================================================
# 3. Setup do Repositório
# ==============================================================================
log "3. Configurando diretório da aplicação ($APP_DIR)..."

# Se o diretório existe mas está corrompido (sem .git), limpa
if [ -d "$APP_DIR" ] && [ ! -d "$APP_DIR/.git" ]; then
    warn "Diretório corrompido detectado. Limpando..."
    sudo rm -rf "$APP_DIR"
fi

if [ ! -d "$APP_DIR" ]; then
    log "Clonando repositório..."
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
    git clone "$REPO_URL" "$APP_DIR"
else
    cd "$APP_DIR"
    log "Atualizando código existente..."
    git fetch origin
    git reset --hard origin/main
fi

cd "$APP_DIR"

# ==============================================================================
# 4. Correção Automática de Arquivos (Autocorreção)
# ==============================================================================
log "4. Restaurando arquivos de configuração..."

# PACKAGE.JSON (Corrigido e formatado)
cat <<EOF > package.json
{
  "name": "bitbeats",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "tsx src/server/index.ts"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.3",
    "lucide-react": "^0.344.0",
    "framer-motion": "^11.0.8",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "serve": "^14.2.3",
    "express": "^4.19.2",
    "@prisma/client": "5.22.0"
  },
  "devDependencies": {
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.4",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.24",
    "prisma": "5.22.0",
    "tsx": "^4.7.1"
  }
}
EOF

# SCHEMA.PRISMA (Versão Limpa)
cat <<EOF > schema.prisma
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

# Remove configurações conflitantes
rm -f prisma.config.ts

# Gera .env
cat <<EOF > .env
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
PORT=$NODE_PORT
NODE_ENV=production
ACOUSTID_API_KEY="8XaBELgH"
EOF

# ==============================================================================
# 5. Instalação e Build
# ==============================================================================
log "5. Instalando dependências..."
# Remove instalações anteriores para evitar cache corrompido
rm -rf node_modules package-lock.json
npm install

log "Configurando Banco de Dados..."
npx prisma generate --schema=schema.prisma
npx prisma db push --schema=schema.prisma

log "Compilando Frontend..."
npm run build

# ==============================================================================
# 6. Backend Server (Entrypoint)
# ==============================================================================
log "6. Gerando servidor Express..."
mkdir -p src/server
cat <<EOF > src/server/index.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
// Importação ajustada para garantir compatibilidade
import { identifyHandler } from '../controllers/identifyController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API Routes
app.post('/api/identify', identifyHandler);

app.get('/api/search', (req, res) => { res.json({ songs: [] }); });
app.get('/api/recording/:mbid', (req, res) => { res.status(404).json({ error: "Not found" }); });

// Serve Frontend
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
});
EOF

# ==============================================================================
# 7. Processos e Proxy
# ==============================================================================
log "7. Iniciando Aplicação (Backend)..."
pm2 delete bitbeats-api 2>/dev/null || true

# COMANDO CORRIGIDO DO PM2:
# Usa --node-args para passar o import do TSX corretamente para o Node
pm2 start src/server/index.ts --name bitbeats-api --node-args="--import tsx" --env production
pm2 save

log "Configurando Nginx..."
sudo tee /etc/nginx/sites-available/bitbeats > /dev/null <<EOL
server {
    listen 80;
    server_name $DOMAIN;

    root $APP_DIR/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # API Proxy
    location /api {
        proxy_pass http://localhost:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend Static
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOL

sudo ln -sfn /etc/nginx/sites-available/bitbeats /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Firewall
log "Configurando Firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
echo "y" | sudo ufw --force enable

log "✅ DEPLOY FINALIZADO COM SUCESSO!"
echo "--------------------------------------------------------"
echo "Acesse: http://$DOMAIN"
echo "Para monitorar logs: pm2 logs bitbeats-api"
echo "--------------------------------------------------------"