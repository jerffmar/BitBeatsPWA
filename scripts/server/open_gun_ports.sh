#!/usr/bin/env bash
set -euo pipefail

DEFAULT_PORTS=("8765")
PORTS=("${@:-${DEFAULT_PORTS[@]}}")

if [[ $EUID -ne 0 ]]; then
  echo "⚠️  Please run this script with sudo/root privileges."
  exit 1
fi

log() { printf "\n➡️  %s\n" "$1"; }

apply_with_ufw() {
  for port in "${PORTS[@]}"; do
    log "Allowing TCP ${port} via ufw..."
    ufw allow "${port}"/tcp >/dev/null
  done
  ufw status verbose
}

apply_with_firewalld() {
  for port in "${PORTS[@]}"; do
    log "Allowing TCP ${port} via firewalld..."
    firewall-cmd --add-port="${port}"/tcp --permanent >/dev/null
  done
  firewall-cmd --reload >/dev/null
  firewall-cmd --list-ports
}

apply_with_iptables() {
  for port in "${PORTS[@]}"; do
    log "Allowing TCP ${port} via iptables..."
    iptables -C INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null || \
      iptables -I INPUT -p tcp --dport "${port}" -j ACCEPT
  done
  iptables -S INPUT | grep dport || true
}

main() {
  if command -v ufw >/dev/null 2>&1; then
    apply_with_ufw
  elif command -v firewall-cmd >/dev/null 2>&1; then
    apply_with_firewalld
  elif command -v iptables >/dev/null 2>&1; then
    apply_with_iptables
  else
    echo "❌ No supported firewall tool (ufw/firewalld/iptables) found."
    exit 1
  fi

  log "Verifying listeners (if any)..."
  ss -tulpn | grep -E "(${PORTS[*]// /|})" || echo "No processes listening yet—start your Gun relay to verify."
  echo "✅ Finished opening Gun relay ports: ${PORTS[*]}"
}

main
