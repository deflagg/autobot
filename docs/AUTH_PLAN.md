# OpenAI Codex OAuth Plan (Provider-Based)

## Goals
- OAuth with PKCE (daemon-owned loopback)
- Provider-based abstraction (future providers without refactor)
- Tokens stored outside repo with 0600 perms
- Refresh support + ensureValidToken
- CLI remains thin; daemon owns OAuth state

---

## Design recommendation (placement)
- **Provider interface + registry:** `packages/core`
  - Shared contract, reusable by CLI/daemon
- **Provider implementation that owns HTTP loopback server:** `packages/daemon` (or daemon submodule)
  - Avoid runtime/server deps in core

This mirrors typical web auth design: shared interface + registry + server-owned callback handling.

---

## Provider: `openai-codex-oauth`
Provider interface:
- `auth.startLogin() -> { authUrl }`
- `auth.completeLogin(input) -> { ok, error? }`
- `auth.getStatus() -> { configured, expired, refreshable, expiresAt? }`
- `auth.ensureValidToken() -> { accessToken }`
- `auth.logout()` (optional)

---

## Provider config + defaults
- `authorizeUrl = https://auth.openai.com/oauth/authorize`
- `tokenUrl = https://auth.openai.com/oauth/token`
- `redirectHost = 127.0.0.1`
- `redirectPort = 1455`
- `redirectPath = /auth/callback`
- `scopes = "openid profile email offline_access"`
- `clientId = app_EMoamEEZ73f0CkXaXp7hrann`
- Extra auth params:
  - `id_token_add_organizations=true`
  - `codex_cli_simplified_flow=true`

Rules:
- `oauth.clientId` is override-only. **Never prompt. Never fail when missing.**

---

## Session manager (provider-owned)
Holds:
- `state`
- `pkceVerifier`
- `redirectUri`
- `createdAt`, `expiresAt`
- loopback HTTP server + cleanup

Flow:
- `startLogin()` creates session, starts listener, returns authUrl
- `completeLogin({ redirectUrl } | { code, state })` validates + exchanges code
- `getStatus()` reads provider token store

---

## PKCE helpers (provider-local)
- `generatePkce()` (verifier + S256 challenge)
- `generateState()`
- `buildAuthorizeUrl()` with response_type=code, client_id, redirect_uri, scope, state, code_challenge/method, extra params

---

## Loopback callback server
- Bind `http://127.0.0.1:<port>`; handle `GET /auth/callback?code=...&state=...`
- Validate state, exchange code, persist tokens
- Respond with minimal success HTML
- Stop server on success
- If bind fails, return auth URL and require manual completion

---

## Token exchange + persistence
- Exchange code via POST `grant_type=authorization_code` with PKCE verifier
- Persist `access_token`, `refresh_token`, `expires_in`, `obtained_at`, derived `expires_at`
- Provider-scoped token file; atomic write; chmod 0600

---

## Refresh support
- `needsRefresh()` with skew
- `refreshTokens()` via `grant_type=refresh_token`
- Update/rotate refresh token if returned
- `ensureValidToken()` returns access token, refreshing if needed

---

## IPC wiring (daemon/service)
Expose provider auth operations via IPC:
- `auth.login.start(providerId) -> { authUrl }`
- `auth.login.complete(providerId, input) -> { ok, error? }`
- `auth.status.get(providerId) -> { configured, expired, refreshable, expiresAt? }`

---

## CLI (provider-based)
- `autobot auth login --provider openai-codex-oauth`
  - call `auth.login.start`
  - open browser best-effort
  - wait for completion (primary) or poll status (fallback)
- `autobot auth complete "<redirect-url>" --provider openai-codex-oauth`
- `autobot auth status --provider openai-codex-oauth`

---

## Timeouts + errors
- Session lifetime ~10 minutes
- Errors: session expired, port bind failure, missing code/state, state mismatch, token errors
- Always stop loopback server on success/timeout/cancel

---

## Validation checklist
- Fresh machine: `autobot auth login` works without clientId prompt
- Token file written with 0600
- Loopback completion auto-triggers `auth.login.completed`
- Manual completion works when port is occupied
- Refresh path updates tokens correctly
