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
