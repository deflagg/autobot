# Recommended implementation stack (draft)

Source: `temp_impstack.txt` (imported into docs on 2026-01-31).

## Repo layout
- Monorepo, TypeScript
- `packages/{daemon,cli,protocol,core}`

## Daemon (orchestrator)
- Node.js + TypeScript
- Fastify + `ws` for typed WebSocket API (local-only)
- Single-flight apply queue
- Persist update artifacts under `updates/<id>/…`
- Run as a **systemd user service** on WSL2

## Protocol / types
- Define all messages in a `protocol` package
- Use **Zod** for runtime validation + TS types
- Keep envelope/IDs and error codes as specified in `docs/PROTOCOL.md`

## CLI
- `oclif` (or `commander`)
- Stream logs/events over WS
- Commands map 1:1 to protocol (`status.get`, `doctor.run`, `update.create/apply/rollback`, loop start/stop/status)

## Git + changes
- Use `git worktree add` to an ephemeral dir
- `git apply` for unified diffs
- Verify → commit → fast-forward HEAD
- On failure: auto-rollback to pre-iteration commit

## Verification
- Use `execa` to run:
  - `npm test`
  - `npm run build`
- Stream `verify.output` and `update.progress` back to CLI

## Safety gates (server-enforced)
- Path denylist
- Change caps (files/LOC)
- Clean-tree requirement
- Explicit apply step
- Reject concurrent applies

## Auth / LLM client
- Daemon owns OAuth (loopback listener + token store) for OpenAI Codex
- Support import/status + login start/complete flows as specified

## Observability
- `pino` logs
- Protocol events for long operations
- Persist per-update/loop metadata for audit

## Key libraries
- Zod (schema)
- ws
- Fastify
- simple-git (or shelling out to `git`)
- execa
- ulid
- pino
- yaml
- oclif
