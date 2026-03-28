# Trivia Trainer — Project Instructions

## What This Is

A trivia study app for Learned League preparation, deployed to `trivia.emilycogsdill.com`. Cloudflare Workers + D1 + React SPA.

## Knowledge Graph (MANDATORY)

After any significant change (new features, architecture shifts, design decisions, schema changes, new modules), save context to Agent-MCP using `update_project_context`. Use the `trivia-trainer/` key prefix.

Existing keys:
- `trivia-trainer/architecture` — stack, runtime, database, deployment
- `trivia-trainer/data-model` — format-agnostic question design
- `trivia-trainer/api-surface` — REST endpoints and MCP tools
- `trivia-trainer/seed-system` — content authoring and loading
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
| Seed local D1 | `node scripts/seed.mjs --local` |
| Seed remote D1 | `node scripts/seed.mjs --remote` |

## Finding Quiz Content

**The D1 database is the source of truth, NOT the seed files.** Many exercises in the deployed DB do not have corresponding seed files in `seeds/`. When looking for content to update or verify, always check the deployed API first:
```bash
curl -s "https://trivia.emilycogsdill.com/api/exercises/<exercise-path>"
```
Do NOT assume "not in seed files" means "doesn't exist." Check the API.

## Adding Quiz Content

**Read `docs/CONTENT_GUIDE.md` before writing or modifying seed files.** It defines explanation standards, format selection, card design, and all content conventions.

1. Create a JSON file in `seeds/` following the format below
2. Run `node scripts/seed.mjs --local` to test locally
3. Run `node scripts/seed.mjs --remote` to push to production
4. Run `npm run deploy` to redeploy
5. Update `trivia-trainer/seed-system` context in Agent-MCP with new counts

Seed format:
```json
{
  "nodes": [
    {
      "id": "category/subcategory",
      "parentId": "category",
      "name": "Display Name",
      "description": "Short description"
    }
  ],
  "exercises": [
    {
      "id": "category/subcategory/exercise-name",
      "nodeId": "category/subcategory",
      "name": "Exercise Name",
      "format": "text-entry",
      "displayType": "cards",
      "items": [
        {
          "id": "item-slug",
          "prompt": "Question text?",
          "answer": "Canonical answer",
          "alternates": ["Alt spelling"],
          "explanation": "Memorable explanation.",
          "cardFront": "Optional: flashcard front",
          "cardBack": "Optional: flashcard back"
        }
      ]
    }
  ]
}
```

For fill-blanks exercises, add `"config": { "ordered": false, "prompt": "Name all X..." }` to the exercise, and items don't need `prompt`.

Root category nodes are in `seeds/_categories.json` (18 Learned League categories).

## D1 Database

- Name: `trivia-trainer`
- ID: `f647046c-e114-41ca-9231-7942bdfb8b82`
- Region: WNAM
- Tables: `nodes`, `exercises`, `items`
- Schema: `migrations/0001_schema.sql` through `migrations/0004_redesign.sql`

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
- **Two exercise formats**: `text-entry` (type answer for each item) and `fill-blanks` (guess all items). Format determines quiz behavior; Learn mode is always a viewing mode.
- **Hierarchical nodes**: Categories -> subcategories -> exercises. Node IDs are slash-separated paths (e.g., `science/chemistry`). Breadcrumbs derived by splitting on `/`.
- **Display types are exercise-level**: `displayType` on exercises selects the Learn mode renderer (cards, periodic-table, map, timeline). Not hardcoded by exercise ID.
- **MCP is lazy-imported** in the worker (`await import('agents/mcp')`) to avoid breaking vitest-pool-workers. Don't change this to a static import.
- **Two vitest configs**: `vitest.unit.config.ts` for pure functions, `vitest.config.mts` for Workers pool integration tests. Don't merge them.
- **Vite config is separate**: `vite.config.app.ts` builds the React SPA. It's distinct from the vitest configs.
- **nodejs_compat** flag is required in wrangler.toml for the agents SDK.

## Git Workflow (MANDATORY)

**ALL changes to this project MUST go through pull requests.** Direct pushes to `main` are blocked, including for admins. Force pushes are disabled.

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
- Skip the worktree and work on `main` directly
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

# 5. If seed data changed
node scripts/seed.mjs --remote
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

## Docs

- `docs/DATA_ARCHITECTURE.md` — **schema, content pipeline, how to find/update content**
- `docs/CONTENT_GUIDE.md` — **content standards** (read before writing seed files)
- `docs/DESIGN_PRINCIPLES.md` — UI/UX design principles
- `docs/PRD.md` — full product requirements and curriculum
- `docs/TECHNICAL_DESIGN.md` — architecture, API contracts, MCP integration
