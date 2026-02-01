#!/usr/bin/env bash
set -euo pipefail

# Autobot zero-touch installer (Ubuntu)
# Non-interactive, idempotent

log() { echo "[autobot] $*"; }

if [[ $(id -u) -eq 0 ]]; then
  log "Do not run as root. Run as your user."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  log "This installer currently supports Ubuntu/apt-get only."
  exit 1
fi

# Inputs
AUTOBOT_REPO_PATH=${AUTOBOT_REPO_PATH:-"$PWD"}
AUTOBOT_PORT=${AUTOBOT_PORT:-18790}
AUTOBOT_STATE_DIR=${AUTOBOT_STATE_DIR:-"$HOME/.autobot"}

# Prereqs
log "Installing prerequisites..."
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates gnupg

# Node.js (>=22)
need_node=true
if command -v node >/dev/null 2>&1; then
  ver=$(node -v | sed 's/v//')
  major=${ver%%.*}
  if [[ $major -ge 22 ]]; then
    need_node=false
  fi
fi

if [[ "$need_node" == true ]]; then
  log "Installing Node.js 22 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/nodesource.gpg
  NODE_MAJOR=22
  echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y nodejs
fi

# Install Autobot globally
log "Installing Autobot CLI..."
npm i -g autobot

# State dirs
log "Creating state directories..."
mkdir -p "$AUTOBOT_STATE_DIR" "$AUTOBOT_STATE_DIR/credentials" "$AUTOBOT_STATE_DIR/logs"

# Default config
CONFIG_PATH="$AUTOBOT_STATE_DIR/config.json"
if [[ ! -f "$CONFIG_PATH" ]]; then
  log "Writing default config..."
  TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
  cat > "$CONFIG_PATH" <<EOF
{
  "repoPath": "${AUTOBOT_REPO_PATH}",
  "ws": { "port": ${AUTOBOT_PORT} },
  "auth": { "token": "${TOKEN}" }
}
EOF
else
  log "Config already exists at $CONFIG_PATH (leaving as-is)."
fi

# systemd user service
log "Installing systemd user service..."
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/autobot.service" <<'EOF'
[Unit]
Description=Autobot Daemon
After=network.target

[Service]
Type=simple
ExecStart=%h/.npm-global/bin/autobot daemon --run
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now autobot

log "Installation complete."
log "Check status: systemctl --user status autobot"
