#!/usr/bin/env bash
#
# BitBeats Ubuntu 24.04 LTS bootstrapper
# Usage: sudo bash scripts/server/setup.sh https://github.com/you/BitBeats.git /opt/bitbeats
#

set -euo pipefail

REPO_URL="${1:-https://github.com/jerffmar/BitBeatsPWA.git}"
APP_DIR="${2:-/opt/bitbeats}"
NODE_MAJOR=22

echo "➡️  Updating apt cache..."
apt-get update -y

echo "➡️  Installing base packages..."
apt-get install -y curl git ufw build-essential nginx
apt-get install -y libchromaprint-tools

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null || echo v0)" != v${NODE_MAJOR}* ]]; then
  echo "➡️  Installing Node.js ${NODE_MAJOR}.x..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
  apt-get install -y nodejs
fi

echo "➡️  Configuring UFW..."
if ufw app info OpenSSH >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null || true
else
  echo "⚠️  UFW profile 'OpenSSH' not found, opening tcp/22 directly..."
  ufw allow 22/tcp >/dev/null || true
fi
ufw allow 80 >/dev/null || true
ufw allow 443 >/dev/null || true
ufw allow 5173 >/dev/null || true
ufw --force enable

echo "➡️  Current listening ports:"
ss -tulpn

echo "➡️  Preparing application directory at ${APP_DIR}..."
if [ ! -d "${APP_DIR}" ]; then
  if ! git clone "${REPO_URL}" "${APP_DIR}"; then
    echo "❌  Failed to clone ${REPO_URL}. Pass a valid repository URL as the first argument."
    exit 1
  fi
elif [ ! -d "${APP_DIR}/.git" ]; then
  echo "❌  ${APP_DIR} exists but is not a git repository. Remove it or choose another APP_DIR."
  exit 1
fi

cd "${APP_DIR}"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CURRENT_REMOTE="$(git remote get-url origin 2>/dev/null || true)"
  if [ -n "${CURRENT_REMOTE}" ] && [ "${CURRENT_REMOTE}" != "${REPO_URL}" ]; then
    echo "➡️  Updating git remote to ${REPO_URL}..."
    git remote set-url origin "${REPO_URL}"
  fi
  git fetch origin
  git reset --hard origin/main
fi

cd "${APP_DIR}"

echo "➡️  Installing npm dependencies..."
npm ci

echo "➡️  Ensuring music-metadata-browser dependency..."
if ! npm ls music-metadata-browser >/dev/null 2>&1; then
  npm install music-metadata-browser --no-save
fi

echo "➡️  Building frontend..."
npm run build

cat <<'EOF'

✅ Setup complete.
Next steps:
1. Serve ./dist via nginx or any static server (e.g., npx serve -s dist -l 4173).
2. For continuous updates, re-run this script (cron/systemd) to pull `main`.
3. Ensure your backend/API (if any) is deployed separately.

EOF
