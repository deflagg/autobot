# v0.1 Milestone Plan

## M0 — Repo skeleton (design lock)
- Finalize v0.1 spec and protocol
- Confirm implementation stack
- Create monorepo layout

## M1 — Core runtime + WS skeleton
- Daemon WS server (local-only)
- Typed protocol package
- CLI connects + sends `status.get`
- Config loader with repoPath

## M2 — Auth (OpenAI Codex OAuth)
- Daemon-owned OAuth PKCE flow
- CLI `auth login/status`
- Token storage + refresh

## M3 — Update contract v0
- `update.create` produces plan+patch artifacts
- `update.apply` validates gates
- Apply patch, verify, commit
- `rollback` command

## M4 — Continuous loop
- `loop.start/status/stop`
- retry+rollback semantics
- loop audit state persisted

## M5 — Installer + service
- `install.sh` one-command install
- systemd user service template
- `autobot daemon start/stop/status/logs`

## Exit criteria (v0.1)
- MVP acceptance test passes end-to-end
- Installer sets up daemon + config without prompts
- OAuth login + refresh succeeds
