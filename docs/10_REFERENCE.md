# Reference (Providers, Errors)

## Provider IDs + OAuth endpoints
Supported provider IDs:
- `openai-codex` (default)

OAuth endpoints (default):
- Authorize: `https://auth.openai.com/oauth/authorize`
- Token: `https://auth.openai.com/oauth/token`

## Daemon error codes
Common error responses:
- `BAD_JSON` — invalid JSON payload.
- `BAD_ENVELOPE` — missing/invalid envelope fields.
- `AUTH_REQUIRED` — must send `auth` first.
- `UNAUTHORIZED` — invalid auth token.
- `PROVIDER_NOT_FOUND` — unknown providerId.

(Errors returned as `{ type: 'error', ok: false, error: { code, message } }`)
