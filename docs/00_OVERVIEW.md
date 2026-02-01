# Autobot Architecture — Overview

## Mission
Build a reliable, safe personal automation agent that runs locally, can authenticate with an LLM provider, and delivers a straightforward chat experience (v0.1). The system favors correctness, recoverability, and explicitness over magic.

## Goals (v0.1)
- **Local-first**: all state lives on disk; nothing implicit in RAM.
- **Simple UX**: chat via `update.create` → `update.created` response.
- **Robust auth**: OAuth login + refresh + persistence.
- **Daemonized**: background service with a clear control surface.

## Non‑goals (for now)
- Autonomous self-edit/apply loops (though update/apply exists under the hood).
- Plugin ecosystem or remote control plane.
- Multi-user or hosted operation.

## Guiding principles
- **Explicit state**: anything important is written to disk.
- **Minimal surface**: small, auditable components over opaque automation.
- **Guardrails by default**: safety allow/deny lists already exist.
- **Diagnosable**: CLI doctor checks and predictable logs.

## Repo navigation (new set)
- 00_OVERVIEW.md
- 01_ARCHITECTURE.md
- 02_COMPONENTS.md
- 03_DATA_FLOWS.md
- 04_STATE_STORAGE.md
- 05_SECURITY_MODEL.md
- 06_DEPLOYMENT.md
- 07_PROTOCOL.md
- 08_DECISIONS.md
- 09_ROADMAP.md
