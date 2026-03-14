# Installation Operator Packet

> Phase 3 cPanel/operator handoff. Documents every live step the installer (`scripts/setup.cjs`) cannot perform itself. Execute in the order listed.

---

## Scope

This packet covers a **new-client install** of Lavprishjemmeside CMS onto a cPanel shared-hosting server. It applies to:

- `lavprishjemmeside.dk` (parent / master site)
- `ljdesignstudio.dk` (existing pilot client)
- Any future client domain installed through the same CMS platform

The installer script (`scripts/setup.cjs`) handles: dependency install, `.env` write, schema migration, seed, Astro build, and Agent Enterprise provisioning. This packet covers the operator-owned steps that must happen **before** and **after** the installer runs.

---

## Pre-Install Checklist

Complete all items before running `node scripts/setup.cjs`.

### 1. cPanel: Create MySQL database and user

Log in to cPanel → MySQL Databases.

```
Database name : <cpanel_prefix>_<client_slug>    e.g. theartis_lavpris
Database user : <cpanel_prefix>_<client_slug_api> e.g. theartis_lavapi
Password      : <generate strong password, save to password manager>
```

Grant the user **ALL PRIVILEGES** on the database:

```
cPanel → MySQL Databases → Add User To Database → select user + db → ALL PRIVILEGES
```

Verify connectivity from the server shell:

```bash
mysql -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> -e "SELECT 1;"
```

Expected result: `1` returned with no error.

### 2. cPanel: Set up Node.js Application

Navigate to cPanel → Setup Node.js App → Create Application.

| Field | Value |
|-------|-------|
| Node.js version | 20.x (select highest available 20.x) |
| Application mode | Production |
| Application root | `repositories/<domain>/api` |
| Application URL | `api.<domain>` (e.g. `api.lavprishjemmeside.dk`) |
| Application startup file | `server.cjs` |

After creation, note the **application root path** shown in the panel — you will need it for SSH steps.

### 3. cPanel: DNS — point `api.<domain>` to server

Create a CNAME or A record in the domain DNS panel:

```
api.<domain>  →  same server IP as <domain>
```

Allow up to 24 hours for propagation. Verify with:

```bash
curl -s https://api.<domain>/health
```

Expected response: `{ "status": "ok", ... }`

### 4. SSH: Clone the repository

```bash
cd ~/repositories
git clone git@github.com:<owner>/<repo>.git <domain>
cd <domain>
```

> If the repo does not exist yet, create it on GitHub first and push the Lavprishjemmeside local-mirror contents.

### 5. SSH: Create `api/.env` before running the installer

The installer will write `.env` for you interactively, but the file must be writable. Confirm the `api/` directory is present:

```bash
ls ~/repositories/<domain>/api/
```

You will be prompted for all values during setup. Have the following credentials ready:

| Variable | Where to find it |
|----------|-----------------|
| `DB_HOST` | Usually `localhost` or `127.0.0.1` on cPanel |
| `DB_USER` | Created in step 1 |
| `DB_PASSWORD` | Created in step 1 |
| `DB_NAME` | Created in step 1 |
| `JWT_SECRET` | Installer generates automatically |
| `CORS_ORIGIN` | `https://<domain>,https://www.<domain>` |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `EMAIL_FROM_ADDRESS` | `info@<domain>` (must be a verified sender in Resend) |
| `ANTHROPIC_API_KEY` | Anthropic console → API Keys |
| `GITHUB_PAT` | GitHub → Settings → Developer settings → Personal access tokens (scope: `repo` or `workflow`) |
| `AGENT_ENTERPRISE_URL` | Tailscale Funnel origin for the Lavpris ingress (from Agent Enterprise operator) |
| `AGENT_ENTERPRISE_PROVISION_TOKEN` | From Agent Enterprise operator — one-time provisioning token |
| `PEXELS_API_KEY` | Pexels API dashboard (optional — leave blank to disable) |
| `FLATPAY_API_KEY` | Flatpay merchant dashboard → API Keys (only if shop is enabled) |
| `FLATPAY_WEBHOOK_SECRET` | Flatpay merchant dashboard → Webhooks |

---

## Running the Installer

From the repo root on the server over SSH:

```bash
cd ~/repositories/<domain>
node scripts/setup.cjs
```

The installer will prompt for all values, run schema migrations, seed data, build the Astro site, and provision the Agent Enterprise assistant binding.

**If the installer is interrupted**, re-run the same command. It reads `.setup-state.json` and skips already-completed steps. To force a full restart from scratch:

```bash
node scripts/setup.cjs --reset
```

---

## Post-Install Steps

Complete after the installer reports success.

### 6. cPanel: Point document root to `dist/`

Navigate to cPanel → Domains (or Subdomains) → find `<domain>` → Edit Document Root.

Set document root to:

```
/home/<cpanel_user>/repositories/<domain>/dist
```

> Without this step the site will serve a directory listing or a default cPanel page instead of the built Astro output.

### 7. SSH: Confirm `.htaccess` is in place

The Astro build writes `dist/.htaccess` from `public/.htaccess`. Verify it is present:

```bash
ls ~/repositories/<domain>/dist/.htaccess
```

If missing, rebuild:

```bash
cd ~/repositories/<domain> && npm run build
```

### 8. Verify the API is running

Restart the Node.js app via **cPanel › Setup Node.js App › Restart** (current primary method).

Then test:

```bash
curl -s https://api.<domain>/health
```

Expected: `{ "status": "ok", "db": "ok", ... }`

If `db` is not `ok`, check `api/.env` DB credentials and MySQL connectivity.

### 9. Verify the live site

```bash
curl -I https://<domain>/
```

Expected: `HTTP/2 200` with `Content-Type: text/html`.

Open the admin login:

```
https://<domain>/admin/
```

Log in with the admin credentials set during the installer prompt (step 2 of the installer).

### 10. Register Flatpay webhook (if shop enabled)

In the Flatpay merchant dashboard → Webhooks:

```
URL: https://api.<domain>/shop/flatpay/webhook
Events: payment.succeeded, payment.failed, payment.refunded
```

Confirm the webhook secret in `api/.env` matches the value shown in the dashboard.

Test the webhook endpoint:

```bash
curl -s -X POST https://api.<domain>/shop/flatpay/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Expected: `{ "received": true }` or a 400 (signature mismatch) — either confirms the route is live.

### 11. Set `FLATPAY_TEST_MODE=false` when going live with payments

In `api/.env` on the server:

```bash
# Edit: ~/repositories/<domain>/api/.env
FLATPAY_TEST_MODE=false
```

Then restart the Node.js app via **cPanel › Setup Node.js App › Restart**.

---

## Env / Config Handoff

### Purpose
- Configure all runtime credentials for the new client install
- Enable the assistant binding, email, AI generation, traffic dashboard, and payment flows

### Affected Sites
- New client install (any domain)

### Variables

| Variable | Shape | Required |
|----------|-------|----------|
| `DB_HOST` | hostname or `localhost` | Yes |
| `DB_USER` | cPanel DB username | Yes |
| `DB_PASSWORD` | DB password | Yes |
| `DB_NAME` | cPanel DB name | Yes |
| `JWT_SECRET` | 64+ char random string | Yes (auto-generated) |
| `PORT` | integer, default `3000` | No |
| `CORS_ORIGIN` | comma-separated URLs | Yes |
| `RESEND_API_KEY` | `re_xxx...` | Yes (for password reset + order emails) |
| `EMAIL_FROM_NAME` | display name string | Yes |
| `EMAIL_FROM_ADDRESS` | verified Resend sender | Yes |
| `PASSWORD_RESET_BASE_URL` | `https://<domain>` | Yes |
| `AGENT_ENTERPRISE_URL` | Funnel origin URL | Yes |
| `AGENT_ENTERPRISE_PROVISION_TOKEN` | one-time provision token | Yes (installer uses, then no longer needed) |
| `AGENT_ENTERPRISE_SITE_KEY` | provisioned by installer | Auto |
| `AGENT_ENTERPRISE_SITE_TOKEN` | provisioned by installer | Auto |
| `AGENT_ENTERPRISE_CLIENT_AGENT_ID` | provisioned by installer | Auto |
| `ANTHROPIC_API_KEY` | `sk-ant-xxx...` | Yes (for AI page generation) |
| `GITHUB_PAT` | `ghp_xxx...` | Yes (for admin publish button) |
| `PEXELS_API_KEY` | Pexels key | Optional |
| `FLATPAY_API_KEY` | `priv_xxx...` | If shop enabled |
| `FLATPAY_WEBHOOK_SECRET` | `whsec_xxx...` | If shop enabled |
| `FLATPAY_TEST_MODE` | `true` / `false` | If shop enabled |
| `FLATPAY_WEBHOOK_URL` | `https://api.<domain>/shop/flatpay/webhook` | If shop enabled |
| `FLATPAY_ACCEPT_URL` | `https://<domain>/shop/ordre` | If shop enabled |
| `FLATPAY_CANCEL_URL` | `https://<domain>/shop/checkout?cancelled=1` | If shop enabled |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | service account email | Optional (for traffic dashboard) |
| `GOOGLE_PRIVATE_KEY` | RSA PEM block | Optional |
| `GOOGLE_SITE_URL` | Search Console verified property | Optional |
| `GOOGLE_GA4_PROPERTY_ID` | 9-digit numeric ID | Optional |
| `MASTER_API_KEY` | 32-byte hex string | Optional (for IAN heartbeat) |

### Apply Location
`~/repositories/<domain>/api/.env`

### Restart / Build Requirement
After any `.env` change: **cPanel › Setup Node.js App › Restart** (current primary method).

After `PUBLIC_API_URL` or `PUBLIC_SITE_URL` changes (Astro build-time vars):
```bash
cd ~/repositories/<domain> && npm run build
```
then sync `dist/` to the document root.

### Rollback
Restore from backup copy of `api/.env` kept in the operator password manager or secure vault.

### Verification
```bash
curl -s https://api.<domain>/health
```

---

## SQL Schema Handoff

### Purpose
- Initialize all database tables for the new client install

### Affected Sites
- New client install (any domain)

### Artifact
`~/repositories/<domain>/api/run-schema.cjs`

Runs all files in `SCHEMA_ORDER` plus seed files `seed_components_v2.sql` and `seed_master.sql`.

### Run Order
The installer runs schema automatically. To run manually:

```bash
cd ~/repositories/<domain>/api
node run-schema.cjs
```

### Idempotency
Safe to re-run. Already-applied statements are skipped. Only non-idempotent errors abort.

### Rollback
Drop the database and recreate it, then re-run `run-schema.cjs`. (New installs only — do not drop a live production database without a dump backup.)

### Verification Queries
```sql
SHOW TABLES;
SELECT COUNT(*) FROM components;
SELECT COUNT(*) FROM users;
```

Expected: all core tables present, component library rows seeded, at least one admin user present.

### Post-Run Notes
- Schema runner outputs a summary table on completion: `Files OK / Files empty / Files missing`
- If any file shows `FATAL`, check the error for the specific statement and MySQL error code
- Common safe-to-ignore: `ER_TABLE_EXISTS_ERROR`, `ER_DUP_FIELDNAME`, `ER_DUP_KEYNAME`

---

## Live Verification Checklist

### Affected Sites
- Any newly installed domain

### Health Endpoints
```
GET https://api.<domain>/health
  → { "status": "ok", "db": "ok", "version": "...", "build_id": "..." }
```

### Admin Routes to Verify
```
https://<domain>/admin/             → login page loads
https://<domain>/admin/dashboard    → stats and version strip visible after login
https://<domain>/admin/pages        → page list loads
https://<domain>/admin/components   → component library renders
https://<domain>/admin/media        → media library loads
https://<domain>/admin/styling      → design settings load
https://<domain>/admin/assistant    → assistant wizard or active chat loads
```

### Assistant Route
```
https://<domain>/admin/assistant    → if provisioned: active chat panel shows
                                      if not provisioned: wizard step 1 shows
```

### Shop Routes (if enabled)
```
https://<domain>/shop/              → storefront loads
https://<domain>/shop/kurv          → cart page loads
https://<domain>/shop/checkout      → checkout form loads
https://<domain>/admin/shop/products → product admin loads
https://<domain>/admin/shop/orders   → orders admin loads
https://<domain>/admin/shop/settings → shop settings load
```

### Expected Success Conditions
- All pages return HTTP 200
- No JavaScript console errors on admin routes
- `api.<domain>/health` shows `"db": "ok"`
- Assistant chat responds to a test message if provisioning completed
- Admin user can log in with credentials set during install

---

## Rollback Note

### Target Baseline
Pre-install state: database not yet created, `dist/` not deployed.

### Rollback Trigger
- API `/health` returns `"db": "error"` after all `.env` corrections attempted
- Admin login fails after password reset
- Site returns 500 after install

### Artifacts to Restore
1. Drop the MySQL database and user created in step 1 (via cPanel → MySQL Databases → Delete)
2. Remove the Node.js application created in step 2 (cPanel → Setup Node.js App → Delete)
3. Remove the cloned repository: `rm -rf ~/repositories/<domain>`
4. Remove DNS record for `api.<domain>` if no longer needed
5. Remove Agent Enterprise provisioning entry if partial (contact Agent Enterprise operator)

---

## Notes for Agent Enterprise Operator

- `AGENT_ENTERPRISE_PROVISION_TOKEN` is consumed during install. A new token must be issued for each install.
- `AGENT_ENTERPRISE_SITE_KEY`, `AGENT_ENTERPRISE_SITE_TOKEN`, and `AGENT_ENTERPRISE_CLIENT_AGENT_ID` are written to `api/.env` by the installer and preserved in `.setup-state.json` across resume runs.
- If provisioning failed during install, re-run `node scripts/setup.cjs` — the installer retries provisioning up to 3 times. If provisioning still fails, request a fresh `AGENT_ENTERPRISE_PROVISION_TOKEN` from the operator and re-run with `--reset`.
- After provisioning, the assistant tab in the admin will activate automatically on next page load.
