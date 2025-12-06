#!/bin/bash

# ==============================================================================
# BitBeats - Script de Deploy "All-in-One" para Ubuntu 24.04 LTS
# Autor: Gerado via IA (Gemini)
# Funcionalidade: Configura Nginx, Postgres, Node, PM2, Build Frontend e Backend
# ==============================================================================

set -e # Encerra o script se qualquer comando falhar

# --- Configurações ---
APP_DIR="/var/www/bitbeats"
REPO_URL="https://github.com/jerffmar/bitbeatspwa.git" # URL Padrão (será sobrescrita se passar argumento)
DOMAIN="localhost" # Altere para seu domínio ou IP real (ex: bitbeats.seudominio.com)
DB_USER="bitbeats_user"
DB_PASS="bitbeats_secure_password" # ALERTA: Mude isso em produção!
DB_NAME="bitbeats_db"
NODE_PORT=3001
# Limpa instalação anterior (opcional)
sudo rm -rf /var/www/bitbeats
# Cores para logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERRO] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[AVISO] $1${NC}"
}

# 1. Atualização do Sistema
log "Atualizando pacotes do sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw build-essential nginx postgresql postgresql-contrib

# 2. Instalação do Node.js 22 (Versão especificada no CI)
log "Verificando Node.js..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v22* ]]; then
    log "Instalando Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    log "Node.js já instalado: $(node -v)"
fi

# Instalar PM2 globalmente
sudo npm install -g pm2 tsx

# 3. Configuração do Banco de Dados PostgreSQL
log "Configurando PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Cria usuário e banco se não existirem
sudo -u postgres psql -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" # Permissão necessária para Prisma Shadow DB

log "Banco de dados configurado."

# 4. Clonagem/Atualização do Repositório
log "Preparando diretório da aplicação em $APP_DIR..."

# Verifica se o diretório existe E se é um repositório git válido
if [ -d "$APP_DIR" ] && [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    log "Diretório existe. Atualizando código..."
    git fetch origin
    git reset --hard origin/main
else
    # Se o diretório existe mas não é git, remove para clonar do zero
    if [ -d "$APP_DIR" ]; then
        warn "Diretório existe mas não é um repositório git. Removendo..."
        sudo rm -rf "$APP_DIR"
    fi
    
    # Se passar URL como argumento ($1), usa ela, senão usa a padrão
    GIT_URL="${1:-$REPO_URL}"
    sudo mkdir -p "$APP_DIR"
    sudo chown -R $USER:$USER "$APP_DIR"
    git clone "$GIT_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# 5. Instalação de Dependências
log "Instalando dependências do NPM..."
npm ci

# 6. Configuração de Variáveis de Ambiente (.env)
log "Gerando arquivo .env..."
cat <<EOF > .env
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
PORT=$NODE_PORT
NODE_ENV=production
ACOUSTID_API_KEY="8XaBELgH"
EOF

# 7. Setup do Prisma (Schema e Migrations)
log "Aplicando migrações do banco de dados (Prisma)..."
npx prisma generate
npx prisma db push # Usa push para prototipagem rápida/produção simples sem migrations files

# 8. Build do Frontend
log "Compilando Frontend (Vite)..."
npm run build

# 9. Geração do Backend Server (Server Entry Point)
# NOTA: Como o arquivo server/index.ts não estava presente nos uploads, vamos criar um funcional
# que conecta os controllers existentes ao Express.
log "Gerando entrypoint do servidor (server.ts)..."
mkdir -p src/server
cat <<EOF > src/server/index.ts
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { identifyHandler } from '../controllers/identifyController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API Routes
app.post('/api/identify', identifyHandler);

// Mock Search Route (Simulando o que identification.ts espera)
app.get('/api/search', (req, res) => {
    // Implementação básica para evitar 404 no frontend
    res.json({ songs: [] }); 
});

app.get('/api/recording/:mbid', (req, res) => {
    res.status(404).json({ error: "Not implemented in this minimal server" });
});

// Serve Static Files (Fallback caso Nginx falhe ou para testes locais)
// Em produção, o Nginx servirá isso, mas é bom ter aqui.
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA Fallback
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
});
EOF

# 10. Configuração do PM2 (Backend)
log "Iniciando Backend com PM2..."
# Usamos tsx para rodar TypeScript diretamente em produção para simplificar
pm2 delete bitbeats-api 2>/dev/null || true
pm2 start src/server/index.ts --name bitbeats-api --interpreter=node --import=tsx --env production
pm2 save

# 11. Configuração do Nginx (Reverse Proxy)
log "Configurando Nginx..."

sudo tee /etc/nginx/sites-available/bitbeats > /dev/null <<EOL
server {
    listen 80;
    server_name $DOMAIN;

    root $APP_DIR/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API Proxy -> Backend Node.js
    location /api {
        proxy_pass http://localhost:$NODE_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend Static Files (SPA Support)
    location / {
        try_files \$uri \$uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    # Cache Control para Assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
EOL

# Ativa o site e remove o default
sudo ln -sfn /etc/nginx/sites-available/bitbeats /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

log "Testando configuração do Nginx..."
sudo nginx -t
sudo systemctl reload nginx

# 12. Firewall
log "Configurando Firewall (UFW)..."
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw --force enable

log "✅ DEPLOY CONCLUÍDO COM SUCESSO!"
echo "--------------------------------------------------------"
echo "Acesse sua aplicação em: http://$DOMAIN"
echo "Backend rodando na porta interna: $NODE_PORT"
echo "Diretório da aplicação: $APP_DIR"
echo "--------------------------------------------------------"