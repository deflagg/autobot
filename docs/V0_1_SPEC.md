# Autobot v0.1 Spec (Consolidated)

## Purpose
Autobot is a local, single-user, always-on agent that can **self-edit its own repo** when explicitly asked, using a **guardrailed update workflow**. v0.1 proves the end-to-end self-edit loop is safe, testable, auditable, and reversible.

---

## Scope (v0.1)
### In
- Always-on daemon (systemd user service on WSL2)
- CLI client (thin)
- WebSocket local API (typed messages)
- Self-edit workflow: plan → diff → apply → verify → commit → rollback
- Continuous update loop (auto-apply with rollback+retry)
- Native OpenAI Codex OAuth login (daemon-owned)
- Zero-touch installer (Ubuntu)

### Out
- Web UI
- Messaging channels
- Tool execution beyond repo editing
- Multi-user / remote access
- Embeddings / memory

---

## Environment + constraints
- Platform: WSL2 (Linux userland)
- Service manager: systemd **user** service
- Transport: WebSockets bound to `127.0.0.1:<port>` only
- Implementation: Node.js + TypeScript

Default port: **18790**

---

## Architecture (v0.1)
**Daemon (always-on)**
- Owns OAuth, update pipeline, apply/verify/commit/rollback
- Exposes WS API
- Serializes apply operations

**CLI**
- Connects to daemon over WS
- Presents progress + results
- Wraps systemd service control

**Repo**
- Contains docs + update artifacts under `updates/<id>/...`

---

## Config (required)
Location: `~/.autobot/config.json`

Must include:
- `repoPath` (absolute path)
- `ws.port` (default 18790)
- `auth.token` (generated on install)
- safety limits (max files/LOC), denylist patterns
- verification commands (`npm test`, `npm run build`)

Credentials stored at:
- `~/.autobot/credentials/openai-codex.oauth.json` (chmod 600)

---

## WebSocket Protocol (typed messages)
See `docs/PROTOCOL.md` for full envelope and message types.

Key MVP message families:
- `auth.*` (login/start/complete/status)
- `status.get`
- `doctor.run`
- `update.create`, `update.apply`, `update.rollback`
- `loop.start`, `loop.status.get`, `loop.stop`
- streaming: `log.line`, `update.progress`, `verify.output`, `loop.*`

Auth: daemon-owned OAuth callback listener (HTTP loopback).

---

## Update Contract (two-phase)
### Phase A: Proposal (`update.create`)
Artifacts:
- `updates/<id>/request.json`
- `updates/<id>/plan.json`
- `updates/<id>/patch.diff`

### Phase B: Apply (`update.apply`)
Steps:
1) gate checks
2) apply patch
3) verify (npm test + build)
4) commit
5) write `verify.json`, `commit.txt`

---

## Safety gates (non‑negotiable)
- No apply without explicit apply command
- No writes outside repoPath
- Denylist `.git/**`, `.env`, `*.key`, `*.pem`, `**/*token*`, `**/*credentials*` (configurable)
- Require clean git tree unless `--autostash`
- Default change caps (files/LOC)
- Verify must pass to commit (unless explicit override in future)

---

## Continuous update loop (v0.1)
- `loop.start` authorizes auto-apply within safety limits
- Each iteration: plan → patch → apply → verify → commit
- On verify failure:
  - rollback to pre-iteration HEAD
  - **regenerate new plan/patch** using failure context
  - retry up to `retry` times
- Auto-stop on: max-iterations, max-minutes, stagnation, retry exhaustion, or user stop

---

## OpenAI Codex OAuth (v0.1)
- Native OAuth login via daemon-initiated PKCE
- CLI triggers `auth.login.start` → daemon returns authUrl
- Daemon owns callback listener + token storage
- Refresh required; failures surfaced clearly

---

## Zero-touch Installer (Ubuntu)
Command:
```bash
curl -fsSL https://github.com/deflagg/autobot/install.sh | bash
```
(Implementation will use raw URL.)

Installer must:
- install Node >= 22 automatically if missing
- install CLI/daemon (npm)
- create config + credentials dirs
- write systemd user service
- enable + start service
- verify `autobot status`

---

## Acceptance test (v0.1)
1) Install via one-command installer.
2) `autobot auth login` succeeds.
3) `autobot update --goal "add command hello"` returns updateId.
4) `autobot apply <id>` passes verify + commits.
5) `autobot hello` works.
6) `autobot rollback` restores previous state.
7) `autobot loop start --goal "improve hello"` runs multiple iterations; retry regenerates on failure.
