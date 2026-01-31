# Log

## 2026-01-31
- Verified Iterations 0–8 completed based on git history.
- Set current focus to OAuth hardening (import, refresh, login flow).
- Marked `dist/` as build output to ignore.
- Updated STATUS/NEXT to reflect actual progress.
- Removed OpenClaw dependency from auth flow; require explicit oauth config.
- Added refresh/expiry handling in auth status.
- Added `auth.login.complete` fallback + CLI command.
- Added `autobot doctor` checks (oauth config/tokens, git clean).
- Updated docs (PROTOCOL/MVP/V0_1_SPEC) to reflect no OpenClaw dependency.
- Iteration A: added provider interface + registry, providerId routing in protocol/daemon/CLI.
- Iteration B: added provider-owned OAuth login with built-in clientId, loopback server, and updated endpoints/params.
- README/docs updated for built-in defaults.
- Iteration C: added refresh + ensureValidToken + expiresAt tracking.
- Iteration D: event-based auth.login.completed notifications wired.
- End-to-end auth login tested (manual completion) + auth status confirmed.
- Added daemon PID lock to prevent port collisions.
- Verified end-to-end auth login (loopback + event completion).
- Cleaned test artifacts (dist outputs, temp files) and reset config to defaults.
- Build ran clean.

## 2026-01-30
- Initialized repository scaffold: README/STATUS/NEXT/HANDOFF/DECISIONS/LOG.
