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

1. Create a JSON file in `seeds/` following the format of existing files
2. Run `node scripts/seed.mjs --local` to test locally
3. Run `node scripts/seed.mjs --remote` to push to production
4. Run `npm run deploy` to redeploy (not strictly needed for data-only changes, but good practice)
5. Update `trivia-trainer/seed-system` context in Agent-MCP with new counts

Seed format:
```json
{
  "id": "category-prefix-topic",
  "category": "geography|history|science|literature|entertainment|sports",
  "name": "Display Name",
  "tier": "foundation|core|advanced",
  "description": "Short description",
  "defaultFormat": "text-entry",
  "questions": [
    {
      "id": "unique-id",
      "question": "Question text?",
      "answer": "Canonical answer",
      "alternateAnswers": ["Alt spelling", "Nickname"],
      "explanation": "1-2 memorable sentences. Not just restating the answer.",
      "cardFront": "Optional: short label for flashcard front (falls back to question)",
      "cardBack": "Optional: short label for flashcard back (falls back to answer)"
    }
  ]
}
```

Module ID convention: `{prefix}-{topic}` where prefix is `geo`, `hist`, `sci`, `lit`, `ent`, `sport`.

## D1 Database

- Name: `trivia-trainer`
- ID: `f647046c-e114-41ca-9231-7942bdfb8b82`
- Region: WNAM
- Tables: `modules`, `questions`
- Schema: `migrations/0001_schema.sql` + `migrations/0002_format_refactor.sql` + `migrations/0003_card_front.sql`

## Architecture Notes

- **Questions are format-agnostic.** Don't add format-specific question types. Store canonical answer text on every question; format-specific data (MC options, matching pairs) is optional/supplementary.
- **Flashcard fields are separate from quiz fields.** `cardFront`/`cardBack` are optional per-question fields for Learn mode. They fall back to `question`/`answer` when not set. Modules with these fields get a reversible direction toggle in Learn mode.
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

- `docs/PRD.md` — full product requirements and curriculum
- `docs/TECHNICAL_DESIGN.md` — architecture, API contracts, MCP integration
