/**
 * 1-click installer: prompts (or env), write api/.env, run schema, seed, spawn API, build, copy dist.
 * Run: npm run setup
 * Non-interactive: SETUP_INTERACTIVE=0 PUBLIC_SITE_URL=... PUBLIC_API_URL=... DB_HOST=... DB_NAME=... DB_USER=... DB_PASSWORD=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/setup.cjs
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'api');
const ENV_DIST = path.join(API_DIR, '.env.dist');
const ENV_FILE = path.join(API_DIR, '.env');
const STATE_FILE = path.join(ROOT, '.setup-state.json');

// ─── Setup state persistence ──────────────────────────────────
// Allows partial-install recovery: completed steps are skipped on re-run.
function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (_) {}
  return { completed: [], lastVars: {} };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (_) {}
}

function markDone(state, step) {
  if (!state.completed.includes(step)) {
    state.completed.push(step);
  }
  saveState(state);
}

function isDone(state, step) {
  return state.completed.includes(step);
}

function clearState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  } catch (_) {}
}

// ─── Prompts ──────────────────────────────────────────────────
function ask(rl, prompt, defaultVal) {
  const def = defaultVal !== undefined && defaultVal !== '' ? ` [${defaultVal}]` : '';
  return new Promise((resolve) => {
    rl.question(`${prompt}${def}: `, (ans) => resolve(ans !== undefined && ans.trim() !== '' ? ans.trim() : (defaultVal || '')));
  });
}

// ─── Validation helpers ────────────────────────────────────────
function checkNode() {
  const v = process.version.slice(1).split('.').map(Number);
  if (v[0] < 18) {
    console.error('[SETUP] ERROR: Node 18+ required. Current:', process.version);
    process.exit(1);
  }
}

function validateUrl(url, label) {
  try {
    new URL(url);
    return true;
  } catch (_) {
    console.error(`[SETUP] ERROR: ${label} is not a valid URL: "${url}"`);
    return false;
  }
}

function validateRequired(vars) {
  const required = [
    ['dbName', 'DB_NAME'],
    ['dbUser', 'DB_USER'],
    ['dbPass', 'DB_PASSWORD'],
    ['adminEmail', 'ADMIN_EMAIL'],
    ['adminPassword', 'ADMIN_PASSWORD'],
    ['agentEnterpriseUrl', 'AGENT_ENTERPRISE_URL'],
    ['agentEnterpriseProvisionToken', 'AGENT_ENTERPRISE_PROVISION_TOKEN'],
  ];
  const missing = required.filter(([key]) => !vars[key]);
  if (missing.length) {
    console.error('[SETUP] ERROR: Missing required values:', missing.map(([, name]) => name).join(', '));
    return false;
  }
  if (!validateUrl(vars.siteUrl, 'PUBLIC_SITE_URL')) return false;
  if (!validateUrl(vars.apiUrl, 'PUBLIC_API_URL')) return false;
  if (!validateUrl(vars.agentEnterpriseUrl, 'AGENT_ENTERPRISE_URL')) return false;
  return true;
}

// ─── env builder ──────────────────────────────────────────────
function buildEnv(vars) {
  const hostname = vars.siteUrl ? new URL(vars.siteUrl).hostname : 'app.example.dk';
  return [
    `DB_HOST=${vars.dbHost}`,
    `DB_USER=${vars.dbUser}`,
    `DB_PASSWORD=${vars.dbPassword}`,
    `DB_NAME=${vars.dbName}`,
    `JWT_SECRET=${vars.jwtSecret || require('crypto').randomBytes(32).toString('hex')}`,
    'PORT=3000',
    `CORS_ORIGIN=${vars.siteUrl}`,
    `PASSWORD_RESET_BASE_URL=${vars.siteUrl}`,
    'PASSWORD_RESET_TOKEN_EXPIRY_MINUTES=60',
    'RESEND_API_KEY=',
    `EMAIL_FROM_NAME=${hostname}`,
    `EMAIL_FROM_ADDRESS=noreply@${hostname}`,
    'ANTHROPIC_API_KEY=',
    'GITHUB_PAT=',
    'GITHUB_REPO=',
    'GOOGLE_SITE_URL=',
    'GOOGLE_GA4_PROPERTY_ID=',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL=',
    'GOOGLE_PRIVATE_KEY=',
    `AGENT_ENTERPRISE_URL=${vars.agentEnterpriseUrl || ''}`,
    `AGENT_ENTERPRISE_PROVISION_TOKEN=${vars.agentEnterpriseProvisionToken || ''}`,
    `AGENT_ENTERPRISE_LAVPRIS_MASTER_TOKEN=${vars.agentEnterpriseMasterToken || ''}`,
    `LAVPRIS_PARENT_API_URL=${vars.lavprisParentApiUrl || 'https://api.lavprishjemmeside.dk'}`,
    `AGENT_ENTERPRISE_SITE_KEY=${vars.agentEnterpriseSiteKey || ''}`,
    `AGENT_ENTERPRISE_SITE_TOKEN=${vars.agentEnterpriseSiteToken || ''}`,
    `AGENT_ENTERPRISE_CLIENT_AGENT_ID=${vars.agentEnterpriseClientAgentId || ''}`,
    '',
  ].join('\n');
}

// ─── Retry-capable exec ────────────────────────────────────────
function execWithRetry(label, cmd, options, retries = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`[SETUP] ${label}${attempt > 1 ? ` (retry ${attempt - 1}/${retries})` : ''}`);
      execSync(cmd, options);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt <= retries) {
        console.warn(`[SETUP] WARNING: "${label}" failed, retrying in 3s…`);
        const start = Date.now();
        while (Date.now() - start < 3000) {}
      }
    }
  }
  throw new Error(`[SETUP] FAILED: ${label} after ${retries + 1} attempts.\n${lastErr && lastErr.message}`);
}

// ─── Health poller ─────────────────────────────────────────────
async function pollHealth(maxMs) {
  const start = Date.now();
  let lastStatus = '';
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://localhost:3000/health');
      if (res.ok) return { ok: true };
      lastStatus = `HTTP ${res.status}`;
    } catch (err) {
      lastStatus = err.message;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false, lastStatus };
}

// ─── JSON response helper ──────────────────────────────────────
async function parseJson(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }

  if (!response.ok) {
    const msg = (payload && payload.error) ? payload.error : `HTTP ${response.status}`;
    throw new Error(`Agent Enterprise provisioning failed: ${msg}`);
  }

  return payload;
}

// ─── Provisioning ──────────────────────────────────────────────
async function provisionAssistantForSite(vars) {
  const origin = String(vars.agentEnterpriseUrl || '').replace(/\/+$/, '');
  const domain = new URL(vars.siteUrl).hostname;

  console.log('[SETUP] Provisioning dedicated assistant for', domain);

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${origin}/api/lavpris/client-agents/provision`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-lavpris-provision-token': vars.agentEnterpriseProvisionToken,
        },
        body: JSON.stringify({
          domain,
          siteLabel: domain,
          installSource: 'lavprishjemmeside-cms-setup',
        }),
      });
      return await parseJson(response);
    } catch (err) {
      lastErr = err;
      console.warn(`[SETUP] WARNING: Provisioning attempt ${attempt}/3 failed: ${err.message}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }
  throw lastErr;
}

// ─── Step printers ─────────────────────────────────────────────
function stepHeader(n, total, label) {
  const pad = String(n).padStart(2, ' ');
  console.log(`\n[SETUP] ── Step ${pad}/${total}: ${label}`);
}

function stepSkip(n, total, label) {
  console.log(`[SETUP] ── Step ${String(n).padStart(2, ' ')}/${total}: ${label} [SKIPPED — already done]`);
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  checkNode();

  const TOTAL_STEPS = 10;
  const forceReset = process.argv.includes('--reset');
  if (forceReset) {
    console.log('[SETUP] --reset flag detected. Clearing prior state for a clean run.\n');
    clearState();
  }

  const state = readState();
  const interactive = process.env.SETUP_INTERACTIVE !== '0';

  // ── Collect variables ────────────────────────────────────────
  let siteUrl = process.env.PUBLIC_SITE_URL || (state.lastVars.siteUrl || '');
  let apiUrl = process.env.PUBLIC_API_URL || (state.lastVars.apiUrl || '');
  let dbHost = process.env.DB_HOST || (state.lastVars.dbHost || '127.0.0.1');
  let dbName = process.env.DB_NAME || (state.lastVars.dbName || '');
  let dbUser = process.env.DB_USER || (state.lastVars.dbUser || '');
  let dbPass = process.env.DB_PASSWORD || (state.lastVars.dbPass || '');
  let adminEmail = process.env.ADMIN_EMAIL || (state.lastVars.adminEmail || '');
  let adminPassword = process.env.ADMIN_PASSWORD || '';
  let outputPath = process.env.SETUP_OUTPUT_PATH || (state.lastVars.outputPath || '');
  let agentEnterpriseUrl = process.env.AGENT_ENTERPRISE_URL || (state.lastVars.agentEnterpriseUrl || '');
  let agentEnterpriseProvisionToken = process.env.AGENT_ENTERPRISE_PROVISION_TOKEN || '';
  let agentEnterpriseMasterToken = process.env.AGENT_ENTERPRISE_LAVPRIS_MASTER_TOKEN || '';
  let lavprisParentApiUrl = process.env.LAVPRIS_PARENT_API_URL || (state.lastVars.lavprisParentApiUrl || 'https://api.lavprishjemmeside.dk');
  // Preserve provisioned tokens across resume
  let agentEnterpriseSiteKey = state.lastVars.agentEnterpriseSiteKey || '';
  let agentEnterpriseSiteToken = state.lastVars.agentEnterpriseSiteToken || '';
  let agentEnterpriseClientAgentId = state.lastVars.agentEnterpriseClientAgentId || '';
  let jwtSecret = state.lastVars.jwtSecret || '';

  if (interactive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('\n=== Lavpris CMS — 1-click setup\n');
    if (state.completed.length > 0) {
      console.log(`[SETUP] Resuming partial install. Completed steps: ${state.completed.join(', ')}`);
      console.log('[SETUP] Use --reset flag to start fresh.\n');
    }
    const domain = await ask(rl, 'Site domain (e.g. app.client.dk)', siteUrl ? new URL(siteUrl).hostname : 'app.client.dk');
    const apiSub = await ask(rl, 'API subdomain', apiUrl ? new URL(apiUrl).hostname : `api.${domain}`);
    siteUrl = `https://${domain.replace(/^https?:\/\//, '')}`;
    apiUrl = `https://${apiSub.replace(/^https?:\/\//, '')}`;

    dbHost = await ask(rl, 'DB host', dbHost || '127.0.0.1');
    dbName = await ask(rl, 'DB name', dbName);
    dbUser = await ask(rl, 'DB user', dbUser);
    dbPass = await ask(rl, 'DB password', dbPass);
    adminEmail = await ask(rl, 'Admin email', adminEmail || `admin@${domain}`);
    adminPassword = await ask(rl, 'Admin password', adminPassword);
    agentEnterpriseUrl = await ask(rl, 'Agent Enterprise URL', agentEnterpriseUrl || 'https://agent-enterprise.example.dk');
    agentEnterpriseProvisionToken = await ask(rl, 'Agent Enterprise provision token', agentEnterpriseProvisionToken);
    agentEnterpriseMasterToken = await ask(rl, 'Agent Enterprise master rollout token (optional)', agentEnterpriseMasterToken);
    lavprisParentApiUrl = await ask(rl, 'Parent rollout API URL', lavprisParentApiUrl);
    outputPath = await ask(rl, 'Output path for dist (default: ./deploy-output)', outputPath || './deploy-output');
    rl.close();
  } else {
    if (!siteUrl) siteUrl = 'https://app.example.dk';
    if (!apiUrl) apiUrl = 'https://api.app.example.dk';
    if (!outputPath) outputPath = './deploy-output';
  }

  const vars = {
    siteUrl, apiUrl, dbHost, dbName, dbUser, dbPass,
    adminEmail, adminPassword, outputPath,
    agentEnterpriseUrl, agentEnterpriseProvisionToken,
    agentEnterpriseMasterToken, lavprisParentApiUrl,
    agentEnterpriseSiteKey, agentEnterpriseSiteToken, agentEnterpriseClientAgentId,
    jwtSecret,
  };

  if (!validateRequired(vars)) {
    process.exit(1);
  }

  // Persist non-secret vars for resume
  state.lastVars = {
    siteUrl, apiUrl, dbHost, dbName, dbUser, dbPass: '', adminEmail,
    outputPath, agentEnterpriseUrl, lavprisParentApiUrl,
    agentEnterpriseSiteKey, agentEnterpriseSiteToken, agentEnterpriseClientAgentId,
    jwtSecret,
  };
  saveState(state);

  // ── Step 1: Write env ────────────────────────────────────────
  if (isDone(state, 'env')) {
    stepSkip(1, TOTAL_STEPS, 'Writing api/.env');
  } else {
    stepHeader(1, TOTAL_STEPS, 'Writing api/.env');
    if (!jwtSecret) {
      jwtSecret = require('crypto').randomBytes(32).toString('hex');
      vars.jwtSecret = jwtSecret;
      state.lastVars.jwtSecret = jwtSecret;
    }
    const envContent = buildEnv(vars);
    fs.writeFileSync(ENV_FILE, envContent, 'utf8');
    markDone(state, 'env');
    console.log('[SETUP] api/.env written.');
  }

  // ── Step 2: Install root deps ────────────────────────────────
  if (isDone(state, 'deps-root')) {
    stepSkip(2, TOTAL_STEPS, 'Installing root dependencies');
  } else {
    stepHeader(2, TOTAL_STEPS, 'Installing root dependencies');
    execWithRetry('npm ci (root)', 'npm ci', { cwd: ROOT, stdio: 'inherit' });
    markDone(state, 'deps-root');
  }

  // ── Step 3: Install API deps ──────────────────────────────────
  if (isDone(state, 'deps-api')) {
    stepSkip(3, TOTAL_STEPS, 'Installing API dependencies');
  } else {
    stepHeader(3, TOTAL_STEPS, 'Installing API dependencies');
    execWithRetry('npm ci --omit=dev (api)', 'npm ci --omit=dev', { cwd: API_DIR, stdio: 'inherit' });
    markDone(state, 'deps-api');
  }

  // ── Step 4: Schema + seed ────────────────────────────────────
  if (isDone(state, 'schema')) {
    stepSkip(4, TOTAL_STEPS, 'Running schema + seed');
  } else {
    stepHeader(4, TOTAL_STEPS, 'Running schema + seed');
    try {
      execSync('node api/run-schema.cjs', { cwd: ROOT, stdio: 'inherit' });
    } catch (err) {
      console.error('[SETUP] ERROR: Schema run failed.');
      console.error('[SETUP] Check DB credentials, DB host reachability, and that the DB exists.');
      console.error('[SETUP] Details:', err.message || err);
      console.error('[SETUP] Fix the issue and re-run setup. Completed steps will be skipped.');
      process.exit(1);
    }
    markDone(state, 'schema');
  }

  // ── Step 5: Admin user ────────────────────────────────────────
  if (isDone(state, 'admin-user')) {
    stepSkip(5, TOTAL_STEPS, 'Setting admin user');
  } else {
    stepHeader(5, TOTAL_STEPS, 'Setting admin user');
    try {
      execSync('node api/set-admin.cjs', {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword },
      });
    } catch (err) {
      console.error('[SETUP] ERROR: set-admin.cjs failed.');
      console.error('[SETUP] Ensure the DB and schema are in place (Step 4 must have succeeded).');
      console.error('[SETUP] Details:', err.message || err);
      process.exit(1);
    }
    markDone(state, 'admin-user');
  }

  // ── Step 6: Provision assistant ──────────────────────────────
  if (isDone(state, 'provision')) {
    stepSkip(6, TOTAL_STEPS, 'Provisioning Agent Enterprise assistant');
    if (!agentEnterpriseSiteKey || !agentEnterpriseSiteToken) {
      console.warn('[SETUP] WARNING: Provision was marked done but site key/token are missing in state.');
      console.warn('[SETUP] You may need to re-run with --reset to provision again.');
    }
  } else {
    stepHeader(6, TOTAL_STEPS, 'Provisioning Agent Enterprise assistant');
    let provisioned;
    try {
      provisioned = await provisionAssistantForSite(vars);
    } catch (err) {
      console.error('[SETUP] ERROR: Agent Enterprise provisioning failed after 3 attempts.');
      console.error('[SETUP]', err.message);
      console.error('[SETUP] Verify AGENT_ENTERPRISE_URL is reachable and AGENT_ENTERPRISE_PROVISION_TOKEN is valid.');
      console.error('[SETUP] Fix and re-run. Steps 1–5 will be skipped.');
      process.exit(1);
    }
    agentEnterpriseSiteKey = provisioned.siteKey || '';
    agentEnterpriseSiteToken = provisioned.siteToken || '';
    agentEnterpriseClientAgentId = provisioned.clientAgentId || '';
    vars.agentEnterpriseSiteKey = agentEnterpriseSiteKey;
    vars.agentEnterpriseSiteToken = agentEnterpriseSiteToken;
    vars.agentEnterpriseClientAgentId = agentEnterpriseClientAgentId;
    state.lastVars.agentEnterpriseSiteKey = agentEnterpriseSiteKey;
    state.lastVars.agentEnterpriseSiteToken = agentEnterpriseSiteToken;
    state.lastVars.agentEnterpriseClientAgentId = agentEnterpriseClientAgentId;

    // Rewrite env with provisioned tokens
    fs.writeFileSync(ENV_FILE, buildEnv(vars), 'utf8');
    markDone(state, 'provision');
    console.log('[SETUP] Assistant provisioned. Site key:', agentEnterpriseSiteKey);
  }

  // ── Step 7: Start API ────────────────────────────────────────
  stepHeader(7, TOTAL_STEPS, 'Starting API (background)');
  const apiProcess = spawn('node', ['server.cjs'], {
    cwd: API_DIR,
    stdio: 'pipe',
    env: { ...process.env, PORT: '3000' },
  });

  const apiErrors = [];
  apiProcess.stderr && apiProcess.stderr.on('data', (d) => {
    const msg = String(d).trim();
    if (msg) apiErrors.push(msg);
  });

  apiProcess.on('error', (err) => {
    console.error('[SETUP] FAILED to spawn API process:', err.message);
    process.exit(1);
  });

  // ── Step 8: Poll health ─────────────────────────────────────
  stepHeader(8, TOTAL_STEPS, 'Waiting for API /health (max 90s)');
  const healthResult = await pollHealth(90000);
  if (!healthResult.ok) {
    apiProcess.kill();
    console.error('[SETUP] ERROR: API did not become healthy within 90 seconds.');
    console.error('[SETUP] Last status:', healthResult.lastStatus || 'no response');
    if (apiErrors.length) {
      console.error('[SETUP] API stderr output:');
      apiErrors.slice(-10).forEach((line) => console.error('  ', line));
    }
    console.error('[SETUP] Check that PORT 3000 is free and api/.env has valid DB credentials.');
    process.exit(1);
  }
  console.log('[SETUP] API is healthy.');

  // ── Step 9: Build site ────────────────────────────────────────
  if (isDone(state, 'build')) {
    stepSkip(9, TOTAL_STEPS, 'Building site');
  } else {
    stepHeader(9, TOTAL_STEPS, 'Building site');
    try {
      execSync('npm run build', {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, PUBLIC_SITE_URL: siteUrl, PUBLIC_API_URL: apiUrl },
      });
    } catch (err) {
      apiProcess.kill();
      console.error('[SETUP] ERROR: Site build failed. Check TypeScript errors and Astro config.');
      console.error('[SETUP] Details:', err.message || err);
      process.exit(1);
    }
    markDone(state, 'build');
  }

  // ── Stop API ────────────────────────────────────────────────
  console.log('[SETUP] Stopping background API.');
  apiProcess.kill();

  // ── Step 10: Copy dist ────────────────────────────────────────
  if (isDone(state, 'copy-dist')) {
    stepSkip(10, TOTAL_STEPS, 'Copying dist to output path');
  } else {
    stepHeader(10, TOTAL_STEPS, 'Copying dist to output path');
    const outAbs = path.resolve(ROOT, outputPath);
    if (!fs.existsSync(outAbs)) fs.mkdirSync(outAbs, { recursive: true });
    const distDir = path.join(ROOT, 'dist');
    if (fs.existsSync(distDir)) {
      const entries = fs.readdirSync(distDir, { withFileTypes: true });
      let copied = 0;
      for (const e of entries) {
        const src = path.join(distDir, e.name);
        const dest = path.join(outAbs, e.name);
        if (e.isDirectory()) {
          if (fs.existsSync(dest)) {
            try { fs.rmSync(dest, { recursive: true }); } catch (_) {}
          }
          fs.cpSync(src, dest, { recursive: true });
        } else {
          fs.copyFileSync(src, dest);
        }
        copied++;
      }
      console.log(`[SETUP] Copied ${copied} entries to ${outAbs}`);
    } else {
      console.warn('[SETUP] WARNING: dist/ directory not found. Build may have placed output elsewhere.');
    }
    markDone(state, 'copy-dist');
  }

  // ── Clear state on full success ──────────────────────────────
  clearState();

  // ── Summary ──────────────────────────────────────────────────
  const outAbs = path.resolve(ROOT, outputPath);
  console.log('\n════════════════════════════════════════════════════════');
  console.log(' Setup complete');
  console.log('════════════════════════════════════════════════════════');
  console.log('');
  console.log('Next steps — operator to complete in cPanel:');
  console.log('');
  console.log('  1) cPanel → Setup Node.js App');
  console.log('     Application root : (full path to)/api');
  console.log('     Startup file      : server.cjs');
  console.log('     App URL / domain  :', apiUrl ? new URL(apiUrl).hostname : 'api.yourdomain.dk');
  console.log('');
  console.log('  2) Point site document root to:', outAbs);
  console.log('');
  console.log('  3) Admin login');
  console.log('     URL   :', siteUrl + '/admin/');
  console.log('     Email :', adminEmail);
  console.log('');
  console.log('  4) Assistant credentials');
  console.log('     Site key     :', agentEnterpriseSiteKey || '(see api/.env)');
  console.log('     Client agent :', agentEnterpriseClientAgentId || '(see api/.env)');
  console.log('');
  console.log('  5) Set required API keys in api/.env before going live:');
  console.log('     ANTHROPIC_API_KEY, RESEND_API_KEY, GITHUB_PAT, GOOGLE_* (if used)');
  console.log('');
  console.log('See docs/SSH_FIRST_OPERATIONS.md and docs/ROLLOUT_MANUAL.md for the full live deployment sequence.');
  console.log('');
}

main().catch((err) => {
  console.error('\n[SETUP] FATAL ERROR:', err.message || err);
  console.error('[SETUP] The install state has been preserved. Fix the issue and re-run to resume from where it stopped.');
  console.error('[SETUP] Use --reset to start from scratch.\n');
  process.exit(1);
});
