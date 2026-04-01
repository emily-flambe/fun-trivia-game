# Data Architecture

## Overview

Trivia Trainer stores quiz content in a three-table schema in Cloudflare D1. Content is managed via the admin API and MCP tools, landing directly in D1. **The D1 database is the source of truth.**

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

### `users` — Authenticated users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  preferences TEXT DEFAULT '{}',  -- JSON user preferences
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX idx_users_email ON users(email);
```

### `quiz_results` — Quiz completion log

```sql
CREATE TABLE quiz_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,         -- references users(id)
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  format TEXT NOT NULL,          -- 'text-entry' or 'fill-blanks'
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_seconds INTEGER,
  items_detail TEXT DEFAULT '[]', -- JSON array of per-item results
  completed_at TEXT NOT NULL,
  is_retry INTEGER NOT NULL DEFAULT 0,
  parent_result_id TEXT          -- references quiz_results(id) for retries
);
CREATE INDEX idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_completed ON quiz_results(completed_at);
```

## Content Pipeline

Content is managed via the **admin API** and **MCP tools**. These are the only supported ways to create, update, and delete content.

### Admin API

All admin endpoints require a Cloudflare Access JWT from an admin email. See `src/index.ts` for routing and `src/data/admin-repository.ts` for DB operations.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/admin/exercises` | Create exercise (optionally with items) |
| `PUT` | `/api/admin/exercises/:id` | Update exercise fields |
| `DELETE` | `/api/admin/exercises/:id` | Delete exercise (items cascade) |
| `POST` | `/api/admin/exercises/:exerciseId/items` | Bulk upsert items |
| `PUT` | `/api/admin/exercises/:exerciseId/items/:itemId` | Update single item |
| `DELETE` | `/api/admin/exercises/:exerciseId/items/:itemId` | Delete single item |
| `POST` | `/api/admin/nodes` | Upsert a navigation node |
| `GET` | `/api/admin/export` | Export all content as JSON |
| `GET` | `/api/admin/export/:exerciseId` | Export single exercise |
| `GET` | `/api/admin/content-health` | Content quality report |

### Direct D1 queries

For quick fixes (adding alternates, correcting answers), query D1 directly:

```bash
# Check what exists
npx wrangler d1 execute trivia-trainer --remote --command "SELECT DISTINCT exercise_id FROM items ORDER BY exercise_id"

# Update a single item
npx wrangler d1 execute trivia-trainer --remote --command "UPDATE items SET alternates = '[\"alt1\",\"alt2\"]' WHERE id = 'item-id' AND exercise_id = 'exercise-id'"
```

## Current Stats (as of 2026-03-28)

| Table | Count |
|-------|-------|
| Nodes | 75 |
| Exercises | 78 |
| Items | 1,385 |

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
