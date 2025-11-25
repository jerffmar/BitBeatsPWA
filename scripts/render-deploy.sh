#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
if [ -n "${CI:-}" ]; then
  npm ci --no-audit --no-fund
else
  npm install
fi

echo "Building production bundle..."
npm run build
