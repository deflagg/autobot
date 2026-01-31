# ADR-0001: Self-modifying agent (Approach B)

Date: 2026-01-30

## Decision
Build **autobot** as a CLI-first agent that can **modify its own local source code** on demand.

Self-update operations follow a guardrailed pipeline:
1) user intent/goal
2) proposed plan
3) diff preview
4) apply changes
5) run tests/build
6) commit (checkpoint)
7) restart (if needed)
8) rollback available

## Why
- Maximizes flexibility (any feature can be added via code changes)
- Keeps runtime small and auditable
- Git provides robust checkpoints and rollback

## Alternatives considered
- Plugin-only architecture (Approach A)
- Pulling upstream updates only (no local codegen)

## Consequences
- Requires strict safety gates to avoid bricking the repo.
- Must keep build/test fast to encourage frequent checkpoints.
