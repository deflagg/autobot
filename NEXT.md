# Next

## P0 (now)
- [ ] Specify continuous update loop (start/status/stop) with automatic rollback+retry.
- [ ] Specify native OpenAI Codex OAuth login (daemon-initiated, CLI-driven).
- [ ] Add OpenAI Codex OAuth requirements (reuse/import OpenClaw credentials).
- [ ] Review and approve docs/MVP.md and docs/PROTOCOL.md (massage requirements).
- [ ] ADR: Approach B self-modification pipeline + safety gates.
- [ ] Define minimal guardrails contract: plan → diff → apply → test → commit → restart.
- [ ] Implement `autobot self-update --goal ...` v1:
  - [ ] generate change plan (LLM later)
  - [ ] apply edits through a single editor module
  - [ ] run `npm test` + `npm run build`
  - [ ] commit with a templated message
  - [ ] write to `LOG.md` + update `STATUS.md`
- [ ] Add rollback command: `autobot rollback` (reset to last tag/commit).

## P1
- [ ] Add `autobot chat` interactive loop (local) as the user interface.
- [ ] Add structured audit log (JSONL) for updates.
- [ ] Add file-level allowlist for self-edits (e.g., forbid editing `.env`, `.git/`).
