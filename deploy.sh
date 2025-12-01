#!/bin/bash
set -euo pipefail

DEFAULT_NGINX_PORT=80
FALLBACK_NGINX_PORT=8080
if [ -z "${NGINX_HOST_PORT+x}" ]; then
  export NGINX_HOST_PORT=$DEFAULT_NGINX_PORT
  NGINX_PORT_WAS_DEFAULTED=1
else
  export NGINX_HOST_PORT
  NGINX_PORT_WAS_DEFAULTED=0
fi
export PORT=80

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: $1 is required but not installed."
    exit 1
  fi
}

assert_services_running() {
  local running
  running=$(docker compose ps --services --filter "status=running")
  for service in "$@"; do
    if ! grep -qx "$service" <<< "$running"; then
      echo "Error: $service service is not running."
      exit 1
    fi
  done
}

wait_for_http() {
  local url="$1"
  for attempt in {1..10}; do
    if curl -fsS --max-time 5 "$url" >/dev/null; then
      echo "App is reachable at $url"
      return 0
    fi
    echo "Waiting for $url (attempt $attempt)..."
    sleep 3
  done
  echo "Error: Unable to reach $url"
  exit 1
}

require_command docker
require_command curl
require_command python3

is_port_in_use() {
  python3 - "$1" <<'PY'
import socket, sys
port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("0.0.0.0", port))
    except OSError:
        sys.exit(0)  # port in use
sys.exit(1)  # port free
PY
}

echo "Building React frontend..."
npm install --legacy-peer-deps
npm run build

if [ ! -d "dist" ]; then
  echo "Error: dist directory not found. Build may have failed."
  exit 1
fi

if is_port_in_use "$NGINX_HOST_PORT"; then
  if [ "$NGINX_PORT_WAS_DEFAULTED" -eq 1 ]; then
    export NGINX_HOST_PORT=$FALLBACK_NGINX_PORT
    echo "Port 80 in use; falling back to ${NGINX_HOST_PORT}."
  else
    echo "Error: Port ${NGINX_HOST_PORT} is already in use. Set NGINX_HOST_PORT to a free port."
    exit 1
  fi
fi

echo "Rebuilding and restarting backend container..."
docker compose down
docker compose up -d --build api db nginx

echo "Running Prisma migrations..."
docker compose exec api npx prisma migrate deploy

echo "Running deployment health checks..."
assert_services_running api db nginx
wait_for_http "http://localhost:${NGINX_HOST_PORT}"

echo "Deployment Success! Backend running..."
