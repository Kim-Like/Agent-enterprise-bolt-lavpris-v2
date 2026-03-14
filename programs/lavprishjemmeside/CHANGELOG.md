# Changelog

All notable changes to Lavpris CMS are documented here.

Format: `## [version] - YYYY-MM-DD` with sections `Added`, `Fixed`, `Changed`, and `Database migrations`.
Versions follow [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- `PATCH` (`1.0.x`): bug fixes, copy changes, minor UI tweaks. No schema changes. Safe to merge anytime.
- `MINOR` (`1.x.0`): new features, new components, new admin pages. May include additive schema migrations.
- `MAJOR` (`x.0.0`): breaking changes to schema, API contracts, or env var names. Requires manual migration steps.

Change discipline:

- Every Engineer, Codex, and Claude Code change that affects Lavprishjemmeside CMS behavior, client-site management behavior, rollout process, or operator expectations must update `[Unreleased]` before handoff.
- Documentation and orchestration changes belong under `Changed`.
- If a change does not affect release notes, say that explicitly in the implementation handoff.

---

## [Unreleased]

> Features developed on `main` but not yet tagged. Will become the next release.

### Added
- Implemented the first-party e-commerce module with shop schema, Flatpay / Frisbii payment integration, public storefront routes, admin shop management, and transactional order email support.

### Planned
- Phase 4.1 planning complete: scoped Ecommerce Functional Depth sprint covering admin shop dashboard, inventory reservation at checkout, storefront product search, refund/return workflow, and order notes as Tier 1 blockers; shipping zones, customer accounts, product filters, and email template customization as Tier 2 differentiators; back-in-stock notifications, abandoned cart recovery, product reviews, and bulk import/export as Tier 3. Full implementation plan in `PHASE4.1_HANDOFF.md`. No code changes in this entry.

### Phase 4.1 — Ecommerce Functional Depth (Tier 1 implementation)

**New schema files** (run via `node api/run-schema.cjs`):
- `schema_stock_reservations.sql` — `stock_reservations` table: session-scoped inventory reservations with `product_id`, `variant_id`, `quantity`, `session_token`, `expires_at`; indexed on product, token, and expiry for efficient lazy sweeps.
- `schema_order_notes.sql` — additive `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT NULL` for buyer-supplied order notes.

**New API endpoints:**
- `GET /shop/search?q=&limit=` — MySQL FULLTEXT search across `products.name` and `products.short_desc` with wildcard prefix matching; returns matching products with primary image and price.
- `POST /shop/cart/reserve` — atomic inventory reservation: sweeps expired rows, checks available stock (stock minus active reservations), creates a 15-minute session-scoped reservation row; returns HTTP 409 on insufficient stock.
- `POST /shop/admin/orders/:id/refund` — marks order `refunded`, optionally restores stock per line item, records `order_events` audit row, sends refund confirmation email best-effort.
- `POST /shop/admin/orders/:id/note` — appends an internal admin note as an `order_events` row with `event_type: internal_note`.
- Extended `GET /shop/admin/dashboard` to include `low_stock` (products with `stock ≤ 5` and `track_stock = 1`) and `daily_orders` (14-day daily order counts).

**New pages and components:**
- `src/pages/admin/shop/dashboard.astro` — admin shop overview with 4 KPI cards (revenue 30d, orders 30d, pending payment, ready to ship), pure-CSS 14-day daily orders bar chart, top 5 products list, recent orders table, and low-stock alert list.
- `src/components/SearchBar.astro` — reusable search input with debounced fetch (280ms), results dropdown, thumbnail/placeholder, price display, clear button, keyboard Escape dismiss, and outside-click close.

**Modified files:**
- `src/pages/shop/checkout.astro` — added "Note til butikken" textarea; added session token generation via `sessionStorage` + `crypto.getRandomValues`; reserve call before order creation with 409 error surfacing.
- `src/pages/admin/shop/orders.astro` — added refund modal (reason + restore-stock checkbox); internal note input section; customer note display box; full event timeline (no longer capped at 10); emoji prefix for internal note events.
- `src/layouts/AdminLayout.astro` — added "Shop-overblik" nav link to `/admin/shop/dashboard/` in the Shop section.
- `src/pages/shop/index.astro` — injected `SearchBar` above category grid.
- `src/components/Header.astro` — injected `SearchBar` into regular and modern layout nav rail (before CartIcon).
- `api/src/services/shop-email.cjs` — added `sendRefundConfirmation` email function.
- `api/run-schema.cjs` — registered `schema_stock_reservations.sql` and `schema_order_notes.sql` in `SCHEMA_ORDER`.

### Phase 4.1 — Ecommerce Functional Depth (Tier 2 implementation)

**New schema files** (run via `node api/run-schema.cjs`):
- `schema_shipping_zones.sql` — additive `ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS countries JSON NULL` for per-method country targeting.
- `schema_customer_accounts.sql` — additive columns on `customers` (`password_hash TEXT NULL`, `email_verified_at TIMESTAMP NULL`) plus new `customer_sessions` table (token, customer_id, expires_at) for light customer account sessions.
- `schema_email_templates.sql` — new `email_templates` table (slug, label, subject, html_body, updated_at) for admin-editable transactional email templates with hardcoded fallback.

**New API endpoints (public):**
- `POST /shop/auth/register` — customer self-registration with bcrypt password hash; returns 30-day session token.
- `POST /shop/auth/login` — customer login with bcrypt verify; returns session token.
- `POST /shop/auth/logout` — invalidates session token row.
- `GET /shop/auth/me` — returns current customer identity from session header.
- `GET /shop/orders/my` — returns authenticated customer's order history (requires `X-Customer-Session` or `Authorization` header).
- `GET /shop/products?min_price_ore=&max_price_ore=&in_stock_only=&sort=` — new optional filter params (price range, stock filter, sort order) added to existing products endpoint; fully backwards-compatible.
- `GET /shop/shipping/methods?country=DK` — new optional `country` query param filters methods by `countries` JSON column; NULL = all countries (backwards-compatible).

**New API endpoints (admin):**
- `GET /shop/admin/emails` — list all email templates.
- `GET /shop/admin/emails/:slug` — retrieve a single template by slug.
- `PUT /shop/admin/emails/:slug` — create or update an email template; used by the admin editor page.
- `PUT /shop/admin/shipping/:id` + `POST /shop/admin/shipping` — extended to accept optional `countries` array field.

**New admin page:**
- `src/pages/admin/shop/emails.astro` — email template editor with sidebar template list, subject and HTML body editor, `{{token}}` insertion pills, save button, and "reset to default" button. All four transactional templates (order confirmation, shipped, refund, admin new order) are editable.

**New storefront pages:**
- `src/pages/shop/konto/login.astro` — customer login form with session token storage in localStorage.
- `src/pages/shop/konto/register.astro` — customer registration form with first/last name, email, password.
- `src/pages/shop/konto/index.astro` — authenticated order history page with status badges and logout.

**New component:**
- `src/components/ProductFilters.astro` — filter sidebar with price range inputs, in-stock toggle, sort dropdown, apply button, reset button. Dispatches `pf:results` custom event with filtered product list.

**Modified files:**
- `src/pages/shop/[category].astro` — injected `ProductFilters` sidebar; switched to two-column layout; added `pf:results` event listener to re-render product grid without page reload.
- `api/src/services/shop-email.cjs` — all four email functions now check `email_templates` DB table first; fall back to hardcoded HTML if no DB row exists. Added `loadTemplate()` and `renderTemplate()` helpers; added `pool` import.
- `src/layouts/AdminLayout.astro` — added "E-mailskabeloner" nav link to `/admin/shop/emails/` in the Shop section.
- `api/run-schema.cjs` — registered `schema_shipping_zones.sql`, `schema_customer_accounts.sql`, and `schema_email_templates.sql` in `SCHEMA_ORDER`.

**Operator actions required at rollout:**
1. Run `node api/run-schema.cjs` to apply the three new Tier 2 schema files.
2. Trigger Astro build + deploy.

### Phase 4.1 — Ecommerce Functional Depth (Tier 3 implementation)

**New schema files** (run via `node api/run-schema.cjs`):
- `schema_stock_notifications.sql` — `stock_notifications` table: email opt-in for out-of-stock products/variants; indexed on product, variant, email, and notified_at.
- `schema_abandoned_carts.sql` — `cart_sessions` table: session_id, email, cart JSON, captured_at, last_activity_at, reminder_sent_at, recovered_at; used for abandoned cart recovery.
- `schema_product_reviews.sql` — `product_reviews` table: product_id, customer_email, customer_name, rating (1–5), body, approved flag, created_at; indexed on product and approval status.

**New API endpoints (public):**
- `POST /shop/notify/stock` — register email for back-in-stock notification; deduplicates per product/variant/email; rate-limited via existing `orderRateLimiter`.
- `POST /shop/products/:slug/review` — submit a product review (rate-limited, 5/hour per IP); stores as unapproved; returns `pending_approval: true`.
- `GET /shop/products/:slug/reviews` — return approved reviews with average rating and count.
- `POST /shop/cart/session` — upsert cart session row for abandoned cart tracking; called from cart client side; `ON DUPLICATE KEY UPDATE` pattern.

**New API endpoints (admin):**
- `GET /shop/admin/reviews` — list all reviews with optional `?approved=0|1` filter and pagination.
- `PUT /shop/admin/reviews/:id/approve` — approve or unapprove a review.
- `DELETE /shop/admin/reviews/:id` — permanently delete a review.
- `GET /shop/admin/cron/abandoned-carts` — operator/cPanel-cron callable endpoint; sends reminder emails to cart sessions with email captured, no reminder sent yet, and last activity > 2 hours ago; marks `reminder_sent_at`.
- `GET /shop/admin/products/export.csv` — download all products as UTF-8 CSV with BOM; correct CSV quoting.
- `POST /shop/admin/products/import` — multipart CSV upload (max 5 MB); validates required columns (`sku`, `name`, `slug`, `price_ore`); upserts by SKU via `ON DUPLICATE KEY UPDATE`; returns `{ upserted, skipped, errors }`.

**New admin page:**
- `src/pages/admin/shop/reviews.astro` — review moderation list with approve/unapprove/delete actions, filter by status, and pagination.

**Modified files:**
- `src/pages/shop/produkt/[slug].astro` — added approved review list with star rating display and average summary; added review submission form (name, email, star rating, body); added back-in-stock notification widget that appears when the add-to-cart button is disabled (out of stock).
- `src/pages/admin/shop/products.astro` — added "Eksporter CSV" and "Importer CSV" buttons to the page header; added import result message strip; added JS for client-side CSV download with `Authorization` header and file upload handling.
- `api/src/routes/shop-admin.cjs` — added `multer` import and `upload` instance; added all Tier 3 admin endpoints; wired back-in-stock notification dispatch into the refund stock-restore path.
- `src/layouts/AdminLayout.astro` — added "Anmeldelser" nav link to `/admin/shop/reviews/` in the Shop section.
- `api/run-schema.cjs` — registered `schema_stock_notifications.sql`, `schema_abandoned_carts.sql`, and `schema_product_reviews.sql` in `SCHEMA_ORDER`.

**Operator actions required at rollout:**
1. Run `node api/run-schema.cjs` to apply the three new Tier 3 schema files.
2. Trigger Astro build + deploy.
3. (Optional) Configure a cPanel cron job: `curl -s -H "Authorization: Bearer <admin_token>" https://api.lavprishjemmeside.dk/shop/admin/cron/abandoned-carts` — run every 30 minutes.

### Changed
- Uplifted all shop storefront, cart, checkout, and admin pages from Tailwind utility classes to scoped `<style>` blocks using CSS design tokens: `shop/index.astro`, `shop/[category].astro`, `shop/produkt/[slug].astro`, `shop/kurv.astro`, `shop/checkout.astro`, `shop/ordre/[token].astro`, `admin/shop/products.astro`, `admin/shop/orders.astro`, `admin/shop/settings.astro`. All Tailwind `hidden` class toggles replaced with `element.style.display` or semantic `.is-open` class patterns. Status badge class assignments in JS template literals replaced with semantic BEM-style classes defined in scoped CSS. No JavaScript logic, API contracts, or schema changes.
- Uplifted shop components (`ShopHero.astro`, `CartDrawer.astro`, `PriceDisplay.astro`) from Tailwind to scoped CSS. `CartDrawer` slide animation changed from `translate-x-full`/`translate-x-0` class toggling to `.is-open` CSS class with `transform: translateX()`. `PriceDisplay` size variants converted to `.price-display--sm/md/lg` modifier classes.
- Hardened installer (`scripts/setup.cjs`) with partial-install state persistence (`.setup-state.json`), `--reset` flag for full restart, `execWithRetry` for dependency and build steps, URL and required-field validation, resume-aware variable pre-fill, 90-second health polling with last-error reporting, API stderr capture on health failure, Agent Enterprise provisioning with 3-retry logic, JWT secret and provisioned token preservation across resume runs, numbered step headers, and explicit repair guidance on each failure.
- Hardened schema runner (`api/run-schema.cjs`) with per-statement execution (`multipleStatements: false`), `splitStatements()` DELIMITER-aware SQL splitter, `isIdempotentError()` for safe-to-skip MySQL error codes, `checkConnection()` pre-flight, missing-file warnings, per-file timing and applied/skipped counts, wrapped errors carrying `schemaFile`/`statementIndex`/`statementPreview`/`originalCode`, post-run summary table, and expanded `SCHEMA_ORDER` covering all 27 current schema files.
- Hardened assistant setup wizard (`src/pages/admin/assistant.astro`) with full scoped CSS system replacing all Tailwind dependencies, `STEP_REQUIRED_FIELDS` per-step validation map, `validateStep()`/`clearStepErrors()` functions, `setWizardStep(nextStep, skipValidation)` navigation gate that blocks forward progress on empty required fields, dismissible error banner, step progress indicators with active/complete/error-state styles, all visibility toggling moved from Tailwind `hidden` class to `element.style.display`, `escHtml()` XSS helper, and activation error recovery that re-enables the submit button on failure.
- Added `docs/INSTALL_OPERATOR_PACKET.md` with the complete cPanel operator handoff for new-client installs: pre-install DB creation, Node.js app setup, DNS pointing, SSH clone steps, full env variable reference table, post-install document-root configuration, Flatpay webhook registration, live verification checklist, and rollback guidance.
- Uplifted admin shell (`AdminLayout.astro`) with a dark `#0f1117` sidebar, SVG icon navigation, active-state left-border indicator, Master Hub violet accent, user avatar/email footer, sticky top bar with role badge and page title, and mobile slide-in overlay.
- Uplifted admin dashboard (`dashboard.astro`) with a dark version strip, auto-fill stat cards, three-column overview (Pages / Design / Indhold & SEO), inline SVG icons, status dots, responsive breakpoints, and cleaner publish/rollout UI.
- Uplifted master hub (`master.astro`) with a scoped CSS design system: tab bar with SVG icons and active underline, improved site cards (health dot, build pill, 4-col mini-stat row, rollout badge), AI usage bar chart with hover state, and Claude Code step grid with tinted gradient step panels and a dark terminal output area.
- Added `docs/V2_DESIGN_UPLIFT.md` documenting the Phase 2 design tokens, component patterns, CSS strategy, and contract-unchanged confirmation.
- Strengthened contract-documentation rules in `EXTERNAL_AGENT_INSTRUCTIONS.md` so the external sprint must explicitly document all structured contracts (schema, seed, API, env, workflow, outside-folder) with specific file updates, not vague summaries.
- Removed the remaining stale references to the retired duplicate planning location from the canonical V2 docs and authority maps after the planning set was moved fully into `programs/lavprishjemmeside/`.
- Tightened the external-agent startup contract so `EXTERNAL_AGENT_PROMPT.md` and `EXTERNAL_AGENT_INSTRUCTIONS.md` now force the in-folder trilogy, require explicit documentation/handoff completion, and treat cPanel/DB/env work as operator packets rather than improviseable implementation scope.
- Moved the canonical V2 planning trilogy into `programs/lavprishjemmeside/requirements.md`, `programs/lavprishjemmeside/design.md`, and `programs/lavprishjemmeside/tasks.md` so the external sprint reads the real plan directly inside the writable folder.
- Rebuilt the V2 handoff docs around a richer hybrid product vision that restores major design/admin uplift, CMS productivity ambition, install/wizard hardening, e-commerce expansion, master AI visibility, and rollback safety in one coherent plan.
- Added `CPANEL_HANDOFF_CONTRACT.md` so database, seed, env, live verification, and rollback packets are standardized whenever the external sprint reaches an operator-owned cPanel boundary.
- Retired `SPRINT_V2_MIRROR.md` as the full sprint authority and converted it into a start-here pointer to the canonical in-folder trilogy and cPanel operator contract.
- Added an explicit handoff-artifact rule for the external sprint so schema, API, env, and workflow contract changes must leave behind updated documentation instead of living only in code.
- Added `EXTERNAL_AGENT_PROMPT.md` as a ready-to-paste startup prompt that tells a fresh external agent what to read first and what to keep in context memory throughout the sprint.
- Replaced the stale CMS V2.0 pipeline plan with a real Lavprishjemmeside V2 external sprint plan covering documentation hardening, install hardening, wizard refinement, e-commerce uplift, master AI usage visibility, master-only provider switching, and rollback/repair gates.
- Added the external-agent handoff pack in the Lavprishjemmeside root: `EXTERNAL_AGENT_INSTRUCTIONS.md`, `SPRINT_V2_MIRROR.md`, `OUTSIDE_FOLDER_DEPENDENCIES.md`, `ROLLBACK_AND_REPAIR.md`, and `DOCUMENT_AUTHORITY_MAP.md`.
- Added a baseline snapshot package for the current working version under `baselines/2026-03-14/` so the parent site and `ljdesignstudio.dk` have a documented rollback reference before the V2 sprint starts.
- Hardened the Lavprishjemmeside docs for external-agent handoff by fixing the root read order, classifying canonical/reference/historical docs, and adding reference banners to non-authoritative docs inside the folder.
- Added the Lavprishjemmeside release gate, rollout-status service, and active path-health checks so pending parent rollouts, client update drift, and stale legacy path references are surfaced before handoff.
- Added standardized release telemetry to CMS `/health`, parent/client rollout-status endpoints, and dashboard warnings so the parent site shows pending rollouts while client sites show `Opdatering tilgængelig` when they are behind `lavprishjemmeside.dk`.
- Added the `LAVPRIS_PARENT_API_URL` override plus release-health runbook updates so rollout checks, CMS docs, and installer output stay aligned even if the parent API origin changes.
- Added a hard Lavprishjemmeside engineer completion gate that requires changelog evidence from `[Unreleased]` before tasks can be marked completed.
- Fixed the product-detail shop component so the cPanel Astro build no longer aborts on the stock-status expression during live rollout.
- Fixed CMS release telemetry to read `security_logs.action` for `site.publish.completed`, so `last_deployed_at` is reported correctly after SSH-first deployments.
- Consolidated the program root docs into the essential set: `README.md`, `PROJECT_CONTEXT.md`, `BRAND_VISION.md`, and `CHANGELOG.md`.
- Updated the Engineer, Father, Lavprishjemmeside master, client-agent templates, and live client assistant packets so they explicitly understand the CMS plus the e-commerce lane: catalog, checkout, orders, shipping, discounts, and Flatpay / Frisbii payment handling.
- Added the `lavprishjemmeside-master-orchestrator` project skill for enterprise CMS and client-site governance work inside Agent Enterprise.
- Updated the Lavprishjemmeside master and Engineer packets so CMS-facing work must consider changelog impact before handoff.
- Clarified the Lavprishjemmeside authority chain so Bolt.new syncs through the public GitHub repo before Agent Enterprise deploys the cPanel live runtime over SSH.
- Added the Lavpris public-ingress split so shared cPanel CMS installs reach Agent Enterprise through Tailscale Funnel while the full control plane remains private.
- Rewrote the program-level docs around the SSH-first and Funnel-backed assistant access contract so the root manifest no longer points engineers toward the retired CMS-side IAN model.
- Verified GitHub SSH read/write access and cPanel SSH write access for Lavprishjemmeside v2.0, then aligned the Lavprishjemmeside, Father, and Engineer packets on the `Bolt.new -> GitHub -> cPanel over SSH` rollout contract.
- Added a canonical local Lavprishjemmeside mirror workflow and sync-status checks so Agent Enterprise can compare GitHub, the local checkout, and the cPanel repo before rollout.
- Normalized the remote `api/package-lock.json` drift caused by the legacy SSH npm toolchain and restored a green Lavprishjemmeside sync baseline.
- Archived the still-active GitHub Actions deploy YAML in the local mirror so GitHub stops re-committing generated `dist/` output after source-only updates.
- Audited the Lavprishjemmeside doc set and marked the remaining pre-Agent Enterprise assistant and GitHub Actions references as historical-only so the live handoff path stays SSH-first, Funnel-backed, and Agent Enterprise-owned.
- Updated the root `docs/lavpris-ssh-first-operations.md` runbook so it matches the live Mac-hosted Agent Enterprise node, current `launchd` service names, and the current cPanel restart guidance.
- Deleted the remaining archive-only Lavprishjemmeside docs and placeholder markdown files that no longer add implementation value, including the retired IAN pointer doc, archived workflow copy, empty project stubs, and stray sync-test notes.
- Updated the handoff and runtime docs so the live e-commerce module, Flatpay env contract, public/admin shop routes, and manual `schema_shop.sql` bootstrap are documented as current behavior instead of future planning.
- Created the `info@ljdesignstudio.dk` cPanel mailbox and verified the account state through cPanel email APIs and the live mail files.
- Prepared Ljdesignstudio password recovery to use `info@ljdesignstudio.dk` as the primary admin and added SMTP fallback handling because the live Resend credential is not configured.
- Added a CMS version/build contract to `/health` and the admin dashboard so client installs expose a visible build ID before update and support work.
- Rolled the missing `Egne komponenter` feature into Ljdesignstudio by deploying the sidebar/page/API bundle, applying `schema_components_source.sql`, and rebuilding with `PUBLIC_API_URL=https://api.ljdesignstudio.dk` so the client admin points at the correct backend.
- Restored CMS-driven publishing for SSH-first client installs by replacing the disabled `/publish` route with a local build-and-rsync deploy flow that uses the client-specific `PUBLIC_SITE_URL` and `PUBLIC_API_URL`.

### Database migrations
- none

---

## [1.0.0] - 2026-02-19

Initial production release. Baseline for all client installations.

### Included features
- 27-component library (hero, FAQ, pricing, testimonials, gallery, and more)
- AI Assemble for page generation from prompts
- page builder with drag-and-drop component ordering
- design-system editor for colors, typography, radius, shadows, and feature toggles
- header and footer editor
- media library with Pexels integration
- traffic dashboard (Google Search Console plus GA4)
- password reset via email (Resend)
- GitHub Actions CI/CD with auto-build and SSH deploy on push to `main`
- multi-domain support via GitHub repository variables

### Database migrations
| File | Description |
|------|-------------|
| `schema.sql` | Core tables: users, sessions, components, page_components, content_pages, design_settings, theme_presets, events, security_logs, ai_usage |
| `schema_password_reset.sql` | `password_reset_tokens` table |
| `schema_phase6.sql` | Design settings columns, theme presets, media, AI prompt settings |
| `schema_header_footer.sql` | `header_footer_settings` table |
| `schema_media.sql` | `media` table |
| `schema_page_meta.sql` | SEO/meta columns on `content_pages` |
| `schema_ai_prompt_settings.sql` | `ai_prompt_settings` table |
| `schema_design_features.sql` | Feature toggle columns on `design_settings` |
| `schema_indexes.sql` | Performance indexes |

---

## [1.1.0] - TBD

> Template - fill in when features are ready to release.

### Added
- _[feature name]: brief description_

### Fixed
- _[bug]: brief description_

### Changed
- _[behavior or workflow change]: brief description_

### Database migrations
- _none_ or `schema_v1_1_xxx.sql`: description of what it adds

### Upgrade instructions for client installs
1. Merge upstream into the client repo
2. Run `node api/run-schema.cjs` on the server (safe to re-run if additive only)
3. Restart the Node app with the cPanel runtime command documented in `local-mirror/docs/SSH_FIRST_OPERATIONS.md` or `local-mirror/docs/UPSTREAM_UPDATES.md`
4. Rebuild and sync over SSH; use the admin Publish button only for content/theme rebuilds from code that is already live on the server

---

## [1.2.0] - TBD

> Template - fill in when features are ready to release.

### Added
- _[feature name]: brief description_

### Fixed
- _[bug]: brief description_

### Changed
- _[behavior or workflow change]: brief description_

### Database migrations
- _none_ or `schema_v1_2_xxx.sql`: description

### Upgrade instructions for client installs
1. Merge upstream into the client repo
2. Run `node api/run-schema.cjs` on the server
3. Restart the Node app with the cPanel runtime command documented in `local-mirror/docs/SSH_FIRST_OPERATIONS.md` or `local-mirror/docs/UPSTREAM_UPDATES.md`
4. Rebuild and sync over SSH; use the admin Publish button only for content/theme rebuilds from code that is already live on the server

---

## How to release a new version

1. Finish all features on `main`
2. Fill in the `[Unreleased]` section above and rename it to the new version plus date
3. Add a new empty `[Unreleased]` section at the top
4. Bump `"version"` in `package.json`
5. Commit: `git commit -m "chore: release vX.Y.Z"`
6. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
7. Create a GitHub release: `gh release create vX.Y.Z --title "vX.Y.Z" --notes "See CHANGELOG.md"`
8. Roll out to each client repo and verify site plus API health
