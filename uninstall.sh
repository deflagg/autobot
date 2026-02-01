#!/usr/bin/env bash
set -euo pipefail

log() { echo "[autobot] $*"; }

if [[ $(id -u) -eq 0 ]]; then
  log "Do not run as root. Run as your user."
  exit 1
fi

log "Stopping and disabling user service..."
systemctl --user stop autobot 2>/dev/null || true
systemctl --user disable autobot 2>/dev/null || true
systemctl --user daemon-reload 2>/dev/null || true

log "Removing service file..."
rm -f "$HOME/.config/systemd/user/autobot.service"

log "Removing state directory..."
rm -rf "$HOME/.autobot"

log "Uninstalling global npm package..."
if command -v npm >/dev/null 2>&1; then
  npm uninstall -g autobot || true
fi

log "Uninstall complete."
