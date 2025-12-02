#!/bin/bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Please run as root." >&2
  exit 1
fi

GIT_REPO="${GIT_REPO:-https://github.com/your-org/bitbeats-hybrid.git}"
APP_ROOT="/opt/bitbeats"
WEB_ROOT="/var/www/bitbeats/dist"
DOMAIN="${DOMAIN:-bitbeats.example.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"

echo "[1/10] Updating system and installing base packages..."
apt-get update
apt-get install -y curl git docker.io docker-compose-v2 nginx certbot python3-certbot-nginx ufw

systemctl enable --now docker
systemctl enable --now nginx

echo "[2/10] Ensuring Node.js 20.x is installed on host..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[3/10] Verifying swap space (2G minimum)..."
if [[ "$(swapon --show | wc -l)" -le 1 ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q "/swapfile" /etc/fstab || echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "[4/10] Configuring UFW firewall..."
ufw --force reset
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 6881/tcp
ufw allow 6881/udp
ufw --force enable

echo "[5/10] Preparing directories..."
mkdir -p "$APP_ROOT" "$WEB_ROOT" /var/www/bitbeats
chown -R root:root "$APP_ROOT"
chown -R www-data:www-data /var/www/bitbeats

echo "[6/10] Fetching application source..."
if [[ -d "$APP_ROOT/.git" ]]; then
  git -C "$APP_ROOT" fetch --all --prune
  git -C "$APP_ROOT" reset --hard origin/main
else
  git clone "$GIT_REPO" "$APP_ROOT"
fi

echo "[7/10] Building frontend and publishing static files..."
if [[ -d "$APP_ROOT/frontend" ]]; then
  pushd "$APP_ROOT/frontend" >/dev/null
  npm install
  npm run build
  rm -rf "$WEB_ROOT"/*
  cp -R dist/. "$WEB_ROOT"/
  popd >/dev/null
fi
chown -R www-data:www-data /var/www/bitbeats

echo "[8/10] Writing Nginx site config..."
cat >/etc/nginx/sites-available/bitbeats <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name _;
    root /var/www/bitbeats/dist;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /tracker/ {
        proxy_pass http://localhost:3000/tracker/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/bitbeats /etc/nginx/sites-enabled/bitbeats
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "[9/10] Requesting/renewing SSL certificate (if DNS is ready)..."
if [[ "${ENABLE_SSL:-true}" == "true" ]]; then
  certbot --nginx --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" -d "$DOMAIN" || true
fi

echo "[10/10] Deploying backend stack with Docker..."
pushd "$APP_ROOT" >/dev/null
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
popd >/dev/null

echo "[Validation] Checking HTTP endpoint..."
curl -I http://localhost || true

echo "[Validation] Listing running containers..."
docker ps

echo "Deployment completed successfully."
