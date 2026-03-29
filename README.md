# Trivia Trainer

A trivia study app for [Learned League](https://learnedleague.com/) preparation, live at **[trivia.emilycogsdill.com](https://trivia.emilycogsdill.com)**.

## What it does

Browse 1,400+ trivia items across all 18 Learned League categories. Two study modes:

- **Learn** -- All items displayed as a card grid. Tap to reveal answers and explanations.
- **Quiz** -- Test yourself. Text-entry (type the answer) or fill-in-the-blanks (name all items in a set).

Optional sign-in (Google via Cloudflare Access) enables quiz history tracking and stats.

### Content coverage

| Category | Exercises | | Category | Exercises |
|---|---|---|---|---|
| Literature | 13 | | Geography | 10 |
| Science | 11 | | American History | 5 |
| Film | 5 | | Food/Drink | 5 |
| World History | 5 | | Math | 4 |
| Art | 2 | | Games/Sport | 2 |
| Lifestyle | 2 | | Pop Music | 2 |
| Business/Economics | 1 | | Classical Music | 1 |
| Current Events | 1 | | Language | 1 |
| Television | 1 | | Theatre | 1 |

72 exercises, 1,480 items total. Content is actively expanding.

## Tech stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Frontend**: React 19, Tailwind CSS 4, Vite 8
- **Testing**: Vitest 4 (unit + worker integration), Playwright (E2E)
- **Auth**: Cloudflare Access (Google IdP, optional)
- **MCP**: Built-in [Model Context Protocol](https://modelcontextprotocol.io/) server at `/mcp`

## Getting started

### Prerequisites

- Node.js 22+
- A Cloudflare account with Wrangler configured (`npx wrangler login`)

### Setup

```bash
git clone https://github.com/emily-flambe/fun-trivia-game.git
cd fun-trivia-game
npm install
```

Create a `.dev.vars` file for local auth bypass:

```
CF_ACCESS_TEST_EMAIL=test@example.com
```

Apply database migrations and seed content:

```bash
npx wrangler d1 execute trivia-trainer --local --file=migrations/0004_redesign.sql
npx wrangler d1 execute trivia-trainer --local --file=migrations/0005_users.sql
node scripts/seed.mjs --local
```

### Development

```bash
npm run dev          # Full-stack: Wrangler dev server (port 8787)
npm run dev:client   # Frontend only: Vite with HMR (port 5173, proxies API)
```

### Testing

```bash
npm test             # Unit tests (fuzzy matching, answer checking)
npm run test:worker  # Worker integration tests (API endpoints, D1)
npm run test:all     # Both
npm run test:e2e     # End-to-end (Playwright, requires build first)
```

### Deploying

```bash
npm run deploy       # Builds SPA + deploys worker to Cloudflare
```

Deployments also happen automatically via Cloudflare Workers Builds on every push.

## Project structure

```
src/
  index.ts              # Worker entry: request routing, API handlers
  mcp.ts                # MCP server (list_nodes, get_node, get_exercise, check_answer)
  data/
    repository.ts       # D1 queries for nodes, exercises, items
    user-repository.ts  # D1 queries for users, quiz results
    types.ts            # TypeScript types
  lib/
    auth.ts             # Cloudflare Access JWT validation
    answer-checker.ts   # Text-entry and fill-blanks checking
    fuzzy-match.ts      # Normalization + Levenshtein distance
  app/
    main.tsx            # React entry point
    components/         # React components (Dashboard, NodeView, ExerciseView, etc.)
    lib/
      api.ts            # Frontend API client
      auth-context.ts   # Auth state context
seeds/                  # Quiz content JSON files
migrations/             # D1 schema migrations
test/                   # Unit and worker integration tests
e2e/                    # Playwright E2E tests
```

## Adding content

See [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md) for content standards and seed file format.

```bash
# Create a JSON file in seeds/ following the format in CONTENT_GUIDE.md
node scripts/seed.mjs --local    # Test locally
node scripts/seed.mjs --remote   # Push to production
```

## License

Private project.

