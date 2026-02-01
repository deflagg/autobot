# Components

## CLI
Responsibilities:
- Parse commands and flags.
- Run chat loop (`autobot chat`).
- Trigger auth (`autobot auth login|status|complete`).
- Control daemon via systemd user service.

## Daemon
Responsibilities:
- Serve WebSocket protocol endpoint.
- Own OAuth flow and callback handler.
- Store and refresh tokens.
- Route requests to provider backends.
- Create update artifacts on `update.create`.

## Protocol package
Responsibilities:
- Shared message types (envelopes + schemas).

## Core package
Responsibilities:
- Shared utilities (config, paths, serialization).
- Safety helpers (allow/deny enforcement).
- Auth store + token provider helpers.

## Provider layer
Responsibilities:
- Provider registry and routing by `providerId`.
- OAuth + token handling (provider-owned login flow).
- LLM call + SSE parsing (Codex/OpenAI backend).

## Installer
Responsibilities:
- Install CLI + daemon.
- Set up systemd user service.
