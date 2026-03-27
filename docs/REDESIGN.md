# Trivia Trainer Redesign: Hierarchical Nodes + Exercise Formats

## Goals

Replace the flat 6-category model with an arbitrary-depth node tree matching Learned League's 18 categories. Support multiple exercise formats (starting with text-entry and fill-blanks). Preserve Learn mode. Enable new formats and display types without schema changes.

## Schema

### nodes

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,          -- slug-path: 'science/chemistry'
  parent_id TEXT REFERENCES nodes(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);
```

IDs encode hierarchy. Breadcrumbs derived by splitting on `/` and querying ancestors — no recursive CTEs needed. Trade-off: reparenting requires ID updates across nodes, exercises, and items. Acceptable for a curated app with stable categories.

### exercises

```sql
CREATE TABLE exercises (
  id TEXT PRIMARY KEY,          -- slug-path: 'science/chemistry/element-symbols'
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  format TEXT NOT NULL,         -- 'text-entry', 'fill-blanks' (no CHECK — validated in app)
  display_type TEXT,            -- 'cards', 'periodic-table', 'map', 'timeline' (nullable)
  config TEXT,                  -- JSON, format-specific (e.g., fill-blanks prompt + ordered flag)
  sort_order INTEGER DEFAULT 0
);
```

No CHECK constraint on `format` — validated in TypeScript. Adding a new format never requires a migration.

`display_type` controls the Learn mode renderer (per DESIGN_PRINCIPLES.md: "modules should declare how they want to be rendered"). Defaults to `cards` when NULL.

### items

```sql
CREATE TABLE items (
  id TEXT NOT NULL,             -- content-derived slug: 'iron', 'helium' (author-chosen)
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,         -- universal: every item has an answer
  alternates TEXT DEFAULT '[]', -- JSON array of alternate accepted answers
  explanation TEXT DEFAULT '',
  data TEXT DEFAULT '{}',       -- JSON, format-specific fields (prompt, label, cardFront, cardBack)
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, exercise_id)
);
```

`answer` is a real column because it's universal (every format needs it), it's the most-queried field (answer checking), and it needs NOT NULL enforcement. Format-specific fields stay in the `data` JSON blob.

Item IDs are content-derived, not index-based. Authors choose stable IDs in seed JSON (e.g., `iron` not `0`). This survives reordering and is safe for future progress tracking.

### Indexes

```sql
CREATE INDEX idx_nodes_parent ON nodes(parent_id);
CREATE INDEX idx_exercises_node ON exercises(node_id);
CREATE INDEX idx_items_exercise ON items(exercise_id);
```

### Migration

`migrations/0004_redesign.sql` — drops old tables (modules, questions), creates new ones, adds indexes. No data migration needed: current content is all seed-derived, no user state in D1.

## Types

```typescript
type ExerciseFormat = 'text-entry' | 'fill-blanks';
type DisplayType = 'cards' | 'periodic-table' | 'map' | 'timeline';

interface Node {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  childCount?: number;      // computed
  exerciseCount?: number;   // computed
}

interface Exercise {
  id: string;
  nodeId: string;
  name: string;
  description: string;
  format: ExerciseFormat;
  displayType?: DisplayType;
  config?: FillBlanksConfig;   // union as formats grow
  sortOrder: number;
  itemCount?: number;          // computed
}

interface FillBlanksConfig {
  ordered: boolean;
  prompt: string;              // "Name all six noble gases"
}

interface Item {
  id: string;
  exerciseId: string;
  answer: string;
  alternates: string[];
  explanation: string;
  data: TextEntryData | FillBlanksData;
  sortOrder: number;
}

interface TextEntryData {
  prompt: string;              // "What element has the symbol Fe?"
  cardFront?: string;          // Learn mode override (falls back to prompt)
  cardBack?: string;           // Learn mode override (falls back to answer)
}

interface FillBlanksData {
  label?: string;              // optional grid label (e.g., element symbol)
}
```

Remove from current types: `Category` union, `Tier`, `QuizMode`, `QuizModule`, `Question`, `CATEGORY_META`, `QuizSession`, `SessionAnswer`.

Keep: `CheckAnswerResult` (adapted), fuzzy match types.

Add: `LL_CATEGORIES` — static array of `{ id, name, color }` for the 18 Learned League categories.

## Answer Checking

### Text-entry — check one item

```
POST /api/exercises/science/chemistry/element-symbols/check
{ "itemId": "iron", "answer": "Iron" }

→ { "correct": true, "correctAnswer": "Iron", "explanation": "...",
    "userAnswer": "Iron", "fuzzyMatch": false }
```

Same semantics as current system. Fuzzy matching unchanged (Levenshtein ≤ 2 for answers ≥ 5 chars).

### Fill-blanks — check against all items

```
POST /api/exercises/science/chemistry/noble-gases/check
{ "answer": "Helium" }

→ { "matched": true, "matchedItemId": "helium", "position": 0,
    "userAnswer": "Helium", "fuzzyMatch": false }
```

No `itemId` needed. The server checks the guess against ALL items in the exercise and returns which one matched (or `matched: false`). For ordered mode, the client uses `position` to place it in the correct slot. This keeps answers server-side — no leakage.

The client tracks which items are already found and can ignore duplicate matches. No server-side session state needed.

### Implementation

`checkAnswerByFormat` dispatches on format:
- **text-entry**: look up the specific item, fuzzy-check against answer + alternates (same as current)
- **fill-blanks**: load all items for the exercise, check guess against each item's answer + alternates, return first match with its position (sort_order)

`fuzzy-match.ts` is unchanged.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/nodes` | Root nodes (18 categories) |
| GET | `/api/nodes/:path+` | Node + children + exercises (with counts) |
| GET | `/api/exercises/:path+` | Exercise + items (answers stripped) |
| POST | `/api/exercises/:path+/check` | Check answer (format-specific) |

### Routing implementation

Regex matching, same pattern as current code. Order matters — check route matched before detail route:

```typescript
if (path === '/api/nodes') { /* root nodes */ }
const nodeMatch = path.match(/^\/api\/nodes\/(.+)$/);
const checkMatch = path.match(/^\/api\/exercises\/(.+?)\/check$/);
const exerciseMatch = path.match(/^\/api\/exercises\/(.+)$/);
```

### Answer stripping

`GET /api/exercises/:path+` returns items without `answer`, `alternates`, or `explanation` (until answered). The client sees: item ID, data (prompt/label), sort order. Explanations are returned by the check endpoint after answering.

## Repository

```typescript
class NodeRepository {
  constructor(private db: D1Database) {}

  async getRootNodes(): Promise<Node[]>
  // SELECT *, (SELECT COUNT(*) FROM nodes c WHERE c.parent_id = n.id) as child_count,
  //           (SELECT COUNT(*) FROM exercises e WHERE e.node_id = n.id) as exercise_count
  // FROM nodes n WHERE parent_id IS NULL ORDER BY sort_order

  async getNode(id: string): Promise<{ node: Node; children: Node[]; exercises: Exercise[] } | null>
  // Three queries: node, children (with counts), exercises (with item counts)

  async getNodeBreadcrumbs(id: string): Promise<Node[]>
  // Split 'science/chemistry' → ['science', 'science/chemistry']
  // SELECT * FROM nodes WHERE id IN (?, ?) ORDER BY length(id)

  async getExercise(id: string): Promise<{ exercise: Exercise; items: Item[] } | null>
  // Exercise + all items ORDER BY sort_order

  async getItem(exerciseId: string, itemId: string): Promise<Item | null>
  // Single item for text-entry checking

  async getExerciseItems(exerciseId: string): Promise<Item[]>
  // All items for fill-blanks checking
}
```

## Seed System

### Convention

One seed file per subtopic. Each file declares its intermediate nodes and all exercises under them.

Root categories live in `seeds/_categories.json` (underscore prefix ensures it's processed first). This avoids coupling categories to schema migrations — adding a 19th category or renaming one is a seed change, not a migration.

### Format

```json
{
  "nodes": [
    {
      "id": "science/chemistry",
      "parentId": "science",
      "name": "Chemistry",
      "description": "Elements, compounds, reactions"
    }
  ],
  "exercises": [
    {
      "id": "science/chemistry/element-symbols",
      "nodeId": "science/chemistry",
      "name": "Element Symbols",
      "format": "text-entry",
      "displayType": "periodic-table",
      "items": [
        {
          "id": "iron",
          "prompt": "What element has the symbol Fe?",
          "answer": "Iron",
          "alternates": [],
          "explanation": "Fe comes from the Latin 'ferrum'. Iron is the most common element on Earth by mass.",
          "cardFront": "Fe",
          "cardBack": "Iron"
        }
      ]
    },
    {
      "id": "science/chemistry/noble-gases",
      "nodeId": "science/chemistry",
      "name": "Noble Gases",
      "format": "fill-blanks",
      "config": { "ordered": false, "prompt": "Name all six noble gases" },
      "items": [
        {
          "id": "helium",
          "answer": "Helium",
          "alternates": ["He"],
          "explanation": "Atomic number 2, the lightest noble gas."
        },
        {
          "id": "neon",
          "answer": "Neon",
          "alternates": ["Ne"],
          "explanation": "Atomic number 10, used in signs."
        }
      ]
    }
  ]
}
```

### Seed script

`scripts/seed.mjs` rewritten to:
1. Read all JSON files from `seeds/`, sorted alphabetically (underscore prefix = first)
2. For each file: INSERT OR REPLACE into nodes, exercises, items
3. Item `data` JSON constructed from format-specific fields (prompt, label, cardFront, cardBack)
4. `--local` and `--remote` flags work the same as current

## Learn Mode

Per DESIGN_PRINCIPLES.md, Learn mode is preserved as a viewing mode on any exercise:

- **"Cards on a table"** — grid of all items simultaneously
- **"Show the answer, not the question"** — card face shows answer (or `cardBack`), tap to reveal prompt + explanation
- **Reversible cards** — exercises with `cardFront`/`cardBack` in item data get a direction toggle
- **Specialized renderers** — `displayType` on exercises selects the renderer (cards, periodic-table, map, timeline). Default is `cards`.
- **Not a separate format** — Learn mode is a URL parameter (`?mode=learn`) on any exercise. The format determines quiz behavior; Learn mode is always a grid view.

## UI

### Routing

| Hash | View | Description |
|------|------|-------------|
| `#/` | Dashboard | 18 LL category cards |
| `#/node/:path+` | NodeView | Children + exercises at this node |
| `#/exercise/:path+` | ExerciseView | `?mode=learn\|quiz\|random-10` |

### Components

| Component | Replaces | Description |
|-----------|----------|-------------|
| `Dashboard.tsx` | (adapt) | 18 LL categories from `LL_CATEGORIES` |
| `NodeView.tsx` | CategoryView | Breadcrumbs + child nodes + exercises |
| `ExerciseView.tsx` | QuizView | Mode/format dispatcher |
| `LearnGrid.tsx` | (extracted) | Default card grid for Learn mode |
| `PeriodicTable.tsx` | (keep) | Specialized renderer, selected by `displayType` not moduleId |
| `TextEntryQuiz.tsx` | (extracted) | One-at-a-time quiz with progress bar |
| `FillBlanksQuiz.tsx` | (new) | Type guesses, match against items, track found/remaining |
| `QuizSummary.tsx` | (extracted) | Results screen with incorrect answers + explanations |

Remove: `CategoryView.tsx`, `QuizView.tsx` (logic extracted into smaller components).

### ExerciseView dispatch

```
mode=learn  → LearnGrid (or specialized renderer based on displayType)
mode=quiz   → TextEntryQuiz or FillBlanksQuiz (based on format)
mode=random-10 → same as quiz, capped at 10 shuffled items
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_nodes` | Root nodes, or children of a given node |
| `get_node` | Node detail with children + exercises |
| `get_exercise` | Exercise with all items (full answers for agent use) |
| `check_answer` | Check answer for a specific exercise + item |

## Implementation Order

1. **Schema + types** — migration, TypeScript interfaces, LL_CATEGORIES
2. **Repository** — all queries
3. **Answer checker** — adapt for items, add fill-blanks matching
4. **API routes** — new endpoints
5. **Seed script + test data** — rewritten script, one seed file per format
6. **MCP tools** — adapted for new schema
7. **UI: routing + Dashboard + NodeView**
8. **UI: ExerciseView + LearnGrid**
9. **UI: TextEntryQuiz + FillBlanksQuiz + QuizSummary**
10. **Tests** — unit + integration
11. **Deploy + Playwright verification**

## Files Modified

| File | Action |
|------|--------|
| `migrations/0004_redesign.sql` | NEW |
| `src/data/types.ts` | REWRITE |
| `src/data/repository.ts` | REWRITE |
| `src/index.ts` | REWRITE API section |
| `src/mcp.ts` | REWRITE |
| `src/lib/answer-checker.ts` | ADAPT |
| `src/lib/fuzzy-match.ts` | KEEP |
| `src/app/App.tsx` | REWRITE routing |
| `src/app/lib/api.ts` | REWRITE |
| `src/app/components/Dashboard.tsx` | ADAPT |
| `src/app/components/NodeView.tsx` | NEW |
| `src/app/components/ExerciseView.tsx` | NEW |
| `src/app/components/LearnGrid.tsx` | NEW |
| `src/app/components/TextEntryQuiz.tsx` | NEW |
| `src/app/components/FillBlanksQuiz.tsx` | NEW |
| `src/app/components/QuizSummary.tsx` | NEW |
| `src/app/components/PeriodicTable.tsx` | ADAPT (displayType-driven, not moduleId) |
| `src/app/components/CategoryView.tsx` | DELETE |
| `src/app/components/QuizView.tsx` | DELETE |
| `src/app/index.css` | MINOR (new category colors) |
| `scripts/seed.mjs` | REWRITE |
| `seeds/` | NEW files |
| `test/worker.test.ts` | REWRITE |
| `test/unit/*.test.ts` | ADAPT |
| `CLAUDE.md` | UPDATE |

## Key Decisions

1. **Slug-path IDs** — human-readable, no joins for breadcrumbs. Reparenting is a manual operation. Acceptable trade-off.
2. **`answer` is a real column** — universal, most-queried, needs NOT NULL. Format-specific data in JSON.
3. **No CHECK constraints on format** — app-layer validation only. New formats never need migrations.
4. **Content-derived item IDs** — stable across reordering, safe for progress tracking.
5. **Categories in seeds, not migration** — decouples content from schema.
6. **Learn mode is a viewing mode** — not a format. `displayType` picks the renderer.
7. **Fill-blanks check is server-side** — no answer leakage, no session state.
8. **Three tables** — nodes (navigation), exercises (interactive content), items (atomic facts). Clean separation.
