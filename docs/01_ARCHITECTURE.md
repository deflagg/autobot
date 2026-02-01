# Architecture

## High‑level view
Autobot is a local CLI + daemon system with a WebSocket protocol. The CLI is the primary UI. The daemon owns long‑lived state (auth, sessions, tokens) and mediates requests to provider backends.

```
[User]
  ↓
[CLI] ⇄ (WS protocol) ⇄ [Daemon] ⇄ [Provider]
                        ↳ [Local State]
```

## Boundaries
- **CLI**: user commands, input collection, presentation of responses.
- **Daemon**: auth lifecycle, provider orchestration, protocol server.
- **Provider layer**: LLM endpoint integration and SSE parsing.
- **Local state**: JSON files + logs in `~/.autobot`.

## Runtime modes
- **Foreground CLI**: `autobot chat` with a live loop.
- **Background daemon**: `autobot daemon <start|stop|restart|status|logs>`.

## Reliability model
- OAuth tokens are persisted and refreshed.
- Daemon PID lock prevents multiple instances.
- Doctor checks validate config/auth and token state.

## Evolution path
- v0.1: chat UX implemented via `update.create`/`update.created`.
- v0.x: reintroduce guarded self-edit loop if/when desired.
