# Auth Migration Plan (Current → auth-design.txt)

This document describes how to migrate Autobot from the current OAuth/token storage + LLM calling pattern to the design in `auth-design.txt`.

## Current state (today)
- OAuth provider: `openai-codex-oauth`
- Token storage: `~/.autobot/credentials/openai-codex.oauth.json`
- LLM generation endpoint (currently): `https://api.openai.com/v1/responses` (incompatible with Codex OAuth tokens)

## Target state (auth-design.txt)
- Provider name: `openai-codex` (Codex subscription login)
- Canonical token sink: `~/.autobot/auth-profiles.json`
- Lock file: `~/.autobot/auth.lock`
- Refresh under lock + atomic writes
- LLM generation endpoint: `https://chatgpt.com/backend-api/codex/responses`

---

## Migration steps

### Step 1 — Add AuthStore + lock (no behavior change yet)
Add minimal modules:
- `AuthStore`:
  - reads/writes `~/.autobot/auth-profiles.json`
  - atomic write (tmp + rename)
  - lock acquisition via `~/.autobot/auth.lock`
- `TokenProvider`:
  - `getValidAccessToken()` refreshes under lock

### Step 2 — Backward-compatible import
On startup / first use:
- If `auth-profiles.json` does not exist but legacy `~/.autobot/credentials/openai-codex.oauth.json` exists:
  - import tokens into `auth-profiles.json` under `openai-codex:default`
  - do **not** delete the old file automatically

### Step 3 — Switch provider implementation
Modify the OAuth provider to:
- write tokens into `auth-profiles.json` (not `credentials/openai-codex.oauth.json`)
- use `TokenProvider.getValidAccessToken()` for refresh

### Step 4 — Switch LLM transport
Replace platform Responses calls with Codex subscription endpoint:
- `POST https://chatgpt.com/backend-api/codex/responses`
- `Authorization: Bearer <access_token>`

### Step 5 — CLI UX alignment
Move toward:
- `autobot auth login openai-codex`
- `autobot auth status`
- `autobot auth logout`

(We can keep `--provider` temporarily but default to `openai-codex`.)

---

## Rollout / safety
- Do not log tokens or auth codes.
- Ensure auth files use restrictive permissions (0600).
- Keep single in-flight login.
- If refresh fails, surface clear remediation: re-login.

---

## Definition of Done
- Tokens are stored in `~/.autobot/auth-profiles.json` and refreshed under lock.
- No platform API key path exists.
- LLM generation uses `chatgpt.com/backend-api/codex/responses` and succeeds for a simple goal.
