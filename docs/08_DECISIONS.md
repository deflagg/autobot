# Architecture Decisions

(Keep this concise. Add dated entries as decisions are made.)

### 2026-02-01 — Chat UX uses update.create
- **Decision:** Chat is implemented via `update.create`/`update.created` rather than a separate chat message type.
- **Why:** Reuse existing update pathway while keeping chat-only UX.
- **Alternatives:** Separate `chat.request`/`chat.response` types.
- **Consequences:** Protocol still exposes update/apply/rollback even if not used in UX.

### 2026-02-01 — OAuth tokens stored locally
- **Decision:** Store tokens in `~/.autobot/auth-profiles.json` with an `auth.lock`.
- **Why:** Local-first and explicit state.
- **Alternatives:** In-memory only or remote store.
- **Consequences:** Must protect local files; easier recovery.
