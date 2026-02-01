# Protocol (CLI ⇄ Daemon)

## Transport
- Local WebSocket server (daemon) on `ws://127.0.0.1:<port>`.
- Messages are JSON envelopes with `id`, `type`, optional `payload`.

## Core message types (actual)
Auth:
- `auth` → `auth.ok` / `auth.error`
- `auth.login.start`
- `auth.login.complete`
- `auth.status.get` → `auth.status.result`

Status/doctor:
- `status.get` → `status.result`
- `doctor.run` → `doctor.result`

Update flow:
- `update.create` → `update.created`
- `update.apply` → `update.applied`
- `update.rollback` → `update.rolledBack`

Loop (defined but not used in v0.1 UX):
- `loop.start`, `loop.status.get`, `loop.stop`

## Error handling
- Errors are returned as `{ type: 'error', ok: false, error: { code, message } }`.

## Versioning
- Protocol version is tracked in the protocol package.
- Breaking changes require CLI + daemon updates together.
