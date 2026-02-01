# Chat-Only UX — Implementation Plan

## Goal
Make `autobot chat` the primary interaction model. Users type prompts; the agent generates, applies, tests, and commits each change automatically.

## UX
- `autobot chat`
- User types a **prompt** per line
- Auto-apply is always on in chat mode

## Behavior
For each prompt:
1. Send `update.create` (generate plan + change)
2. On `update.created`, immediately send `update.apply`
3. Report `update.applied` (commit hash) or error

## Safety
- Keep existing protections intact:
  - clean git tree check
  - allowlist/denylist enforcement
  - build + test verification
- If build/test fails, report error and move on

## Implementation Steps
1. **CLI**: remove update/apply/rollback commands from the public surface
2. **Chat loop**: always auto-apply after update creation
3. **Docs**: describe chat-only UX

## Definition of Done
- Running `autobot chat` generates + applies + tests + commits automatically
- No manual update/apply commands are exposed
