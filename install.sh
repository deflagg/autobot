#!/usr/bin/env bash
set -euo pipefail

# Zero-touch installer for Ubuntu/WSL2

REPO_PATH="${AUTOBOT_REPO_PATH:-$PWD}"
PORT="${AUTOBOT_PORT:-18790}"
STATE_DIR="${AUTOBOT_STATE_DIR:-$HOME/.autobot}"
CONFIG_PATH="$STATE_DIR/config.json"

mkdir -p "$STATE_DIR" "$STATE_DIR/credentials" "$STATE_DIR/logs"

# Install Node >= 22 if missing
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install autobot globally (assumes npm package)
if ! command -v autobot >/dev/null 2>&1; then
  npm i -g autobot
fi

# Generate token
TOKEN=$(python3 - <<'PY'
import secrets
print(secrets.token_hex(16))
PY
)

cat > "$CONFIG_PATH" <<EOF
{
  "repoPath": "${REPO_PATH}",
  "ws": { "port": ${PORT} },
  "auth": { "token": "${TOKEN}" },
  "oauth": { "redirectPort": 7777 }
}
EOF

# Install systemd user service
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/autobot.service" <<'EOF'
[Unit]
Description=Autobot daemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/env autobot-daemon
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now autobot

echo "Autobot installed. Try: autobot status"
