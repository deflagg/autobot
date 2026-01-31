# Implementation Plan (Iterative)

This plan breaks v0.1 into small, shippable iterations. Each iteration ends with a demoable outcome and repo checkpoint.

## Iteration 0 — Project skeleton + scaffolding
**Goal:** establish structure without business logic.

Deliverables:
- Monorepo layout: `packages/{daemon,cli,protocol,core}`
- Base TS config + build scripts
- Shared config loader (no secrets yet)
- Basic WS client/server stubs (no auth)

Exit criteria:
- `npm run build` passes
- `autobot status` (stub) prints “daemon not running”

---

## Iteration 1 — Daemon WS baseline
**Goal:** always-on daemon reachable via WS.

Deliverables:
- Daemon runs and binds `127.0.0.1:18790`
- CLI connects and executes `status.get`
- Typed message envelope + runtime validation (Zod)

Exit criteria:
- `autobot daemon start` → WS reachable
- `autobot status` returns daemon info

---

## Iteration 2 — Config + auth token
**Goal:** secure local channel + config-driven repoPath.

Deliverables:
- `~/.autobot/config.json` loader + defaults
- `auth.token` required for WS connection
- CLI auto-reads token and authenticates

Exit criteria:
- Unauthenticated requests are rejected
- Authenticated `status.get` works

---

## Iteration 3 — OAuth login flow (OpenAI Codex)
**Goal:** native OAuth login with daemon-owned callback.

Deliverables:
- `autobot auth login` → daemon returns auth URL
- Daemon owns loopback HTTP callback listener
- Token storage + refresh
- `auth.status.get`

Exit criteria:
- `autobot auth login` succeeds
- `autobot auth status` reports refreshable

---

## Iteration 4 — Update proposal (plan+diff artifacts)
**Goal:** generate proposal artifacts without applying.

Deliverables:
- `update.create` creates:
  - `request.json`, `plan.json`, `patch.diff`
- Plan/diff stored under `updates/<id>/...`

Exit criteria:
- `autobot update --goal ...` returns updateId
- Artifacts exist

---

## Iteration 5 — Apply/verify/commit + rollback
**Goal:** complete self-edit loop for a trivial change.

Deliverables:
- Gates enforced (denylist, clean tree, size caps)
- Apply patch, run verify (`npm test`, `npm run build`)
- Commit + rollback command

Exit criteria:
- `autobot apply <id>` creates commit
- `autobot rollback` restores previous state

---

## Iteration 6 — Continuous update loop
**Goal:** daemon-run loop with retry+rollback.

Deliverables:
- `loop.start/status/stop`
- Retry regenerates plan/patch
- Loop state persisted

Exit criteria:
- `loop.start` runs multiple iterations
- On verify failure, rollback + regenerate occurs

---

## Iteration 7 — Installer + service
**Goal:** zero-touch install and always-on service.

Deliverables:
- `install.sh` (non-interactive)
- systemd user service template
- `autobot service install` + `daemon start/stop/status/logs`

Exit criteria:
- One-command install provisions daemon + CLI + config
- `autobot status` works after install

---

## Iteration 8 — Harden + polish
**Goal:** reduce failure modes.

Deliverables:
- Better error codes + user messages
- Stagnation detection in loop
- Audit log summaries

Exit criteria:
- MVP acceptance test passes end-to-end

