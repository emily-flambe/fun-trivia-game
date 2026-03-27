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

## Architecture Notes

- **Three-table schema**: nodes (navigation tree), exercises (interactive content), items (atomic facts). Questions are now items with format-specific `data` JSON.
- **Two exercise formats**: `text-entry` (type answer for each item) and `fill-blanks` (guess all items). Format determines quiz behavior; Learn mode is always a viewing mode.
- **Hierarchical nodes**: Categories -> subcategories -> exercises. Node IDs are slash-separated paths (e.g., `science/chemistry`). Breadcrumbs derived by splitting on `/`.
- **Display types are exercise-level**: `displayType` on exercises selects the Learn mode renderer (cards, periodic-table, map, timeline). Not hardcoded by exercise ID.
- **MCP is lazy-imported** in the worker (`await import('agents/mcp')`) to avoid breaking vitest-pool-workers. Don't change this to a static import.
- **Two vitest configs**: `vitest.unit.config.ts` for pure functions, `vitest.config.ts` for Workers pool integration tests. Don't merge them.
- **Vite config is separate**: `vite.config.app.ts` builds the React SPA. It's distinct from the vitest configs.
- **nodejs_compat** flag is required in wrangler.toml for the agents SDK.

## Deploying

**Always deploy after making changes.** Don't wait to be asked.

```bash
npm run test:all           # verify tests pass
npm run deploy             # builds SPA + deploys worker
node scripts/seed.mjs --remote  # if seed data changed
```

If migrations were added, run them on remote BEFORE seeding:
```bash
npx wrangler d1 execute trivia-trainer --remote --file=migrations/XXXX.sql
```

## Docs

- `docs/CONTENT_GUIDE.md` — **content standards** (read before writing seed files)
- `docs/DESIGN_PRINCIPLES.md` — UI/UX design principles
- `docs/PRD.md` — full product requirements and curriculum
- `docs/TECHNICAL_DESIGN.md` — architecture, API contracts, MCP integration
