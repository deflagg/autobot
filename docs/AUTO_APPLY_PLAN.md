# Auto-Apply in Chat Mode — Implementation Plan

## Goal
Enable `autobot chat` to automatically apply generated updates (build/test/commit) so users can just type goals without manual `apply` steps.

## UX
Primary flag:
- `autobot chat --apply` (auto-apply every update)

Optional extension (future):
- `--apply=ask` to confirm before each apply

## Behavior
For each chat goal:
1. Send `update.create` (generate plan + change)
2. On `update.created`, if `--apply` is enabled, send `update.apply` with the returned `updateId`
3. Report `update.applied` (commit hash) or error

## Safety
- Keep existing protections intact:
  - clean git tree check
  - allowlist/denylist enforcement
  - build + test verification
- Auto-apply should **not** override failures (surface error and stop for that goal)

## Implementation Steps
1. **CLI flag parsing**
   - Detect `--apply` in `autobot chat` args
   - Store `autoApply = true/false`

2. **Chat response handling**
   - When `update.created` message arrives:
     - if `autoApply`, send `update.apply` with `updateId`
   - Print user-friendly output for:
     - `update.created`
     - `update.applied`
     - errors

3. **Docs**
   - Add to README:
     - Example: `autobot chat --apply`
     - Explain auto-apply behavior briefly

## Definition of Done
- Running `autobot chat --apply` applies each generated update automatically
- No manual `autobot apply` required
- Existing safety checks still enforced
