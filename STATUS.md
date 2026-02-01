# Status

## Current phase
v0.1 core implementation complete (Iterations 0–8). Now hardening OAuth/auth and cleaning repo state.

## What works
- Monorepo packages: `cli`, `daemon`, `protocol`, `core`
- Daemon WS server + auth token gate
- Update flow: create → apply → verify → commit → rollback
- Continuous loop: start/status/stop with rollback+retry + stagnation detection
- Installer + systemd user service wrapper
- OAuth login start + status, daemon-owned callback, PKCE helpers
- `autobot doctor` checks (oauth config/tokens, git clean)
- Audit logging utilities

## In progress
- Auth storage migrated to auth-profiles.json (token sink + lock)
- Codex endpoint integration hardening (response parsing, defaults)
- End-to-end auth login verified (event-based + loopback)
- Chat loop + safety allowlist/denylist added
- Chat-only UX: remove update/apply CLI commands, auto-apply in chat
- Renamed patch artifacts to change (no fallback)
- LLM integration wired into update.create/loop (direct HTTP, no SDK)

## Next (top 5)
See `NEXT.md`.
