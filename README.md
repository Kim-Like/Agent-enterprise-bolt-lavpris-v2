# Agent Enterprise Bolt Lavpris

This repository is the dedicated Bolt-targeted Lavprishjemmeside V2 repo for Agent Enterprise.

It exists so an external agent can work on Lavprishjemmeside V2 and the directly related Agent Enterprise surfaces without loading the full broader Agent Enterprise repo.

This repository is intentionally smaller than the full broader repo:

- Lavprishjemmeside program files stay in scope
- the relevant control-plane code stays in scope
- the relevant agent families stay in scope
- unrelated program families and estate context are removed to fit Bolt better

## What This Repo Includes

- source code under `server/`, `client/`, `programs/`, `agents/`, `config/`, `scripts/`, and `tests/`
- project and operator docs
- agent packets and prompts
- the Lavprishjemmeside orchestrator skill under `.agents/`

## What This Repo Does Not Include

- `.env.local` or any real secret-bearing env file
- runtime state under `.data/`
- logs under `.logs/`
- `node_modules/`
- nested Git metadata from `programs/lavprishjemmeside/local-mirror/.git`
- operator SSH, cPanel, Tailscale Funnel, and estate shell entrypoints
- direct DB, Roundcube, or email-account operations
- unrelated program families that are not needed for the current Bolt sprint

## Read Order

1. `README.md`
2. `EXTERNAL_AGENT_INSTRUCTIONS.md`
3. `EXTERNAL_AGENT_PROMPT.md`
4. `OPERATOR_HANDOFF_CONTRACT.md`
5. `REPO_SYNC_POLICY.md`
6. `EXPORT_SANITIZATION_MANIFEST.md`
7. `AGENTS.md`
8. `INTRODUCTION.md`
9. `TECHSTACK.md`
10. target-program docs for the area you are changing

## Bolt Scope

This repo includes a Bolt-specific scope filter at `.bolt/ignore`.

- It is tuned for the current Lavprishjemmeside V2 work.
- It hides remaining archive/task noise inside this dedicated repo.
- If Bolt needs broader access later, remove entries deliberately instead of deleting the file wholesale.

For Lavprishjemmeside work, then load:

1. `programs/lavprishjemmeside/README.md`
2. `programs/lavprishjemmeside/PROJECT_CONTEXT.md`
3. `programs/lavprishjemmeside/CHANGELOG.md`
4. `programs/lavprishjemmeside/requirements.md`
5. `programs/lavprishjemmeside/design.md`
6. `programs/lavprishjemmeside/tasks.md`
7. `programs/lavprishjemmeside/CPANEL_HANDOFF_CONTRACT.md`

## Hard Boundary

- External agents may edit repo code, docs, prompts, and plans.
- External agents may not execute or simulate SSH, cPanel, DB, Roundcube, mailbox, env-secret, or live rollout work.
- Any remote or secret-bearing change must be handed back using `OPERATOR_HANDOFF_CONTRACT.md`.

## Git Workflow

- This repo is intended for a private GitHub PR workflow.
- `main` should be protected.
- Use `.github/PULL_REQUEST_TEMPLATE.md` and `.github/CODEOWNERS`.
- GitHub-level protection setup is documented in `docs/GITHUB_REPO_SETUP.md`.

## Lavprishjemmeside Dual-Repo Rule

`programs/lavprishjemmeside/local-mirror/` remains present here for context and broader-project work, but the dedicated `lavprishjemmeside.dk` GitHub repo remains the primary source of truth for that subtree. See `REPO_SYNC_POLICY.md`.
