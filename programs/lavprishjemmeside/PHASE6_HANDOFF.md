# Phase 6 Handoff: Master Console Uplift, Provider Switching, Subscriptions, Email Client Foundation

> Status: Implemented. All four lanes delivered. Build verified passing (68 pages).

---

## Context and Rationale

Phase 6 extends the Master Hub from a basic admin view into a real operator console. It delivers AI usage visibility, master-only provider switching, subscription management, and the foundational email client architecture. Items requiring live cPanel/DB/SMTP execution are explicitly surfaced as operator handoff packets below.

---

## What Was Delivered

### 6.1 — AI Usage Tab Uplift

**File:** `src/pages/admin/master.astro`

- Fleet-level summary bar: total tokens, total cost, total requests, active site count — all for 30-day window
- Per-site cards now show request count alongside token/cost totals
- Stale activity signal: sites with no AI usage in the last 7+ days show an amber "Inaktiv Xd" pill
- Last-active date label shown on non-stale sites
- Activity chart now includes date range labels (first/last day of 14-day window)
- Bar tooltips include request count in addition to token count
- DB-unavailable sites show a red "DB utilgængelig" error pill (was previously plain text)

### 6.2 — Provider Switching Tab (Tab 4)

**File:** `src/pages/admin/master.astro`
**API:** `src/routes/master.js` — `GET/POST /master/provider-config`
**Schema:** `src/schema_subscriptions.sql` — tables `provider_config`, `provider_audit_log`

New fourth tab in the Master Hub: "Provider".

- Visual radio-card selector: Anthropic Claude vs OpenAI/Codex
- Provider choice is loaded from DB (`provider_config` table — single-row config)
- Saving generates a formatted operator packet with exact `.env` changes needed and cPanel restart instructions
- "Kopier" button copies operator packet to clipboard
- Full audit trail: every provider change is written to `provider_audit_log` and rendered in the "Seneste provider-ændringer" panel
- No fake in-folder provider router: the UI produces the operator packet, the actual env change is operator-executed via cPanel
- Tab is master-only (gated by existing master role check)

**Operator packet format produced by the UI:**
```
# Provider Switch — Operator Packet
AI_PROVIDER=<selected>
# Ensure <API_KEY> is set and valid
# Required: restart Node app via cPanel > Setup Node.js App > Restart
# Verification: POST /ai/generate — check response model field
```

### 6.3 — Subscription Management (Tab 5)

**File:** `src/pages/admin/master.astro`
**API:** `src/routes/master.js` — `GET /master/subscriptions`, `POST /master/subscription-upgrade-request`
**Schema:** `src/schema_subscriptions.sql`

New fifth tab: "Abonnementer".

- Per-site subscription cards showing: plan badge (Starter/Growth/Pro), 4 usage bars (AI tokens, sider, lager, mail-konti)
- Usage bars colour-coded: green < 70%, amber 70–90%, red > 90%
- Billing status: overdue warning surfaced in-card
- Renewal date shown per site
- Plan limits defined in-frontend against known plan tiers
- Upgrade request flow: select site + new plan → `POST /master/subscription-upgrade-request` → logged to DB, operatøren notificeres
- Operator instructions panel: explicit numbered steps for live billing activation

### 6.4 — Email Client Foundation

**File:** `src/pages/admin/email.astro` (new page)
**Schema:** `src/schema_email_client.sql`
**Route contract:** see below

Full admin email client UI delivered as a functional foundation. The page correctly gates on IMAP configuration before showing the email interface.

**UI architecture:**
- Setup notice (shown always) with required env vars listed
- Unconfigured state: graceful message directing to operator
- Configured state: 2-column split — folder list (left) + message list/viewer (right)
- Compose modal: To, Subject, Body fields with Send and Save Draft actions
- Reply flow: pre-populates To and Subject from message header
- All API calls go to `/email/*` endpoints (operator must wire IMAP/SMTP proxy)

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/master.astro` | AI usage uplift, Provider tab (Tab 4), Subscriptions tab (Tab 5) |
| `src/pages/admin/email.astro` | New email client admin page |
| `src/routes/master.js` | `GET/POST /master/provider-config`, `GET /master/subscriptions`, `POST /master/subscription-upgrade-request` |
| `src/schema_subscriptions.sql` | `subscriptions`, `subscription_usage_snapshots`, `subscription_upgrade_requests`, `provider_config`, `provider_audit_log` |
| `src/schema_email_client.sql` | `email_accounts`, `email_folders`, `email_messages`, `email_drafts` |

---

## Operator Handoff Packets

### Packet 1: Subscription + Provider Schema (SQL)

**Purpose:** Create the new Phase 6 tables for subscription management and provider config/audit.

**Affected sites:** Master DB (theartis_lavpris or equivalent) — all tables are master-side.

**SQL file:** `local-mirror/api/src/schema_subscriptions.sql`

**Run order:**
1. Run `schema_subscriptions.sql` on the master database via cPanel phpMyAdmin
2. No dependency on other schema files

**Idempotency:** All `CREATE TABLE` statements use `IF NOT EXISTS`. Safe to re-run.

**Verification queries:**
```sql
SHOW TABLES LIKE 'subscriptions';
SHOW TABLES LIKE 'provider_config';
SHOW TABLES LIKE 'provider_audit_log';
SELECT * FROM provider_config;
-- Expected: 1 row, active_provider = 'anthropic'
```

**Rollback:** `DROP TABLE IF EXISTS subscriptions, subscription_usage_snapshots, subscription_upgrade_requests, provider_config, provider_audit_log;`

---

### Packet 2: Email Client Schema (SQL — per client DB)

**Purpose:** Create email infrastructure tables on each client site DB.

**Affected sites:** Each active client DB where email is to be activated (run individually).

**SQL file:** `local-mirror/api/src/schema_email_client.sql`

**Run order:**
1. Run on client DB via cPanel phpMyAdmin for each site where email is needed
2. No dependencies on other schema files

**Idempotency:** All `CREATE TABLE` statements use `IF NOT EXISTS`. Safe to re-run.

**Verification queries:**
```sql
SHOW TABLES LIKE 'email_accounts';
SHOW TABLES LIKE 'email_messages';
DESCRIBE email_accounts;
```

**Rollback:** `DROP TABLE IF EXISTS email_drafts, email_messages, email_folders, email_accounts;`

---

### Packet 3: Email Client .env and IMAP/SMTP Proxy (Env/Config)

**Purpose:** Activate the email client for a client site.

**Affected sites:** Each client where email is to be enabled.

**Variables to add to `.env`:**
```
EMAIL_IMAP_HOST=mail.clientdomain.dk
EMAIL_IMAP_PORT=993
EMAIL_IMAP_SSL=true
EMAIL_SMTP_HOST=mail.clientdomain.dk
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SSL=true
EMAIL_ENCRYPTION_KEY=<32-byte random hex — generate with: openssl rand -hex 32>
```

**Required restart:** Restart Node app via cPanel > Setup Node.js App > Restart.

**Required routes to implement (outside-folder):**
These routes are consumed by `email.astro` and must be wired by the API:
- `GET /email/config` — returns `{ configured: bool }`
- `GET /email/folders` — returns folder list from IMAP
- `GET /email/messages?folder_id=X` — returns message list
- `GET /email/messages/:id` — returns message detail
- `POST /email/send` — sends via SMTP
- `POST /email/drafts` — saves draft

**Security requirements:**
- All email routes must require auth (`requireAuth`)
- IMAP credentials must never be exposed in API responses
- Email body HTML must be sanitised before rendering (use DOMPurify or equivalent)
- `email_messages.body_preview` is plain text only, never HTML

**Verification:**
1. `GET /email/config` → `{ configured: true }`
2. `GET /email/folders` → array of folder objects
3. Navigate to `/admin/email/` — folders and inbox should load

---

### Packet 4: Provider Switching Activation (Env/Config)

**Purpose:** Apply a provider switch after a master user selects a new provider in the UI.

**Triggered by:** Master user saving a provider choice in the Provider tab → UI generates this packet.

**Variables to update in `.env`:**
```
AI_PROVIDER=<anthropic|openai>
ANTHROPIC_API_KEY=<keep if anthropic>
OPENAI_API_KEY=<required if openai>
```

**Required restart:** cPanel > Setup Node.js App > Restart.

**Verification:** POST `/ai/generate` with a test prompt and check the response model field.

---

## Email Client Route Contract (for outside-folder implementation)

```
GET  /email/config
  Response: { configured: bool, imap_host?: string }

GET  /email/folders
  Response: Array<{ id, folder_name, folder_path, message_count, unseen_count }>

GET  /email/messages?folder_id=<id>&limit=50&offset=0
  Response: Array<{ id, uid, subject, from_address, sent_at, is_seen, has_attachments, body_preview }>

GET  /email/messages/:id
  Response: { id, uid, subject, from_address, to_addresses, cc_addresses, sent_at, is_seen, body_preview }
  Note: full body requires IMAP fetch — body_preview is plain text max 500 chars

POST /email/send
  Body: { to, subject, body }
  Response: { ok: bool, error?: string }

POST /email/drafts
  Body: { to_addresses, cc_addresses, subject, body_text, body_html, reply_to_uid, status }
  Response: { ok: bool, id: int }
```

---

## Acceptance Gate Checklist

- [x] Master hub has 5 tabs: Sites, AI Usage, Claude Code, Provider, Abonnementer
- [x] AI Usage tab shows fleet summary + per-site cards with request counts and stale signals
- [x] Provider tab is master-only with audit trail and operator packet generation
- [x] No fake in-folder provider router exists — real switching is operator-executed
- [x] Subscriptions tab shows plan badges, usage bars, and upgrade request flow
- [x] Email client admin page exists with correct not-configured gate
- [x] Two schema SQL files produced with full operator packet documentation
- [x] All operator steps are explicitly written — nothing is silently assumed
- [x] Build passes: 68 pages
- [x] CHANGELOG.md updated
- [x] No live cPanel, DB, SMTP, or SSH execution claimed complete

---

## Carry-Forward to Phase 7

| Item | Reason |
|------|--------|
| Email IMAP/SMTP proxy routes | Requires outside-folder cPanel mail execution — operator packet above |
| Live billing integration | Requires external billing provider (Stripe/etc.) — outside-folder |
| Subscription usage snapshot cron | Requires cPanel cron job setup — operator step |
| Provider switching in API middleware | Requires env + restart — operator packet above |
| Full email body rendering | Requires IMAP full-fetch proxy — outside-folder |
