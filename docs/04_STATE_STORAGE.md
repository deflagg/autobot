# State & Storage

## Workspace
Project workspace is the repo checkout (e.g., `/mnt/d/source/vscode/autobot`).

## User state directory
`~/.autobot/`

Files:
- `config.json` — optional overrides (oauth, llm, safety, ws, auth token).
- `auth-profiles.json` — OAuth tokens + metadata.
- `auth.lock` — file lock for auth profile writes.
- `openai-codex.oauth.json` — legacy OAuth tokens (import source).
- `daemon.pid` — daemon lock to prevent collisions.

## Repo-local artifacts
- `updates/<timestamp>-<ulid>/request.json` — update request records.

## Persistence rules
- Tokens are always persisted locally.
- No secrets are committed to the repo.
- State files are owned by the local user.
