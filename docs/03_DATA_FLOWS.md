# Data Flows

## Auth login
1) CLI sends `auth.login.start` to daemon.
2) Daemon starts OAuth flow (PKCE + loopback callback).
3) User completes login in browser.
4) Daemon stores tokens in `~/.autobot/auth-profiles.json` (and lock).
5) CLI can query `auth.status.get` and receives `auth.status.result`.

## Chat (v0.1)
1) CLI sends `update.create` with the user prompt as `goal`.
2) Daemon routes to provider backend.
3) Provider returns streaming response (SSE).
4) Daemon parses SSE and returns `update.created` with `payload.response`.
5) CLI prints assistant response.

## Token refresh
1) On request, daemon checks token expiry.
2) If expired, refreshes token using provider refresh flow.
3) Updates `auth-profiles.json`.

## Doctor checks
- Validate OAuth config.
- Validate token presence + expiry/refreshability.
- Confirm repo state (clean working tree when required).
