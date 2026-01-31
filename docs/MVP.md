# Autobot MVP (v0.1) — Requirements

## Goal
Build a local, single-user, always-on agent that can **self-edit its own repo** on explicit request via a **guardrailed update workflow**.

This MVP focuses on proving the *self-edit loop* is safe, testable, auditable, and reversible.

## Target environment
- Platform: **WSL2**
- Service manager: **systemd user service**
- Transport: **WebSockets over localhost only**
- Implementation stack: **Node.js + TypeScript**

## Core components
1) **Daemon** (always-on)
   - owns update lifecycle: plan → patch → apply → verify → commit → rollback
   - exposes a local WS API
2) **CLI** (thin client)
   - connects to daemon
   - sends typed requests
   - streams progress and prints results

## Configuration (required)
- Config file: `~/.autobot/config.json`
- Must include:
  - `repoPath` (absolute path, e.g. `/mnt/d/source/vscode/autobot`)
  - `ws.port` (default **18790**)
  - `auth.token` (random string, generated at install)
  - safety limits (max files/LOC) and denylist patterns
  - verification commands: `npm test`, `npm run build`

## Daemon requirements
- Listen on: `ws://127.0.0.1:<port>` (bind loopback only)
- Require auth token for all connections (see protocol)
- Operate on repo at `repoPath` (never assumes CWD)
- Enforce single active apply (queue or reject concurrent applies)
- Persist update artifacts under repo `updates/<updateId>/...`
- Emit streaming progress events over WS

## CLI requirements
Commands (MVP):
- `autobot status` — daemon connectivity + current repo commit + last update summary
- `autobot doctor` — repo/runtime/service checks
- `autobot update --goal "<text>"` — create proposal (plan+diff), return `updateId`
- `autobot apply <updateId>` — apply proposal + verify + commit
- `autobot rollback [<ref>]` — rollback last applied update (or to a ref)
- `autobot service install|uninstall`
- `autobot daemon start|stop|restart|logs` (systemctl/journalctl wrappers)

## Update Contract (required)
Two-phase by default:

### Phase A: Proposal (`update`)
Input: goal text.
Output artifacts under repo:
- `updates/<updateId>/request.json`
- `updates/<updateId>/plan.json`
- `updates/<updateId>/patch.diff`

### Phase B: Apply (`apply`)
Steps:
1) gate checks
2) apply patch
3) verify
4) commit

Output artifacts:
- `updates/<updateId>/verify.json`
- `updates/<updateId>/commit.txt`

## Safety gates (required)
- No apply without explicit `apply` step.
- No writes outside `repoPath`.
- Forbid edits to:
  - `.git/**`
  - secret-like files: `.env`, `*.key`, `*.pem`, `**/*token*`, `**/*credentials*` (configurable)
- Default change size caps (configurable), e.g. max files + max LOC.
- Require clean git tree unless explicit `--autostash`.
- If verify fails: do not commit; mark update failed; provide rollback guidance.

## Verification (required)
During apply, daemon runs from repo root:
- `npm test`
- `npm run build`

## Auditability (required)
- Every update is recorded in `updates/<updateId>/...`
- Daemon streams progress events during plan/patch/apply/verify/commit.

## MVP acceptance test
1) Install and start the systemd user service.
2) Run: `autobot update --goal "add command hello"` → returns `updateId`.
3) Run: `autobot apply <updateId>` → verify passes, commit created.
4) Run: `autobot hello` → prints hello.
5) Run: `autobot rollback` → returns to previous state.

## Non-goals (v0.1)
- Web UI
- Messaging channels
- Tool execution beyond repo edits
- Memory/embeddings
- Multi-user or remote access

---

## OpenAI Codex OAuth (required for MVP)

The MVP must be able to authenticate to **OpenAI Codex** using **OAuth**, similar to OpenClaw.

### Requirements
- Autobot MUST support **OpenAI Codex OAuth** as the primary auth method for LLM calls.
- Autobot MUST support a *reuse/import* path so users can leverage existing OpenClaw OAuth credentials, rather than implementing a full browser OAuth flow in v0.1.
- OAuth tokens MUST be stored outside the repo, local-only, with restricted permissions.
- Tokens MUST be redacted from logs and update artifacts.
- Token refresh MUST be supported; if refresh fails, the daemon must surface a clear remediation path.

### MVP approach (recommended)
- Provide an auth import command that reads OpenClaw credentials and writes/links them into Autobot:
  - `autobot auth import --from openclaw`
  - `autobot auth status`

### Storage
- Autobot stores credentials at:
  - `~/.autobot/credentials/oauth.json` (chmod 600)

### Verification
- `autobot doctor` includes an OAuth check (token present, refreshable).
- `autobot update --goal ...` can successfully call the Codex model using OAuth.

### Native OAuth login (required)
The MVP MUST provide a native login flow for OpenAI Codex OAuth.

#### UX
- `autobot auth login` triggers the daemon to begin OAuth.
- The daemon returns an authorization URL.
- The CLI opens the URL (best effort) or prints it for manual opening.
- Login completion results in stored tokens and a refreshable session.

#### Ownership
- The **daemon** owns the OAuth client state and token store.
- The **daemon** also owns the OAuth loopback callback listener (HTTP server).
- The **CLI** is the interactive frontend (start login, show URL, complete if needed, show status).

#### Flow
- Use Authorization Code + PKCE.
- Prefer loopback callback to a local HTTP listener **owned by the daemon** (daemon starts/stops the callback server and validates state/PKCE).
- If loopback callback is not reachable in WSL2, support a fallback completion step (manual copy/paste) **if supported by provider**.

#### Storage
- Store credentials outside the repo:
  - `~/.autobot/credentials/openai-codex.oauth.json` (chmod 600)
- Redact tokens from logs and update artifacts.

---

## Continuous self-update loop (required for MVP)

Autobot must support a daemon-run **continuous update loop** that keeps generating and applying incremental updates toward a user goal until the user stops it.

### CLI
- `autobot loop start --goal "<text>" [--max-iterations N] [--max-minutes M] [--retry N]`
- `autobot loop status`
- `autobot loop stop`

### Behavior
- Loop runs inside the **daemon** as a background job.
- Each iteration performs the standard update contract:
  1) plan
  2) patch
  3) gates
  4) apply
  5) verify
  6) commit
- Each iteration produces its own `updateId` and its own commit.

### Automatic apply authorization
- Starting the loop is an explicit authorization to automatically apply updates within configured safety limits.

### Failure handling (retry + rollback)
- On verify failure, the daemon MUST:
  - automatically rollback the working tree to the last known good commit (the pre-iteration HEAD)
  - for each retry attempt: regenerate a NEW plan+patch using the failure context (do not blindly reapply the same diff)
  - retry up to `retry` attempts per iteration (default TBD)
- The loop MUST stop if:
  - retries are exhausted
  - stagnation detected (no meaningful diff)
  - max-iterations reached
  - max-minutes reached
  - user requests stop

### Auditability
- Loop state is persisted, e.g. under `loops/<loopId>/state.json`, and references per-iteration `updates/<updateId>/...` artifacts.
- Commit messages include `loopId` and iteration number.

## Implementation stack (reference)
See [IMPLEMENTATION_STACK.md](./IMPLEMENTATION_STACK.md).

---

## Zero-touch installer (required)
See [INSTALLER.md](./INSTALLER.md).
