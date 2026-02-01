# autobot

A from-scratch, rethink-first personal automation agent.

## Goals
- Local-first CLI + daemon for a straightforward chat experience (v0.1).
- OAuth login + token refresh with durable state.
- Guardrails for safe changes (present in code, not exposed in chat UX).

## Repo navigation
- `STATUS.md` — current state at a glance
- `NEXT.md` — prioritized task queue
- `LOG.md` — chronological progress log
- `docs/` — architecture + protocol docs

## Getting started

Install (Ubuntu):
```bash
curl -fsSL https://raw.githubusercontent.com/deflagg/autobot/master/install.sh | bash
```

Uninstall:
```bash
curl -fsSL https://raw.githubusercontent.com/deflagg/autobot/master/uninstall.sh | bash
```

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
Tokens are stored locally at `~/.autobot/auth-profiles.json` (treat like a password).

Check status:
```bash
autobot auth status
```

Run doctor checks:
```bash
autobot doctor
```

Chat:
```bash
autobot chat
```
(Type a prompt per line; `exit` to quit.)

Chat responds like a normal assistant. No plan/diff/apply steps.

Safety config (optional):
```json
{
  "safety": {
    "allowlist": ["src/**", "packages/**"],
    "denylist": [".git/**", ".env", "**/*token*", "**/*credentials*"]
  }
}
```

LLM config (optional):
```json
{
  "llm": {
    "model": "gpt-5.2",
    "endpoint": "https://chatgpt.com/backend-api/codex/responses"
  }
}
```

Daemon control:
```bash
autobot daemon <start|stop|restart|status|logs>
```

Daemon PID lock: the daemon writes `~/.autobot/daemon.pid` and refuses to start if a daemon is already running.

## Design docs
- [Overview](docs/00_OVERVIEW.md)
- [Architecture](docs/01_ARCHITECTURE.md)
- [Components](docs/02_COMPONENTS.md)
- [Data flows](docs/03_DATA_FLOWS.md)
- [State & storage](docs/04_STATE_STORAGE.md)
- [Security model](docs/05_SECURITY_MODEL.md)
- [Deployment](docs/06_DEPLOYMENT.md)
- [Protocol](docs/07_PROTOCOL.md)
- [Decisions](docs/08_DECISIONS.md)
- [Roadmap](docs/09_ROADMAP.md)
- [Reference](docs/10_REFERENCE.md)
