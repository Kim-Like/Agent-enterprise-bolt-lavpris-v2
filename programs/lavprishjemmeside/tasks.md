# Lavprishjemmeside V2.0 Tasks

## Sprint Rules

- Execute phases in numeric order only.
- Treat this file as the canonical V2 execution plan.
- Modify files only inside `programs/lavprishjemmeside/`.
- Update both Lavprishjemmeside changelog copies for behavior changes.
- Update schema, API, env, and workflow docs when contracts change.
- Hand cPanel/SSH/database work back to the operator using `CPANEL_HANDOFF_CONTRACT.md`.
- Do not invent substitute databases, orchestrators, provider routers, or runtime paths.
- Do not claim rollout, release-health, or production verification complete.

## Phase 0: Baseline Freeze, Rollback Package, and Operator Safety

### Objective

Freeze the current working version so the sprint can move fast without losing a safe recovery path.

### Product Intent

This phase exists to make ambition safe. The external agent must know what “last known good” means before it starts changing a complex production-connected system.

### Detailed Implementation Lanes

- capture the current parent and `ljdesignstudio.dk` health state
- record current local-mirror baseline references
- confirm the rollback-and-repair contract
- define the critical flows that decide repair vs rollback
- define the operator backup expectations for cPanel repo state, databases, and env preservation

### In-Folder Scope

- `ROLLBACK_AND_REPAIR.md`
- `baselines/`
- any root docs that point to rollback behavior

### Outside-Folder Dependencies

- cPanel repo archives
- live database dumps
- live env backups
- live health endpoints

### Required Handoff Artifacts

- rollback runbook
- baseline snapshot artifacts
- operator pre-rollout backup checklist

### Acceptance Checks

- the parent and pilot-client baseline is explicit
- critical flows are explicit
- repair-first and rollback triggers are explicit
- the operator backup expectations are written

### Hard Stop Conditions

- the live baseline cannot be verified
- rollback still depends on unwritten operator knowledge

## Phase 1: Documentation Authority Reset and Handoff Hardening

### Objective

Make the Lavprishjemmeside folder the true canonical V2 source for the external sprint.

### Product Intent

The external agent should never have to guess where authority lives. This phase removes documentation ambiguity and makes the folder self-contained as a handoff package.

### Detailed Implementation Lanes

- create the canonical in-folder V2 trilogy
- remove redundant mirror-plan files that duplicate or blur the canonical in-folder trilogy
- remove any remaining references to alternate planning locations outside this folder
- refresh read order, startup prompt, authority map, and execution contract
- strengthen contract-documentation rules
- strengthen reference/historical labeling where needed
- introduce the cPanel/operator handoff contract as first-class documentation

### In-Folder Scope

- root planning docs
- root handoff docs
- local-mirror docs and task-index warnings if needed

### Outside-Folder Dependencies

- repo-root validation tool references

### Required Handoff Artifacts

- canonical in-folder trilogy
- updated startup prompt
- updated authority map
- cPanel/operator handoff contract

### Acceptance Checks

- only one canonical V2 planning set exists for the external agent, and it is inside this folder
- startup guidance points to the in-folder trilogy
- non-authoritative docs no longer compete with canonical docs

### Hard Stop Conditions

- authority remains split
- the startup prompt still sends the agent to a compressed or secondary plan

## Phase 2: Major Design/Admin Uplift Foundation

### Objective

Restore the stronger V2 product ambition by defining a real step up in the admin and operator experience.

### Product Intent

V2 should feel like a stronger product, not just a safer sprint. This phase brings back ambition around dashboard, master, admin shell, and overall product feel.

### Detailed Implementation Lanes

- define the upgraded visual and interaction direction for dashboard and master
- improve admin shell, navigation, density, and state design
- identify which parts of the earlier richer V2 vision should actively return
- turn the old ambition into current implementation lanes rather than nostalgia
- update the docs so this product ambition is explicit and executable

### In-Folder Scope

- canonical V2 docs
- relevant local-mirror admin UI/docs

### Outside-Folder Dependencies

- none for the planning/design direction itself

### Required Handoff Artifacts

- updated requirements/design/tasks language for the uplift
- any dependency notes if later implementation needs outside-folder telemetry

### Acceptance Checks

- V2 now clearly includes a stronger design/admin ambition
- the uplift has concrete implementation lanes, not only aesthetic language
- no unrelated scope has been silently reintroduced

### Hard Stop Conditions

- the uplift remains vague
- old V2 scope is copied forward without current-system filtering

## Phase 3: New-Client Installation Hardening and Assistant Wizard Refinement

### Objective

Make setup more reliable technically and more confidence-building experientially.

### Product Intent

Installation and onboarding are part of the product. They must be resilient, explicit, and polished, while staying honest about operator-owned live work.

### Detailed Implementation Lanes

- harden installer sequencing and retry behavior
- improve failure reporting and partial-install recovery logic
- define base-site rollout validation in the install contract
- refine assistant wizard steps, validation, preview, and recovery behavior
- make the wizard feel more intentional without weakening guardrails
- prepare cPanel/operator packets for any live install DB/env steps

### In-Folder Scope

- `local-mirror/scripts/setup.cjs`
- `local-mirror/api/run-schema.cjs`
- assistant setup UI and related local routes/docs

### Outside-Folder Dependencies

- live cPanel database execution
- live env writes
- live SSH rollout
- outside-folder Agent Enterprise packet persistence/orchestration

### Required Handoff Artifacts

- installer contract updates
- schema/run-order updates
- wizard flow updates
- cPanel/operator packets for any live install actions

### Acceptance Checks

- installer logic is explicit and retry-safe
- wizard flow is clearer, stricter, and more recoverable
- any live DB/env steps have operator packets instead of local workarounds

### Hard Stop Conditions

- installer still depends on silent manual repair
- wizard depends on undocumented outside-folder packet behavior

## Phase 4: Ecommerce Major Uplift

### Objective

Raise the first-party shop from “implemented” to a more credible professional commerce product.

### Product Intent

Commerce is one of the most visible V2 value lanes. The shop should inspire more trust, support better conversion flow, and feel stronger operationally for admins.

### Detailed Implementation Lanes

- improve storefront browse, product-detail, cart, and checkout confidence
- refine or add product customization controls where the existing data model supports them
- improve admin workflows for catalog, variants, media, shipping, discounts, settings, and orders
- strengthen assistant support for commerce workflows
- update schema/API docs for any commerce contract changes
- prepare cPanel/operator packets for live SQL, config, and verification work

### In-Folder Scope

- shop pages and components
- admin shop pages
- cart scripts
- shop routes and services
- shop schema docs and commerce docs

### Outside-Folder Dependencies

- live Flatpay / Frisbii credentials
- live webhook registration
- live cPanel rollout and payment verification

### Required Handoff Artifacts

- updated commerce docs
- updated schema docs for commerce changes
- SQL/operator packet for any schema changes
- live verification checklist for payment-path testing

### Acceptance Checks

- storefront and admin commerce UX improve materially
- any product customization feature is backed by real structures
- payment and webhook contracts remain safe
- the operator could execute the live portion from the handoff packet

### Hard Stop Conditions

- uplift requires inventing a new commerce platform
- payment or webhook behavior would break without a safe operator-verified path

## Phase 4.1: Ecommerce Functional Depth — Commerce-First Client Readiness

### Objective

Raise the first-party shop from a functional MVP to a credible commerce product capable of supporting a client whose primary business runs through the shop.

### Product Intent

A commerce-first client assessment found the shop is production-ready for small catalogs with simple shipping needs but would not survive a client who relies heavily on ecommerce. The gaps are functional, not visual. Phase 4 fixed the CSS. Phase 4.1 fixes the product.

Three categories of clients are unblocked by this phase: clients migrating from WooCommerce or a hosted Shopify plan, clients with 50+ SKU catalogs, and clients who need to process refunds and manage stock reliably at scale.

### Detailed Implementation Lanes

Tiers are ordered by priority. Tier 1 are blockers. Tier 2 are strong differentiators. Tier 3 are nice-to-have.

**Tier 1 — Blockers:**
- build admin shop dashboard page that surfaces the existing `/shop/admin/dashboard` KPIs: revenue, orders, pending/to-ship counts, recent orders, top products, and low-stock alerts
- implement inventory reservation at checkout: `stock_reservations` table, `POST /shop/cart/reserve` endpoint called before Flatpay session creation, lazy expiry sweep on each reservation call, available-stock calculation in product detail endpoint
- add storefront product search: `GET /shop/search` endpoint using the existing MySQL fulltext index, `SearchBar.astro` component with debounced dropdown, injected into header and shop index
- add refund and return workflow: `POST /shop/admin/orders/:id/refund` endpoint with optional stock restoration and customer email, refund modal in admin orders UI, `order_events` audit entry
- add order notes: customer-facing note field at checkout stored in new `customer_note` column, internal admin note input stored as `order_events` entries displayed in event timeline

**Tier 2 — Strong Differentiators:**
- shipping zones: extend `shipping_methods` with `countries JSON NULL` column; filter methods by country at checkout; admin UI country selector per method
- customer accounts (light): registration, login, session-based auth, order history page; guest checkout flow unchanged
- storefront product filters: price range, in-stock toggle, and sort options on category pages via new `ProductFilters.astro` component; backed by extended `GET /shop/products` query params
- email template customization: `email_templates` DB table, admin editor page, `{{variable}}` token replacement, hardcoded fallback if table is empty

**Tier 3 — Nice to Have:**
- back-in-stock notifications: opt-in email list per product/variant, triggered on stock restoration via refund
- abandoned cart recovery: cart session capture with optional email, operator-triggerable reminder cron endpoint
- product reviews: star rating + comment submission, admin moderation, display on product detail
- bulk product import/export: CSV download and upload by SKU

### In-Folder Scope

- `local-mirror/src/pages/admin/shop/dashboard.astro` (new)
- `local-mirror/src/pages/admin/shop/emails.astro` (new)
- `local-mirror/src/pages/admin/shop/orders.astro` (refund modal + note section)
- `local-mirror/src/pages/shop/checkout.astro` (reserve call + customer note field)
- `local-mirror/src/pages/shop/produkt/[slug].astro` (available_stock usage)
- `local-mirror/src/pages/shop/index.astro` (SearchBar injection)
- `local-mirror/src/pages/shop/konto/` (customer account pages — Tier 2)
- `local-mirror/src/components/SearchBar.astro` (new)
- `local-mirror/src/components/ProductFilters.astro` (new — Tier 2)
- `local-mirror/src/components/Header.astro` (SearchBar injection)
- `local-mirror/src/layouts/AdminLayout.astro` (shop dashboard nav link)
- `local-mirror/api/src/routes/shop-public.cjs` (new endpoints)
- `local-mirror/api/src/routes/shop-admin.cjs` (new endpoints)
- `local-mirror/api/src/services/shop-email.cjs` (DB template loading — Tier 2)
- `local-mirror/api/src/schema_stock_reservations.sql` (new)
- `local-mirror/api/src/schema_order_notes.sql` (new)
- `local-mirror/api/src/schema_shipping_zones.sql` (new — Tier 2)
- `local-mirror/api/src/schema_customer_accounts.sql` (new — Tier 2)
- `local-mirror/api/src/schema_email_templates.sql` + seed (new — Tier 2)

### Outside-Folder Dependencies

- live cPanel MySQL: schema migrations require operator SSH execution via `node api/run-schema.cjs`
- live Flatpay / Frisbii: no new webhook events; existing `charge_settled` handler updated to release reservations
- live Resend credential: no new credential; new refund and back-in-stock email templates use the existing service

### Required Handoff Artifacts

- `PHASE4.1_HANDOFF.md` (complete planning document — already written)
- per-tier SQL operator packets with run-order notes for `api/run-schema.cjs`
- updated `CHANGELOG.md` (root) and `local-mirror/CHANGELOG.md` under `[Unreleased]`
- regression note confirming existing checkout, order, and payment flow is unchanged
- API contract notes for each new or extended endpoint

### Acceptance Checks

- shop dashboard page renders live KPIs from the existing API
- simultaneous checkout of the last unit results in only one successful reservation
- storefront search returns products by name, description, or SKU
- refund action records an audit event, optionally restores stock, and sends a customer email
- customer note at checkout is stored and visible in admin
- internal admin notes display in the order event timeline
- all new schema files are idempotent
- no existing API contract changed without a backwards-compatible extension
- `CHANGELOG.md` updated before handoff

### Hard Stop Conditions

- inventory reservation must not require an external scheduler
- customer accounts must not break the guest checkout flow
- refund workflow must not delete or alter existing order rows
- no payment or webhook contract may change without explicit operator verification

---

## Phase 5: CMS/Admin Productivity Uplift and Selected Old-V2 Improvements

### Objective

Recover the strongest useful parts of the earlier richer V2 vision inside the current architecture.

### Product Intent

The old V2 plan had real value in how it described dashboard, pages, design-system, and component productivity. This phase restores that value in a disciplined, current-system form.

### Detailed Implementation Lanes

- improve dashboard usefulness and presentation
- improve master-side workflow clarity
- improve page/design-system/components productivity lanes
- improve assistant and AI workflow polish where it supports the CMS
- keep the restored ambition selective, not sprawling

### In-Folder Scope

- dashboard/master surfaces
- relevant pages/design-system/components surfaces
- canonical V2 docs

### Outside-Folder Dependencies

- some operator telemetry may still originate outside this folder

### Required Handoff Artifacts

- updated requirements/design/tasks detail for restored ambitions
- updated implementation docs for any affected CMS productivity surface
- dependency notes for outside-folder tie-ins

### Acceptance Checks

- the richer V2 product ambition is visibly restored
- restored items are intentional and implementable
- this phase does not silently reopen unrelated scope

### Hard Stop Conditions

- it starts reviving unrelated product areas by default
- it becomes aspirational instead of implementation-ready

## Phase 6: Master Dashboard AI Usage/Consumption and Master-Only Provider Switching

### Objective

Give the operator better visibility into AI operations and better master-only control over provider choice.

### Product Intent

The master lane should feel like a real operator console: better visibility, better clarity, honest unavailable-data states, and explicit master-side control.

### Detailed Implementation Lanes

- improve master-side AI usage and consumption visibility by client
- expose assistant health/status where data exists
- make update-awareness useful where appropriate
- define and, where possible, implement the master-only provider-switching UX
- prepare outside-folder handoff artifacts for real provider-routing or telemetry dependencies

### In-Folder Scope

- master UI
- local master routes/docs
- canonical V2 docs

### Outside-Folder Dependencies

- outside-folder Agent Enterprise telemetry
- outside-folder provider routing
- provider credentials and live secret management

### Required Handoff Artifacts

- data-contract notes for AI usage/consumption visibility
- provider-switching contract notes
- outside-folder implementation handoff for Agent Enterprise work
- cPanel/operator packet only if live config changes become necessary

### Acceptance Checks

- provider switching remains master-only
- missing external data is surfaced honestly
- outside-folder routing/telemetry work is handed off instead of locally faked

### Hard Stop Conditions

- provider choice leaks to client-facing surfaces
- the implementation tries to build a fake local provider router

## Phase 7: Final Handoff, cPanel Operator Packet, Repair Gate, and Rollback Gate

### Objective

Finish the sprint with a decision-complete operator handoff and a safe rollout decision point.

### Product Intent

The sprint should end with an operator-ready package, not just a code diff. “Done” means the handoff is executable and the safety path is intact.

### Detailed Implementation Lanes

- verify folder-owned regression coverage
- verify changelog completeness and contract-document completeness
- produce final blocker and outside-folder follow-up ledgers
- consolidate the cPanel/operator packets for DB/env/verification work
- confirm rollback docs still point to the current baseline

### In-Folder Scope

- canonical trilogy
- handoff docs
- rollback docs
- baseline artifacts

### Outside-Folder Dependencies

- live rollout execution
- live DB/env application
- release-health and live verification

### Required Handoff Artifacts

- final operator packet
- SQL/schema packets
- env/config packets
- verification checklist
- rollback note
- blocker and follow-up ledgers

### Acceptance Checks

- the operator can execute the live portion from the written handoff
- no unresolved contract change exists only in code
- rollback/repair rules are still valid
- the external agent has not claimed ownership of live work it cannot perform

### Hard Stop Conditions

- missing operator packets for known live steps
- unresolved critical regression with no repair or rollback guidance
