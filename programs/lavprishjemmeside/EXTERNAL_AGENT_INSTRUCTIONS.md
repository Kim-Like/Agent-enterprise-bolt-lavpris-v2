# External Agent Instructions

This file is the execution contract for any external AI agent that only has access to `programs/lavprishjemmeside/`.

## Read This First

Read in this order before changing anything:

1. `README.md`
2. `PROJECT_CONTEXT.md`
3. `CHANGELOG.md`
4. `EXTERNAL_AGENT_INSTRUCTIONS.md`
5. `requirements.md`
6. `design.md`
7. `tasks.md`
8. `CPANEL_HANDOFF_CONTRACT.md`
9. `OUTSIDE_FOLDER_DEPENDENCIES.md`
10. `ROLLBACK_AND_REPAIR.md`
11. `DOCUMENT_AUTHORITY_MAP.md`

## Hard Scope Boundary

- You may only modify files inside `programs/lavprishjemmeside/`.
- You may not create new paths outside this folder.
- You may not invent substitute services, fake integrations, or parallel ownership for systems that live outside this folder.
- If a feature depends on something outside this folder, stop and record a blocker plus a handoff note.

## Execution Authority

- `requirements.md`, `design.md`, and `tasks.md` are the canonical V2 planning set.
- `CPANEL_HANDOFF_CONTRACT.md` defines exactly how you hand DB, env, and live-execution work back to the operator.
- `CHANGELOG.md` and `local-mirror/CHANGELOG.md` are mandatory release records.
- `DOCUMENT_AUTHORITY_MAP.md` tells you which docs are canonical, reference, or historical.

Do not treat internal/operator reference docs as the sprint source of truth when they conflict with the canonical in-folder trilogy.

## Non-Negotiable Rules

### Rule 1: Work Phase-By-Phase

- Execute phases in the order defined in `tasks.md`.
- Do not skip forward.
- Do not merge multiple phases into one unstructured change set.

### Rule 2: Update Both Changelog Copies

If you change behavior, flow, data expectations, operator instructions, or user-visible UI:

- update `CHANGELOG.md`
- update `local-mirror/CHANGELOG.md`

If you believe no changelog entry is needed, say so explicitly in your handoff.

### Rule 2A: Update Handoff Artifacts For Every New Contract

If you change a structured contract, you must leave behind updated handoff documentation in the Lavprishjemmeside folder.

Structured contracts include:

- **Database schema**: table structure, columns, indexes, foreign keys, enums
- **Seed data behavior**: default rows, component library entries, system settings
- **API request/response contracts**: route signatures, payload shapes, status codes
- **Environment variable contracts**: new required vars, changed var names, changed value formats
- **Workflow contracts**: install sequences, wizard steps, rollout order, publish behavior
- **Outside-folder contracts**: Agent Enterprise routes, packet shapes, telemetry expectations

Minimum documentation requirements per contract type:

- **Database or seed changes**: update `local-mirror/docs/SCHEMA_OVERVIEW.md` with the new tables, columns, or seed expectations
- **API, proxy, auth, or request/response changes**: update the relevant doc under `local-mirror/docs/` or create a new contract doc if none exists
- **Env contract changes**: document the new variables, their purpose, expected format, and which sites need them
- **Wizard, install, rollout, or operational flow changes**: update the corresponding handoff doc (`ROLLOUT_MANUAL.md`, `SSH_FIRST_OPERATIONS.md`, `UPSTREAM_UPDATES.md`, `CLIENT_ASSISTANT_ARCHITECTURE.md`)
- **Shop or commerce contract changes**: update `SHOPPING_MODULE_PLAN.md` or the shop sections of `SCHEMA_OVERVIEW.md`
- **Outside-folder dependency changes**: update `OUTSIDE_FOLDER_DEPENDENCIES.md` with the dependency, expected interface, and handoff action

No phase is complete if the code introduces a new schema, interface, env requirement, or workflow expectation that exists only in code and not in the handoff docs.

Documentation updates must be specific, not vague. Saying "updated docs" without listing which files were changed and what contracts they now describe is not sufficient.

### Rule 2B: Missing Documentation Means The Phase Failed

If you change behavior and do not update both changelog copies, the phase is incomplete.

If you change a schema, API contract, env contract, workflow rule, or operator expectation and do not update the handoff docs, the phase is incomplete.

### Rule 3: Do Not Claim Operator Work Complete

You must not claim any of these are complete:

- live rollout
- SSH deploy
- cPanel verification
- Tailscale Funnel work
- launchd or Mac-host service changes
- `npm run lavpris:release-health`

Those are operator-owned or outside-folder tasks unless explicitly mirrored into this folder as documentation only.

### Rule 3A: Hand cPanel Work Back Using The Operator Contract

If your phase requires database changes, seed data, env/config changes, SSH execution, or live verification on cPanel:

- prepare the operator packet using `CPANEL_HANDOFF_CONTRACT.md`
- hand over exact SQL files or SQL patches, not a vague summary
- include run order, affected sites, verification queries, rollback notes, and any required env/config deltas
- stop at the operator boundary instead of inventing an alternative runtime path

### Rule 4: No Fake Integrations

If a dependency is outside this folder:

- document the dependency
- document the expected interface
- document the blocker
- stop at the handoff boundary

Do not create a local fake replacement just to keep going.

### Rule 5: Respect the Existing Architecture

Do not reintroduce:

- the retired CMS-side `personal-agent` path
- generic client access to provider/model switching
- new infrastructure paths that bypass the documented architecture

## Outside-Folder Handling

Before touching a feature that mentions Agent Enterprise server code, repo-root commands, secrets, Tailscale, launchd, or cPanel runtime details, check `OUTSIDE_FOLDER_DEPENDENCIES.md`.

If the dependency is listed there:

1. implement only the in-folder part
2. stop at the documented boundary
3. record the outside-folder follow-up in your phase handoff

## Required Per-Phase Handoff Format

Use this exact structure at the end of every phase:

```md
## Phase <N> Handoff

### Completed
- <concrete completed change>

### Files Changed
- <path>

### Tests And Checks
- <command or manual check>
- <result>

### Handoff Artifacts
- <updated schema/contract/runbook docs>

### cPanel / Operator Handoff
- <none> or <operator packet prepared per CPANEL_HANDOFF_CONTRACT.md>

### Blockers
- <none> or <specific blocker>

### Outside-Folder Follow-Ups
- <none> or <specific dependency and required owner action>

### Changelog
- root changelog: updated / not needed
- local-mirror changelog: updated / not needed
```

## Completion Conditions

You may only claim the sprint implementation complete when:

- every phase has a handoff
- changelog discipline was followed
- blockers are explicit
- outside-folder follow-ups are explicit
- every required cPanel/operator packet is explicit
- rollback and repair guidance still reflects the last known good baseline

You may not claim the estate is live, production-verified, or fully released.
