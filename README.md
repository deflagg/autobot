# autobot

A from-scratch, rethink-first personal automation agent.

## Goals
- Build a self-modifying CLI agent that can generate and apply local code changes on demand.
- Provide guardrails: plan, diff, tests, commit, rollback.

## Repo navigation
- `STATUS.md` — current state at a glance
- `NEXT.md` — prioritized task queue
- `HANDOFF.md` — how another agent can continue immediately
- `DECISIONS.md` — key architecture decisions (why, not just what)
- `LOG.md` — chronological progress log

## Getting started

### OAuth configuration (required)
Optional override in `~/.autobot/config.json` (defaults are built-in):

```json
{
  "oauth": {
    "clientId": "<override-only>",
    "authorizeUrl": "https://auth.openai.com/oauth/authorize",
    "tokenUrl": "https://auth.openai.com/oauth/token",
    "redirectHost": "127.0.0.1",
    "redirectPort": 1455,
    "redirectPath": "/auth/callback",
    "scopes": "openid profile email offline_access"
  }
}
```

Then run:
```bash
autobot auth login
```

Note: only one login can be in-flight at a time. The daemon will reuse the existing session if a login is already running.

Check status:
```bash
autobot auth status
```

Run doctor checks:
```bash
autobot doctor
```

Chat loop:
```bash
autobot chat
```
(Type a goal per line; `exit` to quit.)

Safety config (optional):
```json
{
  "safety": {
    "allowlist": ["src/**", "packages/**"],
    "denylist": [".git/**", ".env", "**/*token*", "**/*credentials*"]
  }
}
```

Daemon PID lock: the daemon writes `~/.autobot/daemon.pid` and refuses to start if a daemon is already running.

## Design docs
- [v0.1 Spec](docs/V0_1_SPEC.md)
- [Protocol](docs/PROTOCOL.md)
- [Installer](docs/INSTALLER.md)
- [Implementation stack](docs/IMPLEMENTATION_STACK.md)
- [Milestones](docs/MILESTONES.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
