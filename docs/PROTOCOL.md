# Autobot WebSocket Protocol (typed messages)

This protocol is used between the **CLI** (client) and **daemon** (server).

## Transport
- WebSocket server bound to `ws://127.0.0.1:<port>` (default 18790).
- Local-only, single-user.

## Message envelope
All messages are JSON objects with:
- `id` (string): client-generated request id (uuid/ulid). For server-emitted events, `id` SHOULD reference the originating request id when applicable.
- `type` (string): message type.
- `ts` (number, optional): unix milliseconds.
- `payload` (object, optional): message body.
- `ok` (boolean, optional): for responses.
- `error` (object, optional): for failures.

Example:
```json
{ "id": "01H...", "type": "status.get", "payload": {} }
```

## Authentication
Client must authenticate before any other request.

### Client → Server: `auth`
```json
{ "id": "<reqId>", "type": "auth", "payload": { "token": "..." } }
```

### Server → Client: `auth.ok` / `auth.error`
```json
{ "id": "<reqId>", "type": "auth.ok", "ok": true }
```
```json
{ "id": "<reqId>", "type": "auth.error", "ok": false, "error": { "code": "UNAUTHORIZED", "message": "Invalid token" } }
```

## Core request/response types (MVP)

### `status.get`
Client → server:
```json
{ "id": "<reqId>", "type": "status.get" }
```
Server → client:
```json
{
  "id": "<reqId>",
  "type": "status.result",
  "ok": true,
  "payload": {
    "repoPath": "/mnt/d/source/vscode/autobot",
    "git": { "head": "<sha>", "branch": "master", "dirty": false },
    "daemon": { "pid": 1234, "uptimeMs": 123456 },
    "lastUpdate": { "id": "<updateId>", "state": "applied|failed|proposed|none" }
  }
}
```

### `doctor.run`
Client → server:
```json
{ "id": "<reqId>", "type": "doctor.run" }
```
Server → client:
```json
{ "id": "<reqId>", "type": "doctor.result", "ok": true, "payload": { "checks": [ {"name":"git", "ok":true} ] } }
```

### `update.create`
Client → server:
```json
{ "id": "<reqId>", "type": "update.create", "payload": { "goal": "..." } }
```
Server → client:
```json
{ "id": "<reqId>", "type": "update.created", "ok": true, "payload": { "updateId": "<updateId>" } }
```

### `update.apply`
Client → server:
```json
{ "id": "<reqId>", "type": "update.apply", "payload": { "updateId": "<updateId>", "autostash": false } }
```
Server → client:
```json
{ "id": "<reqId>", "type": "update.applied", "ok": true, "payload": { "commit": "<sha>" } }
```

### `update.rollback`
Client → server:
```json
{ "id": "<reqId>", "type": "update.rollback", "payload": { "ref": "<optional>" } }
```
Server → client:
```json
{ "id": "<reqId>", "type": "update.rolledBack", "ok": true, "payload": { "head": "<sha>" } }
```

## Streaming events (server → client)
These can occur during long operations like apply/verify.

### `log.line`
```json
{ "id": "<reqId>", "type": "log.line", "payload": { "level": "info", "text": "Running npm test..." } }
```

### `update.progress`
```json
{ "id": "<reqId>", "type": "update.progress", "payload": { "stage": "plan|patch|gate|apply|verify|commit", "percent": 42 } }
```

### `verify.output`
```json
{ "id": "<reqId>", "type": "verify.output", "payload": { "stream": "stdout", "text": "..." } }
```

## Error format
```json
{
  "id": "<reqId>",
  "type": "error",
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED|VERIFY_FAILED|GIT_DIRTY|FORBIDDEN_PATH|INTERNAL",
    "message": "Human readable message",
    "details": {}
  }
}
```

---

## Auth management messages (MVP)

### `auth.status.get`
Client → server:
```json
{ "id": "<reqId>", "type": "auth.status.get" }
```
Server → client:
```json
{ "id": "<reqId>", "type": "auth.status.result", "ok": true, "payload": { "provider": "openai-codex", "configured": true, "refreshable": true } }
```

### `auth.import.openclaw`
Client → server:
```json
{ "id": "<reqId>", "type": "auth.import.openclaw", "payload": { "path": "<optional>" } }
```
Server → client:
```json
{ "id": "<reqId>", "type": "auth.imported", "ok": true }
```

### Auth-related errors
- `AUTH_REQUIRED`
- `AUTH_EXPIRED`
- `AUTH_IMPORT_FAILED`
