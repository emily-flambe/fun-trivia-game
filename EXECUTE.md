Read `docs/REDESIGN.md` — that is the spec. Implement it phase by phase using the agents and gates below.

## Rules

1. **Do not skip gates.** Each phase ends with a gate. If the gate fails, fix the issue before moving on.
2. **Agents are adversarial.** Implementer writes code. Tester attacks it (separate context — no shared bias). Reviewer blocks or approves.
3. **Commit after each phase gate passes.** One commit per phase. Push at the end.
4. **Parallel where marked.** Phases marked `[parallel]` should be launched as concurrent agents in a single message.
5. **Read before writing.** Every implementer agent must read the files it's modifying and `docs/REDESIGN.md` before writing. Tell it to.
6. **No speculative code.** Only implement what REDESIGN.md specifies. No extra features, no "nice to have" additions.

## Phase 1: Schema + Types

**Agent: implementer**

Write:
- `migrations/0004_redesign.sql` — DROP old tables, CREATE nodes/exercises/items with indexes. Exact SQL is in REDESIGN.md "Schema" section.
- `src/data/types.ts` — full rewrite. All interfaces from REDESIGN.md "Types" section. Add `LL_CATEGORIES` array with the 18 Learned League categories (use real LL category names: American History, World History, Science, Literature, Social Sciences, Pop Music, Classical Music, Jazz, Film, Television, Geography, Lifestyle, Sports, Current Events, Business/Economics, Technology, Food & Drink, Miscellaneous). Assign distinct colors to each.

Read these files first: `src/data/types.ts`, `docs/REDESIGN.md`.

**Gate:** `npx tsc --noEmit` passes (types compile). Migration SQL is syntactically valid (run against local D1: `npx wrangler d1 execute trivia-trainer --local --file=migrations/0004_redesign.sql`).

Commit: "Add redesign migration and rewrite type definitions"

## Phase 2: Data Layer + Seed System [parallel]

Launch two implementer agents concurrently:

**Agent A: implementer** — Repository

Rewrite `src/data/repository.ts`. Implement all methods from REDESIGN.md "Repository" section:
- `getRootNodes()` — nodes where parent_id IS NULL, with child_count and exercise_count subqueries
- `getNode(id)` — node + children + exercises (with counts)
- `getNodeBreadcrumbs(id)` — split slug on `/`, build ancestor IDs, WHERE id IN (...)
- `getExercise(id)` — exercise row + all items
- `getItem(exerciseId, itemId)` — single item
- `getExerciseItems(exerciseId)` — all items for fill-blanks checking

Read first: `src/data/repository.ts` (current), `src/data/types.ts` (just rewritten in Phase 1), `docs/REDESIGN.md`.

Map DB rows (snake_case) to TypeScript types (camelCase). Parse JSON columns (`alternates`, `config`, `data`). Follow the pattern of the existing `mapQuestion` function.

**Agent B: implementer** — Seed System

Rewrite `scripts/seed.mjs` for the new schema. Read first: `scripts/seed.mjs` (current), `docs/REDESIGN.md` "Seed System" section.

The script must:
- Read all JSON files from `seeds/`, sorted alphabetically
- Generate INSERT OR REPLACE for nodes, exercises, items
- Build item `data` JSON from format-specific fields in the seed JSON (prompt, label, cardFront, cardBack)
- `answer` and `alternates` go to real columns, not into `data`
- `--local` and `--remote` flags, same as current
- Escape SQL strings properly

Then create `seeds/_categories.json` with the 18 LL root category nodes (id, name, description). IDs should be URL-friendly slugs (e.g., `american-history`, `world-history`, `science`).

Then create one test seed file `seeds/science-chemistry.json` that exercises all 3 format variations:
1. A text-entry exercise (element symbols — 5-10 items with cardFront/cardBack)
2. An ordered fill-blanks exercise (e.g., first 5 US Presidents — but under a science subtopic for simplicity, or create a second seed file under the right category)
3. An unordered fill-blanks exercise (noble gases — 6 items)

Actually — make it two seed files to keep categories correct:
- `seeds/science-chemistry.json` — element symbols (text-entry) + noble gases (fill-blanks unordered)
- `seeds/american-history-presidents.json` — first 10 presidents in order (fill-blanks ordered)

Include intermediate nodes as needed (e.g., `science/chemistry` under `science`).

**Gate:** Seed script runs without errors against local D1:
```
npx wrangler d1 execute trivia-trainer --local --file=migrations/0004_redesign.sql
node scripts/seed.mjs --local
```
Verify data: `npx wrangler d1 execute trivia-trainer --local --command="SELECT COUNT(*) FROM nodes; SELECT COUNT(*) FROM exercises; SELECT COUNT(*) FROM items;"`

Commit: "Rewrite repository and seed system for new schema"

## Phase 3: Answer Checker

**Agent: implementer**

Adapt `src/lib/answer-checker.ts` for the new schema. Read first: `src/lib/answer-checker.ts`, `src/lib/fuzzy-match.ts`, `src/data/types.ts`, `docs/REDESIGN.md` "Answer Checking" section.

Changes:
- `checkTextEntry(item: Item, userAnswer: string)` — check against `item.answer` + `item.alternates` using existing fuzzy match
- `checkFillBlanks(items: Item[], userAnswer: string)` — check guess against ALL items, return `{ matched, matchedItemId?, position?, userAnswer, fuzzyMatch }`. Position is the item's `sortOrder`.
- Keep `fuzzy-match.ts` unchanged
- Export types: `CheckAnswerResult` (same shape as current), `FillBlanksCheckResult` (new)

**Agent: tester** (after implementer finishes)

Attack the answer checker. Write tests in `test/unit/answer-checker.test.ts` (rewrite). Read the implementation first, then write tests that try to break it:
- Text-entry: exact match, fuzzy match, alternate answers, empty input, special characters, very long input
- Fill-blanks: match found, no match, fuzzy match against list, duplicate answer in list, empty list, already-matched item (client-side concern but server should still match), case sensitivity
- Fill-blanks ordered vs unordered: verify position is returned correctly
- Edge cases: item with empty alternates array, item with answer that's a substring of another item's answer

**Agent: test-runner** (after tester finishes)

Run `npm test`. Fix nothing — report results.

**Gate:** All unit tests pass.

Commit: "Adapt answer checker for items and fill-blanks format"

## Phase 4: API Routes [parallel with Phase 5]

**Agent: implementer**

Rewrite the API section of `src/index.ts`. Read first: `src/index.ts` (current), `src/data/types.ts`, `src/data/repository.ts`, `docs/REDESIGN.md` "API Routes" and "Answer Checking" sections.

Routes (order matters for regex matching):
1. `GET /api/health` — keep as-is
2. `GET /api/nodes` — root nodes via `getRootNodes()`
3. `GET /api/nodes/:path+` — node detail via `getNode(path)`, include breadcrumbs
4. `POST /api/exercises/:path+/check` — answer checking (match BEFORE the detail route)
   - Read `format` from exercise row
   - For text-entry: require `itemId` + `answer` in body, call `checkTextEntry`
   - For fill-blanks: require `answer` in body (no itemId), call `checkFillBlanks` with all exercise items
5. `GET /api/exercises/:path+` — exercise detail via `getExercise(path)`, strip answers from items

Strip answers: remove `answer`, `alternates`, `explanation` from each item before returning. The check endpoint returns these after answering.

Keep the MCP lazy-import block unchanged. Keep the `html()` fallback function.

## Phase 5: MCP Tools [parallel with Phase 4]

**Agent: implementer**

Rewrite `src/mcp.ts`. Read first: `src/mcp.ts` (current), `src/data/types.ts`, `src/data/repository.ts`, `docs/REDESIGN.md` "MCP Tools" section.

Tools:
- `list_nodes` — params: optional `parentId`. Returns root nodes if no parentId, otherwise children of that node.
- `get_node` — params: `nodeId` (string). Returns node + children + exercises.
- `get_exercise` — params: `exerciseId` (string). Returns exercise + all items WITH answers (MCP agents need full data).
- `check_answer` — params: `exerciseId`, `answer`, optional `itemId`. If itemId provided, text-entry check. If not, fill-blanks check.

**Gate for Phase 4 + 5:** Full test suite passes. Run both test commands:
```
npm test
npm run test:worker
```

This requires the worker integration tests to work. So:

**Agent: tester** (after Phase 4 implementer finishes)

Rewrite `test/worker.test.ts`. Read the current test file first for patterns, then rewrite for the new schema.

Test setup: seed D1 with test data inline (nodes, exercises, items — cover text-entry and fill-blanks).

Test cases:
- `GET /api/health` — 200
- `GET /api/nodes` — returns root nodes with counts
- `GET /api/nodes/science` — returns node with children + exercises
- `GET /api/nodes/nonexistent` — 404
- `GET /api/exercises/science/chemistry/element-symbols` — returns exercise + items, answers stripped
- `GET /api/exercises/nonexistent` — 404
- `POST .../element-symbols/check` with text-entry item — correct, incorrect, fuzzy
- `POST .../noble-gases/check` with fill-blanks guess — matched, not matched
- `POST .../check` with missing fields — 400

**Agent: test-runner**

Run `npm run test:all`. Report results.

**Gate:** All tests pass.

Commit: "Rewrite API routes and MCP tools for new schema"

## Phase 6: Client API Layer

**Agent: implementer**

Rewrite `src/app/lib/api.ts`. Read first: `src/app/lib/api.ts` (current), `src/data/types.ts`, `docs/REDESIGN.md`.

New functions:
- `getRootNodes()` → GET /api/nodes
- `getNode(path)` → GET /api/nodes/:path (returns node + children + exercises + breadcrumbs)
- `getExercise(path)` → GET /api/exercises/:path (returns exercise + items, answers stripped)
- `checkAnswer(exercisePath, body)` → POST /api/exercises/:path/check (body varies by format)

Export client-side types that mirror the API response shapes. These don't need to exactly match server types — they're the stripped/public versions.

**Gate:** `npx tsc --noEmit` passes.

Commit: "Rewrite client API layer for new endpoints"

## Phase 7: UI Components

This is the largest phase. Launch three implementer agents in parallel:

**Agent A: implementer** — Routing + Dashboard + NodeView

Read first: `src/app/App.tsx`, `src/app/components/Dashboard.tsx`, `src/app/components/CategoryView.tsx`, `docs/REDESIGN.md` "UI" section, `docs/DESIGN_PRINCIPLES.md`.

1. Rewrite `src/app/App.tsx` — new hash routing:
   - `#/` → Dashboard
   - `#/node/:path+` → NodeView
   - `#/exercise/:path+` → ExerciseView (pass mode from query param)
   - Path parsing must handle multi-segment paths (everything after `#/node/` or `#/exercise/`)

2. Adapt `src/app/components/Dashboard.tsx` — 18 LL categories from `LL_CATEGORIES`. Each card links to `#/node/{id}`. Keep the existing visual style.

3. Create `src/app/components/NodeView.tsx` — replaces CategoryView:
   - Breadcrumb trail (from API response)
   - Child nodes as navigation cards (link to `#/node/{childId}`)
   - Exercises listed with format badge, item count, "Study" and "Quiz" buttons
   - "Study" links to `#/exercise/{id}?mode=learn`, "Quiz" to `#/exercise/{id}?mode=quiz`

4. Delete `src/app/components/CategoryView.tsx`

**Agent B: implementer** — ExerciseView + Learn Mode

Read first: `src/app/components/QuizView.tsx` (current — study the learn mode and quiz mode patterns), `docs/REDESIGN.md`, `docs/DESIGN_PRINCIPLES.md` (especially Learn Mode section).

1. Create `src/app/components/ExerciseView.tsx` — dispatcher:
   - Fetch exercise data on mount
   - `mode=learn` → render LearnGrid (or specialized renderer based on displayType)
   - `mode=quiz` or `mode=random-10` → render format-specific quiz component

2. Create `src/app/components/LearnGrid.tsx` — extracted from QuizView's learn mode:
   - Grid of all items — "cards on a table"
   - Card face shows answer (or cardBack from item data), tap to reveal prompt + explanation
   - Reversible direction toggle when items have cardFront/cardBack
   - "Reveal All" / "Hide All" toggle
   - "Quiz Me" button linking to quiz mode
   - Follow existing Tailwind patterns and design token system

3. Adapt `src/app/components/PeriodicTable.tsx` — make it work with new Item type instead of Question. It should be selectable via `displayType === 'periodic-table'` in ExerciseView, not by checking moduleId.

**Agent C: implementer** — Quiz Components

Read first: `src/app/components/QuizView.tsx` (current — study the quiz flow carefully), `src/app/lib/api.ts` (new), `docs/REDESIGN.md`.

1. Create `src/app/components/TextEntryQuiz.tsx` — extracted from QuizView's quiz mode:
   - One item at a time, progress bar, type answer, submit, show result (correct/incorrect + explanation)
   - "Skip & reveal answer" button
   - Next button after answer
   - When `mode=random-10`, shuffle and cap at 10
   - On complete, show QuizSummary

2. Create `src/app/components/FillBlanksQuiz.tsx` — new:
   - Display the exercise prompt (from config)
   - Text input for typing guesses
   - Grid showing found/remaining slots
   - For ordered: numbered slots, correct answers placed at their position
   - For unordered: slots fill in order of discovery
   - "X of Y found" counter
   - Give-up button reveals remaining
   - On complete (all found or gave up), show summary

3. Create `src/app/components/QuizSummary.tsx` — extracted from QuizView's complete state:
   - Score display (X / Y, percentage)
   - List of incorrect answers with correct answer + explanation
   - "Try Again", "Study", "Back" buttons

4. Delete `src/app/components/QuizView.tsx`

**Gate:** `npm run build` passes. No TypeScript errors.

**Agent: reviewer** (after all three implementers finish and gate passes)

Review the full UI changeset. Read every new/modified file in `src/app/`. Check:
- Routing handles all path patterns correctly (multi-segment, query params)
- Learn mode follows DESIGN_PRINCIPLES.md (cards on table, show answer, specialized renderers)
- No answer leakage in quiz mode (answers come from check endpoint, not exercise fetch)
- Consistent Tailwind usage matching existing design tokens
- No dead imports, no unused code from old schema
- FillBlanksQuiz interaction makes sense (type → check → place in grid)

If the reviewer finds issues, fix them before committing.

Commit: "Rewrite UI for hierarchical nodes and exercise formats"

## Phase 8: Final Verification + Deploy

**Agent: test-runner**

Run `npm run test:all`. All tests must pass.

**Gate:** All tests pass.

Then run these commands in sequence:
```bash
# Run migration on remote D1
npx wrangler d1 execute trivia-trainer --remote --file=migrations/0004_redesign.sql

# Seed remote
node scripts/seed.mjs --remote

# Deploy
npm run deploy
```

**Agent: implementer** (after deploy)

Write a Playwright script to verify the deployed site. Save it as a temp file, run it headless.

Verify:
1. Navigate to `https://trivia.emilycogsdill.com` — Dashboard loads with category cards
2. Click a category — NodeView loads with exercises
3. Click "Study" on an exercise — LearnGrid shows cards
4. Click "Quiz" on a text-entry exercise — TextEntryQuiz loads, can type and submit
5. Navigate to a fill-blanks exercise — FillBlanksQuiz loads with prompt and input
6. Take screenshots of each step to `/tmp/`

**Gate:** Screenshots show working UI at each step. No console errors.

Commit: "Deploy redesign to production"

## Phase 9: Cleanup

**Agent: implementer**

- Update `CLAUDE.md` with new schema, commands, seed format (per REDESIGN.md "Files Modified")
- Remove any dead code, unused imports, or stale references to the old schema
- Verify `.gitignore` covers `.seed-tmp.sql`
- Do NOT create new documentation files beyond updating CLAUDE.md

**Agent: reviewer**

Final review of the entire changeset (all commits since start). Read every modified file. Check:
- No references to old types (Category union, Tier, QuizModule, Question)
- No references to old API routes (/api/categories, /api/modules)
- No references to old component names (CategoryView, QuizView)
- No dead code
- Answer checking is fully server-side (no answer data in exercise fetch responses)
- CLAUDE.md accurately reflects the new system

Commit: "Clean up old references and update project docs"

Push all commits.
