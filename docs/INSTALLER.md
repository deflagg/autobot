# Zero-touch installer (Ubuntu)

## Goal
Provide a **single command**, **non-interactive** installer that provisions:
- Autobot CLI
- Autobot daemon
- Default configuration
- systemd **user** service (enabled + started)
- Node.js runtime (installed automatically if missing)

Target command:

```bash
curl -fsSL https://raw.githubusercontent.com/deflagg/autobot/master/install.sh | bash
```

## Constraints
- Must be **non-interactive** (no prompts).
- Must be idempotent/safe to re-run.
- Must default to **local-only** daemon binding and single-user assumptions.
- Must not write secrets into the repo.

## Inputs (environment variables)
All optional; defaults used if unset.
- `AUTOBOT_REPO_PATH` — path to the autobot repo/workspace.
- `AUTOBOT_PORT` — daemon WebSocket port (default: 18790).
- `AUTOBOT_STATE_DIR` — default `~/.autobot`.
- `AUTOBOT_INSTALL_CHANNEL` — `stable|beta|dev` (future; default stable).

## What the installer does
1) **Detect OS**
   - Ubuntu (and Ubuntu-like) only for MVP.

2) **Install prerequisites**
   - `curl`, `git`, `systemd` user services supported.

3) **Install Node automatically**
   - If Node is missing or too old, install Node >= 22.
   - Preferred method (MVP): NodeSource packages (or another deterministic method).
   - Must be non-interactive.

4) **Install Autobot CLI/daemon**
   - MVP assumption: install from npm (global), e.g. `npm i -g autobot`.
   - (Alternative later: GitHub releases tarball.)

5) **Create state dirs**
   - `~/.autobot/`
   - `~/.autobot/credentials/`
   - `~/.autobot/logs/`

6) **Generate default config**
   - Create `~/.autobot/config.json` with:
     - `repoPath` (from env or default)
     - `ws.port` (default 18790)
     - `auth.token` (random)

7) **Install systemd user service**
   - Write `~/.config/systemd/user/autobot.service`
   - `systemctl --user daemon-reload`
   - `systemctl --user enable --now autobot`

8) **Verify**
   - `autobot status` returns OK (daemon reachable).

## Notes (WSL2)
- systemd user services require systemd enabled in WSL2.
- If systemd is unavailable, installer should fail with a clear message.

## Practical note
GitHub's HTML URL is not a raw script. In implementation we should point to the raw content URL, e.g.:

```bash
curl -fsSL https://raw.githubusercontent.com/deflagg/autobot/master/install.sh | bash
```

We keep the top-level command string aligned with product requirements, but the actual install entrypoint should be a raw, cacheable script.
