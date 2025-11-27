#!/usr/bin/env bash
#
# BitBeats Ubuntu 24.04 LTS bootstrapper
# Usage: sudo bash scripts/server/setup.sh https://github.com/you/BitBeats.git /opt/bitbeats
#

set -euo pipefail

REPO_URL="${1:-https://example.com/your/BitBeats.git}"
APP_DIR="${2:-/opt/bitbeats}"
NODE_MAJOR=22

echo "➡️  Updating apt cache..."
apt-get update -y

echo "➡️  Installing base packages..."
apt-get install -y curl git ufw build-essential nginx

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null || echo v0)" != v${NODE_MAJOR}* ]]; then
  echo "➡️  Installing Node.js ${NODE_MAJOR}.x..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi

echo "➡️  Configuring UFW..."
ufw allow OpenSSH >/dev/null || true
ufw allow 80 >/dev/null || true
ufw allow 443 >/dev/null || true
ufw --force enable

echo "➡️  Current listening ports:"
ss -tulpn

echo "➡️  Preparing application directory at ${APP_DIR}..."
if [ ! -d "${APP_DIR}" ]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  cd "${APP_DIR}"
  git fetch origin
  git reset --hard origin/main
fi

cd "${APP_DIR}"

echo "➡️  Installing npm dependencies..."
npm ci

echo "➡️  Building frontend..."
npm run build

cat <<'EOF'

✅ Setup complete.
Next steps:
1. Serve ./dist via nginx or any static server (e.g., npx serve -s dist -l 4173).
2. For continuous updates, re-run this script (cron/systemd) to pull `main`.
3. Ensure your backend/API (if any) is deployed separately.

EOF
