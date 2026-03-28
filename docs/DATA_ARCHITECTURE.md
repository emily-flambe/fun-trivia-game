# Data Architecture

## Overview

Trivia Trainer stores quiz content in a three-table schema in Cloudflare D1. Content is authored as JSON seed files and loaded via a seed script, but **the D1 database is the source of truth** — not all exercises in the database have corresponding seed files.

## Database Schema

Three tables defined in `migrations/0004_redesign.sql`:

### `nodes` — Navigation hierarchy

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,        -- slash-separated path, e.g. "science/chemistry"
  parent_id TEXT,             -- references nodes(id), NULL for root categories
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);
```

Nodes form a tree: **categories** (root) → **subcategories** → exercises reference the leaf nodes. IDs are slash-separated paths (e.g., `science/chemistry`). Breadcrumbs are derived by splitting the ID on `/`.

### `exercises` — Interactive content units

```sql
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,        -- e.g. "science/chemistry/element-symbols"
  node_id TEXT NOT NULL,      -- which node this belongs to
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  format TEXT NOT NULL,       -- 'text-entry' or 'fill-blanks'
  display_type TEXT,          -- 'cards' (default), 'periodic-table', 'map', 'timeline'
  config TEXT,                -- JSON, e.g. {"ordered": false, "prompt": "Name all..."}
  sort_order INTEGER DEFAULT 0
);
```

- **format** determines quiz behavior: `text-entry` (one item per screen, type answer) or `fill-blanks` (all items at once, guess to fill).
- **display_type** determines Learn mode renderer. Default is `cards` (flashcards).
- **config** is used by `fill-blanks` exercises: `{ "ordered": boolean, "prompt": string }`.

### `items` — Atomic facts/questions

```sql
CREATE TABLE items (
  id TEXT NOT NULL,            -- slug, e.g. "hydrogen"
  exercise_id TEXT NOT NULL,   -- which exercise this belongs to
  answer TEXT NOT NULL,        -- canonical answer (always displayed after checking)
  alternates TEXT DEFAULT '[]', -- JSON array of alternate accepted spellings
  explanation TEXT DEFAULT '',  -- shown after answering; supports markdown-like formatting
  data TEXT DEFAULT '{}',      -- JSON with format-specific fields
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, exercise_id)
);
```

The `data` JSON contains format-specific fields:

- **text-entry items**: `{ "prompt": "Question text?", "cardFront": "...", "cardBack": "..." }`
- **fill-blanks items**: `{ "label": "Category label" }` (optional grouping)
- `cardFront`/`cardBack` are optional on any format — they control the Learn mode flashcard display.

## Content Pipeline

### Authoring (seed files)

Content is authored as JSON files in `seeds/`. Each file can define nodes and exercises:

```json
{
  "nodes": [
    { "id": "category/subcategory", "parentId": "category", "name": "Display Name" }
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
          "prompt": "Question?",
          "answer": "Answer",
          "alternates": ["Alt spelling"],
          "explanation": "Why this is the answer.",
          "cardFront": "Flashcard front",
          "cardBack": "Flashcard back"
        }
      ]
    }
  ]
}
```

Root category nodes (the 18 Learned League categories) are in `seeds/_categories.json`.

### Loading

```bash
node scripts/seed.mjs --local   # seed local D1 (development)
node scripts/seed.mjs --remote  # seed remote D1 (production)
```

The script reads all `seeds/*.json` files, generates `INSERT OR REPLACE` SQL, and executes via `wrangler d1 execute`. It is **idempotent** — safe to re-run.

### Important: DB vs Seed Files

Not all database content has a corresponding seed file. Some exercises were created via direct SQL or from seed files that were later deleted/renamed. **When looking for content:**

1. **Always check the deployed API first**: `curl https://trivia.emilycogsdill.com/api/exercises/<path>`
2. **To update existing content without a seed file**: use `wrangler d1 execute` with UPDATE SQL against the remote database.
3. **To check what exists**: query the database directly:
   ```bash
   npx wrangler d1 execute trivia-trainer --remote --command "SELECT DISTINCT exercise_id FROM items ORDER BY exercise_id"
   ```

## Current Stats (as of 2026-03-28)

| Table | Count |
|-------|-------|
| Nodes | 75 |
| Exercises | 78 |
| Items | 1,385 |
| Seed files | 39 |

## API Endpoints for Content

| Endpoint | Returns |
|----------|---------|
| `GET /api/nodes` | Root category nodes with child/exercise counts |
| `GET /api/nodes/:path` | Node detail + children + exercises + breadcrumbs |
| `GET /api/exercises/:path` | Exercise + items (answers stripped) |
| `GET /api/exercises/:path/answers` | All items with answers (for give-up) |
| `POST /api/exercises/:path/check` | Check an answer: `{ itemId?, answer }` |
| `GET /api/exercises/random` | Random exercise ID |

## Answer Checking

Two-tier matching in `src/lib/fuzzy-match.ts`:

1. **Exact match** (after normalization): lowercase, strip diacritics, strip punctuation/articles
2. **Fuzzy match** (Levenshtein distance ≤ 2): only for answers ≥ 5 characters

Fill-blanks exercises do two passes: exact first, then fuzzy — prevents ambiguity (e.g., "Xenon" vs "Neon").
