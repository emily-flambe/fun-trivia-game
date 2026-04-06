# Trivia Trainer — Project Instructions

## What This Is

A trivia study app for Learned League preparation, deployed to `trivia.emilycogsdill.com`. Cloudflare Workers + D1 + React SPA.

## Knowledge Graph (MANDATORY)

After any significant change (new features, architecture shifts, design decisions, schema changes, new modules), save context to Agent-MCP using `update_project_context`. Use the `trivia-trainer/` key prefix.

Existing keys:
- `trivia-trainer/architecture` — stack, runtime, database, deployment
- `trivia-trainer/data-model` — format-agnostic question design
- `trivia-trainer/api-surface` — REST endpoints and MCP tools
- `trivia-trainer/seed-system` — content management via admin API (seed files deprecated)
- `trivia-trainer/build-and-deploy` — scripts and pipeline
- `trivia-trainer/design-decisions` — key decisions with rationale
- `trivia-trainer/future-roadmap` — planned work from PRD

Update these when the information changes. Create new keys for new topics.

## Commands

| Task | Command |
|------|---------|
| Dev (worker + local D1) | `npm run dev` |
| Dev (React only, proxied) | `npm run dev:client` |
| Build SPA | `npm run build` |
| Deploy (build + deploy) | `npm run deploy` |
| Unit tests | `npm test` |
| Worker integration tests | `npm run test:worker` |
| All tests | `npm run test:all` |

## Testing (MANDATORY)

**Every feature or bug fix MUST include test coverage.** No exceptions. Use TDD where feasible — write failing tests first, then implement.

| Change type | Required tests |
|-------------|---------------|
| New UI feature | E2E test in `e2e/` verifying user-visible behavior |
| New API endpoint | Worker integration test in `test/worker.test.ts` |
| Pure logic (utils, checkers) | Unit test in `test/unit/` |
| Bug fix | Regression test proving the bug is fixed |

**Test locations:**
- `test/unit/` — pure function unit tests (vitest)
- `test/worker.test.ts` — Workers pool integration tests (vitest-pool-workers)
- `e2e/` — Playwright E2E tests against local wrangler dev

**Workflow:**
1. Write a failing test that captures the requirement
2. Implement the minimum code to pass it
3. Refactor if needed, keeping tests green
4. Run `npm run test:all` before committing

## Finding Quiz Content

**The D1 database is the source of truth.** When looking for content to update or verify, check the deployed API or query D1 directly:
```bash
# Check via public API (answers stripped)
curl -s "https://trivia.emilycogsdill.com/api/exercises/<exercise-path>"

# Query D1 directly (includes answers and alternates)
npx wrangler d1 execute trivia-trainer --remote --command "SELECT * FROM items WHERE exercise_id = '<exercise-id>'"
```

### Non-interactive Cloudflare auth (MANDATORY for agents)

Wrangler remote commands require a Cloudflare API token in non-interactive shells.

```bash
# Bash/zsh (current shell)
export CLOUDFLARE_API_TOKEN="<token>"
```

```powershell
# PowerShell (current shell)
$env:CLOUDFLARE_API_TOKEN="<token>"
```

If `CLOUDFLARE_API_TOKEN` is missing/invalid, remote D1 commands will fail.

## Content Admin API (EMI-413)

The admin API is the **only way to manage content**.

### Admin endpoints (all require auth + admin email)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/nodes` | Upsert a navigation node |
| `POST` | `/api/admin/exercises` | Create exercise (optionally with items) |
| `PUT` | `/api/admin/exercises/:id` | Update exercise fields |
| `DELETE` | `/api/admin/exercises/:id` | Delete exercise (items cascade) |
| `POST` | `/api/admin/exercises/:exerciseId/items` | Bulk upsert items |
| `PUT` | `/api/admin/exercises/:exerciseId/items/:itemId` | Update single item |
| `DELETE` | `/api/admin/exercises/:exerciseId/items/:itemId` | Delete single item |
| `GET` | `/api/admin/export` | Export all content in seed format |
| `GET` | `/api/admin/export/:exerciseId` | Export single exercise |
| `GET` | `/api/admin/content-health` | Content quality report |

Auth: Cloudflare Access + email in `CF_ADMIN_EMAILS` env var. Non-admins get 403.
For programmatic agent access, use `Authorization: Bearer <ADMIN_API_KEY>` (from `.dev.vars` locally, from env vars in deployed environments).

Key files: `src/index.ts` (routing), `src/data/admin-repository.ts` (DB ops), `src/data/types.ts` (types).

### Updating content

For small fixes (adding alternates, fixing explanations, correcting answers), update D1 directly:
```bash
npx wrangler d1 execute trivia-trainer --remote --command "UPDATE items SET alternates = '[\"alt1\",\"alt2\"]' WHERE id = 'item-id' AND exercise_id = 'exercise-id'"
```

For new exercises, use `POST /api/admin/exercises`.

For D1-driven content tickets, prefer inline commands (`--command`) over temporary SQL files.
Do not leave ad-hoc content SQL files in the repo/worktree (for example `emi-*-content.sql` or `.tmp-*.sql`).

**After any content change** (new exercises, new items, deleted content, node changes), regenerate the content map:
```bash
npm run content-map
```
Commit the updated `docs/CONTENT_MAP.md` alongside the content change.

## Seed Files Policy (MANDATORY)

**DO NOT USE seed files for content work.**

- Never create, edit, or rely on `seeds/*.json` for trivia-content tickets.
- Never use `scripts/seed.mjs` to publish or update production content.
- For content changes, use `/api/admin/*` endpoints (preferred) or targeted D1 SQL when appropriate.
- `GET /api/admin/export` is for export/backup only, not as a source-of-truth editing workflow.

## Quiz Structure Rules (MANDATORY)

These rules define how prompts/answers must be structured so quizzes are answerable in text-entry mode.

### 1) Text-entry exercises: answer must be short and typeable

- Prefer canonical answers that are typically 1-4 words.
- Prompts should clearly cue one expected answer.
- Do not make users type long definitions or paragraph-like phrases as the answer.

Bad:
- Prompt: `What does "deja vu" describe?`
- Answer: `Feeling of having already experienced something`

Good:
- Prompt: `Which foreign phrase describes the feeling that you've already experienced the present moment before?`
- Answer: `deja vu`

### 2) Foreign phrase sets: direction is meaning -> phrase

- For "Foreign Phrases in English" style exercises, prompt with definition/context and answer with the foreign phrase.
- Add alternates for punctuation/diacritics/hyphenation variants (for example: `deja vu`, `déjà vu`, `deja-vu`).

### 3) Fill-blanks exercises: every slot needs a cue label when applicable

- If the user is matching answers to fixed slots (for example NATO letters), include `data.label` on each item.
- For ordered fill-blanks, labels should be the slot cue (for example `A`, `B`, `C`).
- Answers should still be short and canonical.

### 4) Card data should mirror quiz direction

- `data.prompt` must match the quiz question.
- `data.cardFront` should usually be the clue/cue.
- `data.cardBack` should usually be the canonical answer.

### 5) Pre-publish validation checklist

- Is the expected answer concise and realistically typeable?
- Is there a single unambiguous target answer?
- Are common alternates included?
- For fill-blanks with fixed slots, are labels present?

## Linear Tickets (MANDATORY)

**All Linear issues for this project MUST be created in the Trivia Trainer project.** Every ticket must have one of these labels:

| Ticket type | Label | Examples |
|-------------|-------|----------|
| Trivia content | `agent:trivia-content` | Quiz content, exercises, fact corrections |
| Everything else | `agent:coding-team` | Features, bug fixes, refactors, infra, UI, API, tests, migrations |

- **`agent:trivia-content`** — identifies tickets the trivia content agent (Orca) can pick up autonomously.
- **`agent:coding-team`** — identifies tickets for coding/engineering work. **If a ticket is NOT about trivia content, it MUST have this label.**

When in doubt: if the work involves writing or editing quiz items / explanations, use `agent:trivia-content`. For literally everything else (even content-adjacent work like changing how content renders), use `agent:coding-team`.

## D1 Database

- Name: `trivia-trainer`
- ID: `f647046c-e114-41ca-9231-7942bdfb8b82`
- Region: WNAM
- Tables: `nodes`, `exercises`, `items`, `users`, `quiz_results`
- Schema: `migrations/0001_schema.sql` through `migrations/0006_retry_tracking.sql`
- Full DDLs: `docs/SCHEMA.sql` — consolidated reference of all CREATE TABLE + indexes

### Key gotcha: `items.data` JSON column

The `items` table does NOT have `prompt`, `cardFront`, `cardBack`, or `links` as top-level columns. These live inside the `data` TEXT column as JSON:

```sql
-- WRONG: SELECT prompt FROM items
-- RIGHT: SELECT json_extract(data, '$.prompt') as prompt FROM items

-- To update prompt:
UPDATE items SET data = json_set(data, '$.prompt', 'New question?')
  WHERE id = 'item-id' AND exercise_id = 'exercise-id'
```

Top-level `items` columns: `id`, `exercise_id`, `answer`, `alternates`, `explanation`, `data`, `sort_order`.

## Cloudflare Access Auth

- **Team domain**: `https://emilycogsdill.cloudflareaccess.com`
- **AUD tag**: in `wrangler.toml` `[vars]` as `CF_ACCESS_AUD`
- **Approach**: Path-scoped Access Application on `/auth/login` with Allow policy. Rest of app is public.
- **Login**: Sign In button links to `/auth/login`. Cloudflare Access intercepts, shows Google login, sets `CF_Authorization` cookie (domain-wide), redirects back. Worker catches redirect and sends user to `/#/`.
- **Logout**: `/cdn-cgi/access/logout?returnTo=<origin>` clears the cookie.
- **JWT validation**: `jose` library in `src/lib/auth.ts` (lazy-imported). Validates against JWKS at `teamDomain/cdn-cgi/access/certs`. Checks both `Cf-Access-Jwt-Assertion` header and `CF_Authorization` cookie.
- **API endpoint**: `GET /api/auth/me` returns `{ authenticated, email, loginUrl/logoutUrl }`.
- **Login URL format** (verified from `@cloudflare/pages-plugin-cloudflare-access` source): `${teamDomain}/cdn-cgi/access/login/${appHostname}?kid=${aud}&redirect_url=/`

### Service Token (E2E Testing)

- **Token name**: "Trivia Trainer Service Token" (non-expiring)
- **Client ID**: `57205ae099f268ed6dae0a78f09e93b6.access`
- **Client Secret**: in `.dev.vars` as `CF_ACCESS_CLIENT_SECRET` (never committed)
- **Access policy**: Service Auth policy on the same Access Application
- **How it works**: Send `CF-Access-Client-Id` + `CF-Access-Client-Secret` headers to `/auth/login`. Cloudflare Access validates, sets `CF_Authorization` cookie, Worker redirects to `/#/`. Cookie is then used for all subsequent requests.
- **JWT difference**: Service token JWTs have `common_name` (the Client ID) instead of `email`. Worker handles both.

### Local Dev Bypass (E2E Testing)

- **Env var**: `CF_ACCESS_TEST_EMAIL` in `.dev.vars` only (never in `wrangler.toml`)
- **How it works**: When set, `/api/auth/me` checks for a `CF_Test_Auth` cookie matching the email. Sign In links to `/auth/test-login` which sets this cookie and redirects to `/#/`.
- **Playwright usage**: Navigate to `/auth/test-login` or set `CF_Test_Auth` cookie directly.
- **Security**: Only active when `CF_ACCESS_TEST_EMAIL` env var is set. Never set in production.

## Architecture Notes

- **Three-table schema**: nodes (navigation tree), exercises (interactive content), items (atomic facts). Questions are now items with format-specific `data` JSON.
- **Two exercise formats**: `text-entry` (type answer for each item) and `fill-blanks` (guess all items). Format determines quiz behavior; Learn mode is always a viewing mode. Text-entry exercises support a List quiz mode (`?mode=grid`) that shows all items at once with labeled blanks — available on any text-entry exercise via the UI.
- **Hierarchical nodes**: Categories -> subcategories -> exercises. Node IDs are slash-separated paths (e.g., `science/chemistry`). Breadcrumbs derived by splitting on `/`.
- **Display types are exercise-level**: `displayType` on exercises selects the Learn mode renderer (cards, periodic-table, map, timeline). Not hardcoded by exercise ID.
- **MCP is lazy-imported** in the worker (`await import('agents/mcp')`) to avoid breaking vitest-pool-workers. Don't change this to a static import.
- **Two vitest configs**: `vitest.unit.config.ts` for pure functions, `vitest.config.mts` for Workers pool integration tests. Don't merge them.
- **Vite config is separate**: `vite.config.app.ts` builds the React SPA. It's distinct from the vitest configs.
- **nodejs_compat** flag is required in wrangler.toml for the agents SDK.

## Git Workflow (MANDATORY)

**ALL changes to this project MUST go through pull requests.** Direct pushes to `main` are blocked, including for admins. Force pushes are disabled.
**All agent work MUST be done in a dedicated git worktree checkout.** Do not implement changes from the primary repo checkout.
**Auto-merge MUST be enabled on PRs** (`gh pr merge --squash --auto`) once the PR is opened.
**Work is NOT done until the PR is merged to `main` and the merged commit is deployed.**

### Working on a feature or fix:

```bash
# 1. Create a worktree (ALWAYS — never work on main directly)
git fetch origin
git worktree add ../fun-trivia-game-my-feature -b my-feature origin/main
cd ../fun-trivia-game-my-feature
cp ../fun-trivia-game/.dev.vars . 2>/dev/null || true
npm install

# 2. Make changes, commit, push
git add <files>
git commit -m "Description of changes"
git push -u origin my-feature

# 3. Create PR with auto-merge enabled
gh pr create --fill
gh pr merge --squash --auto

# 4. Wait for CI (all 5 checks must pass: Unit Tests, Worker Integration Tests, Build, E2E Tests, Workers Builds)
gh pr checks --watch

# 5. Clean up worktree
cd ../fun-trivia-game
git worktree remove ../fun-trivia-game-my-feature
```

**Do NOT:**
- Push directly to `main` (it will be rejected)
- Force push to `main`
- Skip the worktree and work on the primary checkout directly
- Merge PRs with failing CI checks

### Branch protection rules on `main`:
- 5 required status checks: Unit Tests, Worker Integration Tests, Build, E2E Tests, Workers Builds
- PRs required (no direct pushes)
- Force pushes disabled
- Enforced for admins
- Auto-merge enabled: use `gh pr merge --squash --auto` after creating PRs

## Deploying

**Always deploy after merging a PR.** Don't wait to be asked.

### Deploy Steps (follow this exact sequence)

```bash
# 1. Run tests
npm run test:all

# 2. If migrations were added, run them FIRST
npx wrangler d1 execute trivia-trainer --remote --file=migrations/XXXX.sql

# 3. CRITICAL: Clean old build artifacts before deploying
#    Wrangler compares content hashes against its cache. Stale bundles in dist/
#    cause "No updated asset files to upload" even when code has changed.
rm -rf dist/assets

# 4. Build and deploy
npm run deploy             # runs: vite build && wrangler deploy
```

### Verifying Deploys (MANDATORY after every deploy)

```bash
# Check what bundle production is serving vs what was just built
PROD=$(curl -s https://trivia.emilycogsdill.com/ | grep -o 'index-[^"]*\.js')
LOCAL=$(grep -o 'index-[^"]*\.js' dist/index.html)
echo "Production: $PROD"
echo "Local:      $LOCAL"
# These MUST match. If they don't, run: rm -rf dist/assets && npm run deploy
```

For UI changes, also take a Playwright screenshot to visually confirm.

### Visual Verification Claims (MANDATORY)

Never claim "visually verified" unless you captured evidence from the exact route and mode that was fixed.

Required evidence before making a visual-verification claim:
- A screenshot artifact file generated during this task (for example `.tmp-<ticket>-<route>.png`).
- The exact URL/hash route and mode used for capture (for example `#/exercise/geography/maps/south-america?mode=quiz`).
- A brief note of what is visibly present in the screenshot that proves the fix.

Failure mode to avoid:
- Do not treat API checks, code inspection, or assumptions as visual verification.
- Do not claim visual verification if the screenshot command failed/timed out or no artifact file exists.
- For map exercises specifically, verify the map renderer itself is visible in the target mode (not just that data loaded).

## Docs

- `docs/DATA_ARCHITECTURE.md` — **schema, content pipeline, how to find/update content**
- `docs/CONTENT_GUIDE.md` — **content standards**
- `docs/CURRENT_EVENTS_POLICY.md` — **rolling-window governance for current-events content**
- `docs/DESIGN_PRINCIPLES.md` — UI/UX design principles
- `docs/PRD.md` — full product requirements and curriculum
- `docs/TECHNICAL_DESIGN.md` — architecture, API contracts, MCP integration
