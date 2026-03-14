# Phase 4.1 Handoff: Ecommerce Functional Depth — Commerce-First Client Readiness

> Status: planning. No implementation has started. This document captures the planning decisions and scoped implementation lanes for execution by the next external agent sprint.

---

## Context and Rationale

Phase 4 delivered a CSS design system parity pass across the entire shop module. The module now renders correctly without Tailwind. What it did not change is the functional depth of the commerce product.

A commerce-first client assessment identified the following reality: the shop is a functional MVP for small catalogs with simple shipping needs. It would not survive the first week of a client who relies heavily on ecommerce without hitting the gaps below. Phase 4.1 addresses the blockers and highest-value gaps before any such client is signed.

This phase sits between Phase 4 (CSS parity) and Phase 5 (CMS/admin productivity uplift). It does not replace Phase 5; it sharpens the commerce lane so the product is credible as a commerce offer before CMS productivity work begins.

---

## Objective

Raise the first-party shop from a functional MVP to a credible commerce product capable of supporting a client whose primary business runs through the shop.

---

## Product Intent

A client who "relies heavily on ecommerce" must be able to:
- manage a real catalog without hitting inventory overselling bugs
- search their own product catalog from the storefront
- process a refund or return without data loss
- view a revenue summary without spreadsheets
- trust that a surge of simultaneous orders does not oversell stock

The admin must be able to:
- see the shop health at a glance on arrival
- add internal notes to orders
- process a refund with a clear audit trail
- configure shipping by zone if clients operate across borders

---

## Implementation Lanes

Lanes are ordered by priority. Tier 1 are blockers for a commerce-first client pitch. Tier 2 are strong differentiators. Tier 3 are nice-to-have.

### Tier 1 — Blockers

#### 1.1 Admin Shop Dashboard

**Problem:** An admin arriving at the shop has no revenue or operations summary. They must click into Orders and mentally aggregate.

**Scope:**
- New page: `src/pages/admin/shop/dashboard.astro`
- Connects to the existing `GET /shop/admin/dashboard` API endpoint (already implemented, not surfaced)
- KPI cards: revenue (last 30d), orders (last 30d), pending payment count, to-ship count
- Recent orders table (last 10, with status badge and customer name)
- Top 5 products by units sold
- Chart: daily order volume for last 14 days (simple CSS bar chart, no external library)
- Low-stock alert list: products where `stock <= 5` and `track_stock = true`

**Contract changes:** None. The API already returns all required data.

**Schema changes:** None.

**Operator actions required:** None.

#### 1.2 Inventory Reservation at Checkout

**Problem:** Two customers can add the last unit to cart simultaneously. Stock is only decremented on Flatpay `charge_settled` webhook. Overselling is possible and silent.

**Scope:**
- New schema table: `stock_reservations` — holds a product_id, variant_id, quantity, session token, and `expires_at` timestamp
- New API endpoint: `POST /shop/cart/reserve` — called when the customer submits the checkout form, before the Flatpay session is created. Atomically checks available stock (product stock minus active reservations), creates a reservation row, and returns a `reservation_token`
- Existing checkout flow: send `reservation_token` to `POST /shop/orders`; order creation validates the reservation exists and is not expired before proceeding
- Existing webhook handler: on `charge_settled`, use the order's reservation token to release the reservation and decrement actual stock
- Reservation TTL: 15 minutes. A cron-equivalent cleanup query runs as a lazy sweep on each `POST /shop/cart/reserve` call (delete expired rows before inserting new ones) — no external scheduler required
- `GET /shop/products/:slug` response: available stock = `products.stock - SUM(active reservations)` for that product/variant

**Contract changes:**
- `POST /shop/cart/reserve` — new public endpoint (rate-limited, same pattern as order creation)
- `POST /shop/orders` — new required body field: `reservation_token`
- `GET /shop/products/:slug` — `available_stock` field added to response (backwards-compatible)

**Schema changes:**
- New table: `stock_reservations` (see schema file below)
- New schema file: `api/src/schema_stock_reservations.sql`

**Operator actions required:** Run `schema_stock_reservations.sql` via `node api/run-schema.cjs` after deploy.

#### 1.3 Storefront Product Search

**Problem:** Browse-only navigation is a dealbreaker for catalogs above ~30 products. No search input exists anywhere on the storefront.

**Scope:**
- New API endpoint: `GET /shop/search?q=&limit=` — fulltext search against existing MySQL `FULLTEXT` index on `products` (`name`, `description`, `sku`). Returns same shape as product list.
- New component: `src/components/SearchBar.astro` — an input with a debounced fetch on keystroke (300ms), results dropdown showing product name + image + price, links to `/shop/produkt/[slug]`
- Placement: inject into `Header.astro` when the shop module is active, and into `src/pages/shop/index.astro` as a prominent search hero element
- Empty state: "Ingen produkter fandt for '[query]'"
- No external search library; uses the existing MySQL fulltext index

**Contract changes:**
- `GET /shop/search` — new public endpoint

**Schema changes:** None. Fulltext index already exists (`schema_shop.sql`).

**Operator actions required:** None beyond standard deploy.

#### 1.4 Refund and Return Workflow

**Problem:** Admins currently change an order status to "refunded" manually with no audit trail, no stock restoration, and no customer email.

**Scope:**
- New API endpoint: `POST /shop/admin/orders/:id/refund` — accepts `{ reason, restore_stock: boolean, line_items: [{ order_item_id, quantity }] }`. Records a refund event in `order_events`, optionally restores stock, sets order status to `refunded`, and sends a refund confirmation email to the customer.
- New UI section in `admin/shop/orders.astro`: "Refund / Return" action available when order status is `paid`, `processing`, `shipped`, or `delivered`. Modal with reason input, line item checkboxes with quantity input, and stock-restore toggle.
- Email template: refund confirmation to customer (mirrors order confirmation style)
- `order_events` entry: `{ event_type: 'refund_processed', actor: 'admin', meta: { reason, items_refunded, stock_restored } }`

**Contract changes:**
- `POST /shop/admin/orders/:id/refund` — new admin endpoint

**Schema changes:** None. `order_events` already supports arbitrary `meta` JSON.

**Operator actions required:** None beyond standard deploy.

#### 1.5 Order Notes

**Problem:** Customers have no way to leave a note at checkout. Admins have no way to leave internal notes on an order without changing its status.

**Scope:**
- Checkout page: add optional "Note til butikken" textarea field. Stored in `orders.customer_note` column (new column, additive migration).
- Admin orders view: display `customer_note` in the order detail panel if present.
- Admin orders view: add "Intern note" section — text input + "Gem" button. Calls new endpoint `POST /shop/admin/orders/:id/note`. Stores in `order_events` with `event_type: 'internal_note'`, `actor: 'admin'`. Notes displayed in the order event timeline.

**Contract changes:**
- `POST /shop/admin/orders/:id/note` — new admin endpoint
- `POST /shop/orders` — new optional body field: `customer_note`

**Schema changes:**
- `ALTER TABLE orders ADD COLUMN customer_note TEXT NULL` — new additive migration file: `api/src/schema_order_notes.sql`

**Operator actions required:** Run `schema_order_notes.sql` via `node api/run-schema.cjs` after deploy.

---

### Tier 2 — Strong Differentiators

#### 2.1 Shipping Zones

**Problem:** All shipping methods are offered globally. A client serving both Denmark and the EU cannot configure DK-only flat rate vs EU surcharge.

**Scope:**
- Extend `shipping_methods` table: add `countries JSON NULL` column (array of ISO 3166-1 alpha-2 codes). NULL = all countries.
- `GET /shop/shipping/methods` — accept optional `country` query param; filter methods where `countries IS NULL OR JSON_CONTAINS(countries, '"DK"')`
- Admin shipping UI: add a country selector (checkbox list of common EU countries + "All countries" toggle) per shipping method
- Schema file: `api/src/schema_shipping_zones.sql`

**Contract changes:**
- `GET /shop/shipping/methods?country=DK` — new optional query param (backwards-compatible)

**Operator actions required:** Run `schema_shipping_zones.sql`.

#### 2.2 Customer Accounts (Light)

**Problem:** Repeat customers have no way to view past orders without the token email. No login, no order history.

**Scope:**
- New schema tables: `customer_sessions` (token, customer_id, expires_at, created_at), extend `customers` with `password_hash TEXT NULL`, `email_verified_at TIMESTAMP NULL`
- New public API endpoints: `POST /shop/auth/register`, `POST /shop/auth/login`, `POST /shop/auth/logout`, `GET /shop/auth/me`, `GET /shop/orders/my` (requires customer session)
- New storefront pages: `src/pages/shop/konto/index.astro` (order history), `src/pages/shop/konto/login.astro`, `src/pages/shop/konto/register.astro`
- Login is optional at checkout — existing guest flow unchanged
- If a customer is logged in at checkout, their session auto-populates the address form
- Schema file: `api/src/schema_customer_accounts.sql`

**Contract changes:**
- Multiple new `/shop/auth/*` and `/shop/orders/my` endpoints

**Operator actions required:** Run `schema_customer_accounts.sql`.

#### 2.3 Storefront Product Filters

**Problem:** Category-only browsing cannot be narrowed by price or stock status. A catalog with 50+ products in one category is unusable.

**Scope:**
- `GET /shop/products` — add optional query params: `min_price_ore`, `max_price_ore`, `in_stock_only`, `sort` (price_asc, price_desc, newest, featured)
- Category page (`shop/[category].astro`): add a filter sidebar/bar with price range inputs, in-stock toggle, and sort dropdown. All filtering client-driven via query param update + fetch.
- Component: `src/components/ProductFilters.astro`

**Contract changes:**
- `GET /shop/products` — new optional query params (backwards-compatible)

**Schema changes:** None.

**Operator actions required:** None.

#### 2.4 Email Template Customization

**Problem:** Transactional email HTML is hardcoded in `api/src/services/email.js` and `shop-email.cjs`. Clients cannot brand their emails without touching source code.

**Scope:**
- New schema table: `email_templates` (slug, subject, html_body, updated_at). Slugs: `order_confirmation`, `order_shipped`, `refund_confirmation`, `admin_new_order`.
- New admin page: `src/pages/admin/shop/emails.astro` — list templates, edit HTML with a basic textarea editor, preview with dummy data, save.
- New admin API endpoints: `GET /shop/admin/emails`, `GET /shop/admin/emails/:slug`, `PUT /shop/admin/emails/:slug`
- Email service: on send, load template from DB. If not found, fall back to hardcoded default. Render template using simple `{{variable}}` token replacement (no external templating library).
- Schema file: `api/src/schema_email_templates.sql`
- Seed file: `api/src/seed_email_templates.sql` — inserts the current hardcoded templates as defaults

**Contract changes:**
- New `/shop/admin/emails` endpoints

**Operator actions required:** Run `schema_email_templates.sql` and `seed_email_templates.sql`.

---

### Tier 3 — Nice to Have

#### 3.1 Back-in-Stock Notifications

- Extend `customers`: add opt-in notification list per product/variant
- `POST /shop/notify/stock` — register email for a specific product_id/variant_id
- Flatpay webhook: after stock is restored via refund, query notification list and send emails
- Schema: `api/src/schema_stock_notifications.sql`

#### 3.2 Abandoned Cart Recovery

- Requires customer email capture before checkout completion
- `cart_sessions` table with email, cart JSON, captured_at, last_activity_at, recovered_at
- Scheduled email (operator-triggered via cron or a `/shop/admin/cron/abandoned-carts` endpoint callable by a cPanel cron job) sends reminder after 2 hours of inactivity
- Schema: `api/src/schema_abandoned_carts.sql`

#### 3.3 Product Reviews

- New schema table: `product_reviews` (product_id, customer_email, rating 1-5, body, approved, created_at)
- `POST /shop/products/:slug/review` — public submission (rate-limited)
- `GET /shop/admin/reviews` + `PUT /shop/admin/reviews/:id/approve` + `DELETE /shop/admin/reviews/:id`
- Storefront product detail: display approved reviews with star rating and average
- Schema: `api/src/schema_product_reviews.sql`

#### 3.4 Bulk Product Import/Export

- `GET /shop/admin/products/export.csv` — download all products as CSV
- `POST /shop/admin/products/import` — multipart CSV upload; validate headers; upsert by SKU
- Admin products page: import/export buttons

---

## New Schema Files Required

| File | Purpose | Tier |
|------|---------|------|
| `api/src/schema_stock_reservations.sql` | `stock_reservations` table | 1 |
| `api/src/schema_order_notes.sql` | `customer_note` column on orders | 1 |
| `api/src/schema_shipping_zones.sql` | `countries` column on shipping_methods | 2 |
| `api/src/schema_customer_accounts.sql` | `customer_sessions`, password/email columns | 2 |
| `api/src/schema_email_templates.sql` | `email_templates` table | 2 |
| `api/src/seed_email_templates.sql` | Default transactional email content | 2 |
| `api/src/schema_stock_notifications.sql` | Back-in-stock notification list | 3 |
| `api/src/schema_abandoned_carts.sql` | Abandoned cart sessions | 3 |
| `api/src/schema_product_reviews.sql` | Product review table | 3 |

---

## New API Endpoints Required

| Endpoint | Method | Auth | Tier |
|----------|--------|------|------|
| `/shop/search` | GET | None | 1 |
| `/shop/cart/reserve` | POST | None | 1 |
| `/shop/admin/dashboard` | GET | JWT | 1 (page only, API exists) |
| `/shop/admin/orders/:id/refund` | POST | JWT | 1 |
| `/shop/admin/orders/:id/note` | POST | JWT | 1 |
| `/shop/auth/register` | POST | None | 2 |
| `/shop/auth/login` | POST | None | 2 |
| `/shop/auth/logout` | POST | Session | 2 |
| `/shop/auth/me` | GET | Session | 2 |
| `/shop/orders/my` | GET | Session | 2 |
| `/shop/admin/emails` | GET | JWT | 2 |
| `/shop/admin/emails/:slug` | GET/PUT | JWT | 2 |
| `/shop/notify/stock` | POST | None | 3 |
| `/shop/admin/reviews` | GET | JWT | 3 |
| `/shop/admin/reviews/:id` | PUT/DELETE | JWT | 3 |
| `/shop/admin/products/export.csv` | GET | JWT | 3 |
| `/shop/admin/products/import` | POST | JWT | 3 |

---

## New Storefront Pages Required

| Page | Purpose | Tier |
|------|---------|------|
| `src/pages/shop/konto/index.astro` | Customer order history | 2 |
| `src/pages/shop/konto/login.astro` | Customer login | 2 |
| `src/pages/shop/konto/register.astro` | Customer registration | 2 |

---

## New Admin Pages Required

| Page | Purpose | Tier |
|------|---------|------|
| `src/pages/admin/shop/dashboard.astro` | Shop KPI dashboard | 1 |
| `src/pages/admin/shop/emails.astro` | Email template editor | 2 |

---

## New Components Required

| Component | Purpose | Tier |
|-----------|---------|------|
| `src/components/SearchBar.astro` | Storefront product search | 1 |
| `src/components/ProductFilters.astro` | Category page filters | 2 |

---

## Files to Modify

| File | Change | Tier |
|------|--------|------|
| `api/src/routes/shop-public.cjs` | Add `/shop/search`, `/shop/cart/reserve`, `/shop/auth/*`, `/shop/orders/my`, `/shop/notify/stock` | 1+2+3 |
| `api/src/routes/shop-admin.cjs` | Add `/shop/admin/orders/:id/refund`, `/:id/note`, `/emails`, `/reviews`, `/products/export.csv`, `/products/import` | 1+2+3 |
| `api/src/services/shop-email.cjs` | Load templates from DB with hardcoded fallback | 2 |
| `src/pages/shop/checkout.astro` | Add customer_note field, call `/shop/cart/reserve` before order submit, send `reservation_token` | 1 |
| `src/pages/shop/produkt/[slug].astro` | Use `available_stock` from API response | 1 |
| `src/components/Header.astro` | Inject `SearchBar` when shop is active | 1 |
| `src/pages/shop/index.astro` | Add `SearchBar` to hero area | 1 |
| `src/pages/shop/[category].astro` | Add `ProductFilters` sidebar | 2 |
| `src/pages/admin/shop/orders.astro` | Add refund modal, internal note section, event timeline | 1 |
| `src/layouts/AdminLayout.astro` | Add Shop Dashboard link to shop nav section | 1 |

---

## Outside-Folder Dependencies

None introduced in this phase. All new features use the existing:
- MySQL database via `api/src/db.js`
- Flatpay / Frisbii webhook (no new webhook events required)
- Resend email service (existing credential and pattern)
- cPanel Node.js app (no runtime change required)

---

## Required Handoff Artifacts

At completion of each Tier 1 lane, the implementing agent must produce:

- Updated `CHANGELOG.md` (root) and `local-mirror/CHANGELOG.md` entries under `[Unreleased]`
- SQL operator packet: each new schema file listed above, with run-order notes for `api/run-schema.cjs`
- API contract update: note any new or changed endpoint shapes in `docs/SCHEMA_OVERVIEW.md` or inline in this document
- Regression note: confirm no existing checkout, order, or payment flow was changed

---

## Acceptance Checks

- [ ] Shop dashboard page renders KPIs from the existing `/shop/admin/dashboard` endpoint
- [ ] Simultaneous checkout of the last unit by two sessions results in only one successful reservation; the second receives a stock error before the Flatpay session is created
- [ ] Storefront search returns products matching name, description, or SKU; empty query returns nothing or prompts a minimum character count
- [ ] Refund action via admin records an `order_events` row, optionally restores stock, and sends a customer email
- [ ] Customer note field at checkout is stored on the order and visible in admin detail view
- [ ] Internal admin notes are stored as `order_events` rows and displayed in the event timeline
- [ ] No existing API contract changed without a backwards-compatible extension
- [ ] All new schema files are idempotent (`IF NOT EXISTS`, `IF NOT EXISTS` column checks)
- [ ] `CHANGELOG.md` updated before handoff

---

## Hard Stop Conditions

- Inventory reservation implementation must not require an external scheduler (lazy sweep on request is acceptable)
- Customer accounts must not break the existing guest checkout flow
- Refund workflow must not delete or alter existing `order_items` or `orders` rows
- No payment or webhook contract may change without explicit operator verification

---

## Operator Actions Required at Rollout

| # | Action | Schema file | When |
|---|--------|-------------|------|
| 1 | Run stock reservations schema | `schema_stock_reservations.sql` | After Tier 1 deploy |
| 2 | Run order notes schema | `schema_order_notes.sql` | After Tier 1 deploy |
| 3 | Run shipping zones schema | `schema_shipping_zones.sql` | After Tier 2 deploy |
| 4 | Run customer accounts schema | `schema_customer_accounts.sql` | After Tier 2 deploy |
| 5 | Run email templates schema + seed | `schema_email_templates.sql`, `seed_email_templates.sql` | After Tier 2 deploy |
| 6 | Trigger Astro build + deploy | — | After each tier deploy |

All actions executed via SSH into the cPanel Node.js app environment. Follow the operator runbook in `local-mirror/docs/SSH_FIRST_OPERATIONS.md`.

---

## Rollback

Phase 4.1 changes are isolated. Each tier can be rolled back independently:

- **Tier 1:** Revert the 6 modified source files and the 2 new schema files. Stock reservation and order note columns are additive; they can be left in place without harm. Remove the new admin dashboard page and the SearchBar component.
- **Tier 2:** Revert customer account pages and shipping zone column. Email template table can be left in place; the email service falls back to hardcoded defaults if the table is empty.
- **Tier 3:** Each feature is self-contained. Revert individually.

---

## Next Phase

**Phase 5:** CMS/Admin Productivity Uplift and Selected Old-V2 Improvements — dashboard usefulness, master-side workflow clarity, page/design-system/component productivity lanes, and AI workflow polish.
