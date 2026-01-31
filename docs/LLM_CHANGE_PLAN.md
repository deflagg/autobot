# LLM Change Generation Plan (update.create)

## Goal
Wire the LLM into `update.create` so the daemon produces a **real plan** and **valid unified diff (change.diff)**.

---

## 1) Inputs & Context
**Inputs:**
- `goal` (user request)
- repoPath

**Context to gather:**
- repo tree (top-level + key folders)
- selected file contents (based on goal)
- constraints (denylist/allowlist, size caps)

**Suggested approach:**
- Start with minimal context: README, STATUS/NEXT/LOG, docs/PROTOCOL if needed
- If goal implies specific files, include those
- Limit context size; prefer targeted file reads

---

## 2) Model & Auth
- Use the **provider auth** to fetch a valid access token (`ensureValidToken`).
- Keep the model configurable (default in config; allow override in request payload later).

---

## 3) Prompt Contract
The LLM must output **two artifacts**:

1) **Plan JSON**
```json
{
  "goal": "...",
  "steps": ["...", "..."]
}
```

2) **Unified diff** (`change.diff`)
- Standard unified diff format
- Paths must be under repoPath
- Must respect allowlist/denylist

**Strict output format (recommended):**
```
<PLAN_JSON>
{...}
</PLAN_JSON>

<CHANGE_DIFF>
(diff here)
</CHANGE_DIFF>
```

---

## 4) Validation
- Parse JSON plan
- Validate diff format + paths
- Ensure no forbidden paths (reuse `ensureChangePathsAllowed`)
- Optional: cap total changed files/LOC (use config)

If validation fails:
- Re‑prompt with error context
- Abort after N attempts

---

## 5) Implementation Location
`packages/daemon/src/index.ts` → in `update.create` handler:
- Build context
- Call LLM
- Parse output
- Write `plan.json` + `change.diff`

---

## 6) Retry Strategy
- On invalid diff: retry prompt (max 2–3)
- On empty diff: return error `EMPTY_CHANGE`

---

## 7) Logging & Audit
- Log the prompt hash and model name (not raw prompt).
- Store plan + diff under `updates/<id>/`.

---

## 8) Future Enhancements
- Automatic file selection (LLM pre‑pass)
- Model‑guided context chunking
- Semantic diff validation

---

## Definition of Done
**Functional**
- `update.create` generates a **valid plan.json** and **change.diff** for a non‑trivial goal.
- `update.apply` succeeds with the generated change on a simple request (no manual edits).

**Safety / Validation**
- Invalid JSON or diff is **rejected with clear error**.
- **Allowlist/denylist** is enforced on generated diffs.
- Empty or no‑op diffs return **`EMPTY_CHANGE`**.

**Reliability**
- Retries occur on invalid output (max 2–3).
- Successful run is repeatable on two different goals.

**Audit / Traceability**
- `updates/<id>/` contains:
  - `request.json` (goal + metadata)
  - `plan.json`
  - `change.diff`
- Log includes model name + prompt hash (not raw prompt).

**User‑visible**
- CLI `autobot update "<goal>"` returns an updateId and artifacts exist.
- `autobot apply <id>` applies and verifies.
