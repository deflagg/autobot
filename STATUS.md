# Status

## Current phase
v0.1 core implementation complete (Iterations 0–8). Now hardening OAuth/auth and cleaning repo state.

## What works
- Monorepo packages: `cli`, `daemon`, `protocol`, `core`
- Daemon WS server + auth token gate
- Chat-only UX (prompts → assistant response)
- OAuth login start + status, daemon-owned callback, PKCE helpers
- Auth token sink + refresh/lock in `~/.autobot/auth-profiles.json`
- `autobot doctor` checks (oauth config/tokens, git clean)
- Installer + systemd user service wrapper

## In progress
- Codex backend integration hardening (SSE parsing + response shape)
- End-to-end chat response test on a clean config

## Next (top 5)
See `NEXT.md`.
