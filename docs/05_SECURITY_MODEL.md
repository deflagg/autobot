# Security Model

## Threats considered
- Accidental edits to sensitive files.
- Token leakage.
- Running multiple daemons with conflicting state.

## Current safeguards (implemented)
- OAuth tokens stored locally under `~/.autobot`.
- Auth profile writes guarded by `auth.lock`.
- Daemon PID lock prevents multiple instances.
- `ensureCleanTree` check enforced before apply/rollback.
- `ensureChangePathsAllowed` enforces allow/deny lists when enabled.

## Optional safety configuration
- Allowlist/denylist for file paths (configurable today).
- Default deny for secrets (`.env`, `*.pem`, `*.key`, `*token*`, `*credentials*`).

## Operating assumptions
- Single user, local machine.
- Provider authentication via OAuth.
