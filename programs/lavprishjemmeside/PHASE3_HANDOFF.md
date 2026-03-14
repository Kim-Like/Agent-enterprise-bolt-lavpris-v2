# Phase 3 Handoff: Installation Hardening and Assistant Wizard Refinement

> Status: complete. All agent-owned work for Phase 3 is finished. Live DB/env/SSH steps remain operator-owned per `CPANEL_HANDOFF_CONTRACT.md`.

---

## Files Changed

| File | Change type | Description |
|------|-------------|-------------|
| `local-mirror/scripts/setup.cjs` | Rewrite | Full hardening: state persistence, retry, validation, recovery |
| `local-mirror/api/run-schema.cjs` | Rewrite | Per-statement execution, idempotency, structured errors, expanded schema order |
| `local-mirror/src/pages/admin/assistant.astro` | Rewrite | Per-step validation, scoped CSS, recovery state, XSS helper |
| `local-mirror/docs/INSTALL_OPERATOR_PACKET.md` | New | cPanel operator packet for new-client installs |
| `local-mirror/CHANGELOG.md` | Updated | Phase 3 entries added under `[Unreleased]` |
| `CHANGELOG.md` (root) | Updated | Phase 3 entries mirrored |

---

## Contract Checks

| Contract | Changed? | Notes |
|----------|----------|-------|
| Database schema | No | No new migrations |
| Seed data | No | No new seed files |
| API routes | No | No new or changed endpoints |
| Environment variables | No | No new env vars added or renamed |
| Workflow / install sequence | Documentation only | `INSTALL_OPERATOR_PACKET.md` added to codify existing operator steps |
| Outside-folder dependencies | No | Agent Enterprise provisioning unchanged |

---

## What Changed and Why

### `scripts/setup.cjs` — Installer hardening

**Before:** No recovery path if interrupted. No retry on npm install or Astro build failure. Silent failure modes. Health poll capped at 60s with no last-error reporting.

**After:**

- **State persistence** via `.setup-state.json` — each completed step is recorded. Re-running skips done steps.
- **`--reset` flag** — clears state file to force a clean restart.
- **`execWithRetry(label, cmd, opts, retries = 2)`** — wraps shell commands with configurable retry, 3s delay between attempts.
- **Input validation** — `validateRequired()` and `validateUrl()` reject empty or malformed inputs before the install begins.
- **Resume-aware prompts** — pre-fill from `state.lastVars` so partial runs don't re-ask for values already confirmed.
- **Health polling** extended to 90s, returns `{ ok, lastStatus }`, captures API stderr to show operators what failed.
- **Agent Enterprise provisioning** retried up to 3× with 4s between attempts. Provisioned keys (`SITE_KEY`, `SITE_TOKEN`, `CLIENT_AGENT_ID`) saved to state for resume.
- **JWT secret** preserved in state to avoid regeneration mid-run.
- **Numbered step headers** — `[1/10] Installing dependencies` pattern with skip labels when resuming.
- **Repair guidance** on every error — each step failure prints the specific action needed.
- **Actionable operator summary** at end — 5 numbered next-steps for post-install live work.
- **FATAL handler** at bottom — tells operator to re-run to resume, explains state file.

### `api/run-schema.cjs` — Schema runner hardening

**Before:** `multipleStatements: true` meant the entire file ran as one batch — errors were hard to pinpoint. Missing files were silently skipped. No per-statement error context.

**After:**

- **`multipleStatements: false`** — each statement runs individually for isolation.
- **`splitStatements(sql)`** — line-by-line splitter respecting `DELIMITER` blocks (stored procedures, triggers).
- **`IDEMPOTENT_CODES` Set** — `ER_TABLE_EXISTS_ERROR`, `ER_DUP_FIELDNAME`, `ER_DUP_KEYNAME`, `ER_KEY_COLUMN_DOES_NOT_EXISTS`, `ER_CANT_DROP_FIELD_OR_KEY` treated as safe-to-skip.
- **`isIdempotentError(err)`** — also checks message patterns for `duplicate`, `already exists`, `can't drop`.
- **`checkConnection(config)`** — validates DB before running anything; connection-failure error clearly says to check credentials, host, and network.
- **Missing-file warnings** — explicit `WARNING: <file> not found — skipping` instead of silent skip.
- **Per-file timing and counts** — `[schema] filename.sql — applied: 12, skipped: 3 (142ms)`.
- **Wrapped errors** — non-idempotent failures carry `schemaFile`, `statementIndex`, `statementPreview`, `originalCode`.
- **Post-run summary** — `Files OK / Files empty / Files missing` printed after all files run.
- **Expanded `SCHEMA_ORDER`** — 27 files now in order (was 16); newly covered: `schema_master_role.sql`, `schema_master_task_md.sql`, `schema_media_v2.sql`, `schema_modern_mega.sql`, `schema_overlap_module.sql`, `schema_immersive_content_visual.sql`, `schema_add_product_carousel_sticky_column.sql`, `schema_ai_prompt_avanceret.sql`, `schema_shop.sql`, `schema_migrate_immersive_visual.sql`, `schema_component_versions.sql`.
- **`SEED_FILES` array** — structured with `{ file, label }` for clear reporting.

### `src/pages/admin/assistant.astro` — Wizard hardening

**Before:** No per-step validation — operator could reach activation without filling required fields. Tailwind `hidden` class used for visibility (unreliable with SSR purge). No step-progress feedback. Errors not dismissable.

**After:**

- **Full scoped CSS** — all Tailwind dependencies removed. Inline `<style>` block owns all admin UI styling.
- **`STEP_REQUIRED_FIELDS` map** — defines which fields are required per wizard step, with field/error element IDs.
- **`validateStep(step)`** — adds `.invalid` to inputs and `.visible` to error spans; returns `false` if any field is empty.
- **`clearStepErrors(step)`** — removes `.invalid` and `.visible` when navigating away.
- **`setWizardStep(nextStep, skipValidation)`** — forward navigation blocked until `validateStep()` passes; backward navigation always allowed (`skipValidation = true`).
- **Step progress indicators** — `.active` (amber), `.complete` (green + ✓ checkmark), `.error-state` (red) applied via `classList`.
- **Dismissible error banner** — `×` close button calls `window.dismissConfigError()`.
- **Activation error recovery** — button re-enabled on failure, user stays on step 4 to retry.
- **Chat refresh feedback** — `chatStatusEl.textContent = 'Refreshing…'` → `'Refreshed.'` on complete.
- **`escHtml(str)`** helper — sanitizes user-supplied strings before DOM insertion.
- **`hidden-el` class** — `display: none !important` replaces Tailwind `hidden`; JS uses `element.style.display` to override.
- **All existing API logic preserved** — `apiFetch`, `authHeaders`, `refreshAssistant`, `loadAssistantConfig`, send/receive chat, ticket submit.

---

## Operator Actions Required

The following live steps cannot be performed by the agent. Execute from `INSTALL_OPERATOR_PACKET.md`:

| # | Action | When |
|---|--------|------|
| 1 | Create MySQL DB and user in cPanel | Before running installer |
| 2 | Set up Node.js App in cPanel | Before running installer |
| 3 | Point `api.<domain>` DNS | Before running installer |
| 4 | Clone repository over SSH | Before running installer |
| 5 | Run `node scripts/setup.cjs` | Install time |
| 6 | Set document root to `dist/` in cPanel | After installer completes |
| 7 | Touch restart trigger | After any `.env` or code change |
| 8 | Register Flatpay webhook | After install (shop only) |
| 9 | Set `FLATPAY_TEST_MODE=false` | When going live with payments |

---

## Regression Notes

- All existing installer prompts preserved — existing operators will see the same questions in the same order.
- Schema runner SEED_FILES now includes both `seed_components_v2.sql` and `seed_master.sql` explicitly (were previously ad-hoc runs).
- Wizard step IDs and field names are unchanged — no API contract impact.
- No schema migrations were added or changed.

---

## Rollback

Phase 3 changes are presentation and tooling only. Rollback by reverting the three changed files:

- `scripts/setup.cjs` — restore from `baselines/2026-03-14/` or Git
- `api/run-schema.cjs` — restore from `baselines/2026-03-14/` or Git
- `src/pages/admin/assistant.astro` — restore from `baselines/2026-03-14/` or Git

No schema, API, or env rollback required.

---

## Next Phase

**Phase 4: Ecommerce Major Uplift**

Scope (from `tasks.md`):
- Storefront browse, product detail, cart, and checkout confidence
- Admin catalog, variants, media, shipping, discounts, settings, and orders workflows
- Assistant support for commerce workflows
- Schema/API docs for any commerce contract changes
- cPanel/operator packets for live SQL, config, and verification
