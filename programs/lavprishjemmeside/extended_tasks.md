# Lavprishjemmeside V2.0 Extended Tasks Supplement

## Purpose

This file is an additive supplement to the current canonical `tasks.md`. It exists because the active sprint plan is structurally correct but does not fully preserve the richness of the original intended V2.0 scope.

Use this file to restore the missing ambition without rewriting the live phase plan that is already being executed.

## How Bolt Should Use This File

1. Keep the current `programs/lavprishjemmeside/tasks.md` as the phase-order authority.
2. Use this file as the scope-restoration supplement.
3. Do not reopen completed phases casually.
4. If a required capability from the original V2.0 scope is still missing, treat it as a carry-forward obligation inside the current phase or the next phase that can honestly absorb it.
5. If an item requires cPanel, database execution, env changes, Roundcube/email integration, live provider routing, or SSH rollout, do not invent local substitutes. Produce a complete operator handoff packet instead.

## Hard Rules

- Update both changelog copies for any behavior change.
- Update all handoff docs when schema, API, env, workflow, or rollout contracts change.
- Do not create alternative infrastructure to bypass cPanel, DB, email, or provider-routing constraints.
- If a feature depends on outside-folder execution, stop at implementation-ready handoff artifacts and explicitly mark the operator step.
- If an omitted V2.0 feature is already partially implemented, finish it properly instead of silently downgrading it.

## Missing-Scope Recovery Map

| Original desired scope | Recover inside current sprint phase |
| --- | --- |
| Foundation & Admin Shell | Phase 5 carry-in recovery |
| Dashboard Redesign | Phase 5 carry-in recovery |
| Theme Engine & Themes Gallery | Phase 5 carry-in recovery |
| Visual Page Builder | Phase 5 carry-in recovery |
| Components & Custom Components Browser | Phase 5 primary scope |
| Styling Editor Modernization | Phase 5 primary scope |
| AI Assembler Visual Refresh | Phase 5 primary scope |
| Email Client | Phase 6 stretch or Phase 7 handoff-complete foundation |
| Subscription Management | Phase 6 primary extension |
| Integration, Polish & QA | Phase 7 mandatory closeout |

## Mandatory Pre-Step Before Continuing Phase 5

Before Bolt closes or continues Phase 5, it must produce a short gap ledger against this supplement:

- `Implemented`: already exists in a credible V2.0 form
- `Partial`: exists but is watered down or incomplete
- `Missing`: not yet present

Any item marked `Partial` or `Missing` below must be addressed during Phases 5-7 unless explicitly deferred in writing with a blocker reason and operator approval.

## Phase 5 Extension: Recover the Product-Facing V2 Scope

### 5.1 Carry-In Recovery From Original Phases 1-4

If the current implementation still lacks any of the following, Bolt must treat them as active carry-forward work inside Phase 5.

#### 5.1.1 Admin Shell and Shared V2.0 Design System

- A real admin design system layer with tokens for palette, typography, spacing, cards, buttons, inputs, modals, and toasts
- A modernized `AdminLayout` with grouped navigation, clearer hierarchy, responsive sidebar behavior, and stronger active-state feedback
- Proper user block / account context placement
- Navigation support for the major V2.0 surfaces that are intended to exist
- Removal of weak legacy admin styling where it still undermines the V2.0 feel

#### 5.1.2 Global Toast and Feedback Discipline

- Replace remaining `alert()`-style admin feedback with a coherent toast system
- Standardize success, error, warning, and info messaging
- Make async operations show honest loading/success/failure feedback

#### 5.1.3 Dashboard Redesign Recovery

- Rebuild the dashboard into a genuine overview surface, not a thin metrics page
- Restore stronger metric cards, quick actions, activity feed, and health visibility
- Add date-range filtering and trend-aware analytics where the current data supports it
- Add charted usage or activity visualization where the data model already exists or can be safely derived
- Improve responsive behavior and skeleton/loading states

#### 5.1.4 Theme Engine and Themes Gallery Recovery

- Restore the intended theme-system ambition, including seeded themes or clearly defined theme presets
- Provide a proper themes gallery UI with preview assets or representative previews
- Make theme application feel like a real product feature, not a hidden token swap
- Ensure theme-aware rendering is consistently respected by preview surfaces and relevant AI-assisted flows

#### 5.1.5 Visual Page Builder Recovery

- Restore the split-pane visual builder ambition if it is still missing or watered down
- Include a true preview/renderer pattern, not only form editing
- Support component selection, insertion, editing, and ordering in a coherent builder workflow
- Ensure data safety for content JSON and mixed component structures
- Keep mobile/tablet builder behavior explicit and usable

### 5.2 Components and Custom Components Browser

Bolt should not treat this as a basic listing page. The intended V2.0 experience is:

- grid-based component discovery
- meaningful category filtering and search
- clear distinction between library and custom components
- live preview modal behavior
- responsive viewport toggles for preview
- documentation/prop/schema visibility
- fast flow from discovery to “add to page”
- stronger empty states and onboarding guidance for custom components

### 5.3 Styling Editor Modernization

Recover the full V2.0 styling-editor ambition:

- reorganized design-token editing by logical sections
- better color editing UX than raw browser defaults
- visual typography and shape previews
- strong live preview feedback
- autosave draft behavior where safe
- explicit reset-to-theme-default behavior

This should feel like a serious design control surface, not a raw token form.

### 5.4 AI Assembler Visual Refresh

Restore the intended AI-assembler uplift:

- better visual hierarchy and Danish UX copy
- stronger prompt/composer experience
- explicit awareness of active theme/design context
- progress states that explain what the system is doing
- better result preview and handoff into the page builder
- clearer cost/token visibility where supported

### 5.5 Phase 5 Acceptance Gate

Phase 5 is not complete unless:

- the admin/product surfaces visibly reflect a major V2.0 quality uplift
- the missing original-scope items above are either implemented or explicitly carried into Phase 6/7 with a written blocker reason
- no major omitted area has been silently dropped just because the live `tasks.md` was more compact

## Phase 6 Extension: Restore the Business and Operator Scope

### 6.1 Master Dashboard AI Usage and Consumption

The current Phase 6 should be interpreted broadly enough to recover the original business/operator ambition:

- client-by-client AI usage visibility
- token / session / request / model consumption surfaces
- operator-friendly cost and usage framing where data allows
- assistant health and status signals
- last-active / failure / stale-assistant visibility
- update-awareness and rollout-awareness where relevant
- truthful empty, unavailable, or delayed-data states

### 6.2 Master-Only Provider Switching

Do not implement this as a lightweight toggle only. The intended scope is:

- a master-only control surface for choosing Codex/OpenAI vs Anthropic
- clear indication of the currently active provider and why
- visible auditability of provider changes
- no leak of provider choice to client-facing surfaces
- no fake in-folder provider router if the real switching logic lives outside the folder

If the real routing is outside the folder, Bolt must implement the in-folder UI/contracts and produce the operator/Agent Enterprise handoff packet for the rest.

### 6.3 Subscription Management Recovery

The original V2.0 scope clearly intended subscription management. Recover it as an active extension of Phase 6.

Required restoration lanes:

- subscription-related schema design and handoff
- current-plan visibility
- usage vs limits visibility
- billing-history surface
- personal-details / billing-details management
- upgrade and add-on request flows
- limit-enforcement contract points for AI, storage, pages, email accounts, and related paid resources

If full live billing integration is not feasible inside the sprint, Bolt must still deliver:

- schema SQL
- API contract
- UI contract
- request / upsell workflow
- operator packet for cPanel / billing / live-data dependencies

### 6.4 Email Client Recovery

The original V2.0 scope also clearly included an email client backed by cPanel mail infrastructure. This must not be silently forgotten.

If feasible within the remaining sprint, implement a serious foundation:

- mailbox/account data model
- IMAP/SMTP proxy contract
- folder listing
- message list / preview
- compose / reply / forward UX
- quota visibility
- security and sanitization requirements

If the full implementation is too large for the remaining sprint, Bolt must still leave behind an implementation-ready package:

- schema SQL
- route contract
- env contract
- UI architecture and flow
- security notes
- operator packet for cPanel mail / Roundcube-adjacent dependencies

Do not create a fake local email system to avoid the real cPanel dependency.

### 6.5 Phase 6 Acceptance Gate

Phase 6 is not complete unless:

- the master dashboard feels like an operator console rather than a basic admin page
- provider switching remains strictly master-only
- subscription management is either implemented or handoff-complete
- email-client scope is either implemented at credible foundation level or documented as an implementation-ready operator-bound package

## Phase 7 Extension: Integration, Polish, QA, and Operator Handoff

### 7.1 Cross-Module Integration

Restore the original Phase 10 integration discipline:

- theme changes propagate correctly across previews, page builder, AI flows, and relevant public rendering
- dashboard/master/assistant/commerce/business surfaces do not drift apart stylistically or contractually
- activity and audit signals remain coherent across new modules
- ecommerce, assistant, subscription, and master usage surfaces do not contradict each other

### 7.2 UX and Language Audit

Bolt must perform a real final polish pass:

- responsive audit at phone, tablet, and desktop breakpoints
- Danish-language audit across UI, errors, helper text, empty states, and confirmations
- interaction audit for loading, disabled, empty, and failure states
- accessibility sanity check for keyboard usage, focus, labels, and touch targets

### 7.3 Performance and Security Audit

The sprint closeout must include:

- dashboard load sanity
- preview/renderer performance sanity
- shop flow responsiveness sanity
- AI flow responsiveness sanity
- auth checks on all new routes
- HTML/content sanitization where rendering user or email data
- scope isolation for subscription/account data
- rate-limit expectations where email, AI, or expensive actions are involved

### 7.4 Documentation and Schema Closeout

Before Phase 7 is closed, Bolt must ensure:

- schema documentation is updated for all new DB work
- setup/install docs reflect any new env or bootstrap needs
- commerce docs reflect real feature changes
- assistant/master docs reflect real feature changes
- handoff docs reflect all operator-owned follow-up steps

### 7.5 Final Operator Packet

The sprint is not done until all operator-owned actions are packaged clearly.

This includes, where relevant:

- SQL schema / migration packets
- seed-data packets
- env/config packets
- webhook / provider / email setup packets
- cPanel rollout steps
- live verification checklist
- rollback note for each risky live change

### 7.6 Phase 7 Acceptance Gate

The sprint closeout is incomplete if any of the following is true:

- a feature depends on DB/env/live work but no operator packet exists
- a schema or API change exists only in code and not in docs
- a major original-scope feature was dropped without explicit written deferral
- the final handoff does not make repair-vs-rollback decision making easier

## Explicitly Restored Original-Scope Items

These items were part of the desired V2.0 scope and should be treated as active unless formally deferred:

- modern admin shell
- stronger dashboard analytics and health view
- theme engine and themes gallery
- visual page builder
- upgraded components and custom-components browser
- styling editor modernization
- AI assembler visual refresh
- subscription management
- email client foundation
- integration / polish / QA discipline

## Final Instruction To Bolt

Do not interpret the compact `tasks.md` as permission to lower the ambition of V2.0.

Interpret it as the safe execution spine.

Interpret this supplement as the missing product depth that still belongs to the sprint.
