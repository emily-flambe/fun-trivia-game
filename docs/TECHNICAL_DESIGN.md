# Trivia Trainer — Technical Design

## Adapting the PRD to Cloudflare Workers

The PRD was written assuming a Claude artifact (single `.jsx` file, `window.storage`). This project is a **Cloudflare Workers** app deployed to `trivia.emilycogsdill.com`. This design adapts the PRD to that architecture while preserving all product requirements.

Key deviations from the PRD:
- **Not a single `.jsx` file.** A multi-file React SPA built with Vite, served by the worker via static assets.
- **`localStorage` instead of `window.storage`.** `window.storage` is artifact-specific. `localStorage` works in browsers and covers the "no auth, no server-side persistence" v1 requirement.
- **Quiz data lives in a Cloudflare D1 database**, not in TypeScript modules or inline. With ~60 modules and thousands of questions, D1 provides queryable storage without bundling data into the client, and supports filtering/pagination at the edge.
- **Seed data authored as JSON files**, loaded into D1 via a seed script. This keeps content portable and reviewable in version control.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│                Cloudflare Worker                  │
│                                                   │
│  ┌─────────────┐    ┌──────────────────────────┐ │
│  │  API Routes  │    │  Static Asset Serve     │ │
│  │  /api/*      │    │  (Vite-built SPA)       │ │
│  └──────┬──────┘    └──────────────────────────┘ │
│         │                                         │
│         ▼                                         │
│  ┌──────────────┐                                │
│  │  Cloudflare  │                                │
│  │     D1       │                                │
│  │  (modules,   │                                │
│  │  questions)  │                                │
│  └──────────────┘                                │
└──────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  React SPA   │
                    │  + Tailwind  │
                    │              │
                    │ localStorage │
                    │ for progress │
                    └──────────────┘
```

**The worker serves the SPA and provides an API backed by D1.** Quiz data (modules and questions) lives in D1 and is queried at the edge. Progress tracking remains client-side in localStorage. This keeps latency low — D1 runs co-located with the worker — while avoiding bundling thousands of questions into the client.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Cloudflare Workers | Already scaffolded, deployed to `trivia.emilycogsdill.com` |
| Frontend framework | React 19 + TypeScript | Component model fits the UI well, good ecosystem |
| Styling | Tailwind CSS 4 | Utility-first, dark theme support, no build complexity with Vite plugin |
| Build | Vite | Fast, first-class React/TS/Tailwind support, Workers-compatible |
| Testing | Vitest | Already in place, works with Vite |
| Static serving | Workers Static Assets | `wrangler` serves built SPA from `dist/` via `assets` config |
| Database | Cloudflare D1 | Edge SQLite for quiz modules and questions — co-located with worker, no cold start |
| Client storage | localStorage | Simple, synchronous, sufficient for v1 progress tracking |

### Dependencies to Add

**Production:**
- `react`, `react-dom` — UI framework
- `tailwindcss`, `@tailwindcss/vite` — styling

**Dev:**
- `vite`, `@vitejs/plugin-react` — build tooling
- `@types/react`, `@types/react-dom` — TypeScript support

---

## Project Structure

```
fun-trivia-game/
├── docs/
│   ├── PRD.md
│   └── TECHNICAL_DESIGN.md
├── public/                    # Static files (favicon, etc.)
├── src/
│   ├── worker.ts              # Worker entry point — serves SPA + API
│   ├── index.html             # SPA HTML shell
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Root component, router
│   ├── components/
│   │   ├── Dashboard.tsx      # Category grid, module listings
│   │   ├── CategoryView.tsx   # Expanded category with module list
│   │   ├── QuizView.tsx       # Active quiz experience
│   │   ├── QuizSummary.tsx    # End-of-quiz results
│   │   ├── ProgressView.tsx   # Stats dashboard
│   │   ├── ModuleCard.tsx     # Individual module display
│   │   ├── QuestionCard.tsx   # Single question rendering
│   │   ├── MatchingQuestion.tsx # Matching question type UI
│   │   └── ui/               # Shared UI primitives (Button, ProgressBar, Badge)
│   ├── data/
│   │   ├── types.ts           # TypeScript types for modules, questions
│   │   └── repository.ts     # Data access layer — queries D1 for modules/questions
│   └── lib/
│       ├── storage.ts         # localStorage wrapper with typed getters/setters
│       ├── fuzzy-match.ts     # Levenshtein + normalize for type-in answers
│       ├── quiz-engine.ts     # Session state machine, scoring, question ordering
│       └── constants.ts       # Category colors, tier definitions
├── migrations/                   # D1 schema migrations (SQL files)
│   └── 0001_initial_schema.sql
├── seeds/                        # Seed data JSON files (one per module)
│   ├── geo-world-capitals-major.json
│   ├── geo-us-state-capitals.json
│   ├── hist-us-presidents.json
│   └── ...
├── test/
│   ├── fuzzy-match.test.ts
│   ├── quiz-engine.test.ts
│   ├── storage.test.ts
│   └── worker.test.ts
├── wrangler.toml
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

---

## Data Model

### Types (`src/data/types.ts`)

```typescript
type Category = 'geography' | 'history' | 'science' | 'literature' | 'entertainment' | 'sports';
type Tier = 'foundation' | 'core' | 'advanced';
type QuestionType = 'type-in' | 'multiple-choice' | 'matching';

interface BaseQuestion {
  id: string;
  explanation: string;  // 1-2 sentences, the most important part
}

interface TypeInQuestion extends BaseQuestion {
  type: 'type-in';
  question: string;
  answer: string;
  alternateAnswers: string[];
}

interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice';
  question: string;
  options: string[];
  correctIndex: number;
}

interface MatchingQuestion extends BaseQuestion {
  type: 'matching';
  pairs: { left: string; right: string }[];
}

type Question = TypeInQuestion | MultipleChoiceQuestion | MatchingQuestion;

interface QuizModule {
  id: string;           // e.g., "geo-world-capitals-major"
  category: Category;
  name: string;
  tier: Tier;
  description: string;
  questionType: QuestionType;
  questions: Question[];
}
```

### Module ID Convention

`{category-prefix}-{topic-slug}`

| Category | Prefix |
|----------|--------|
| Geography | `geo` |
| History | `hist` |
| Science | `sci` |
| Literature | `lit` |
| Entertainment | `ent` |
| Sports & Games | `sport` |

Examples: `geo-world-capitals-major`, `hist-us-presidents`, `sci-element-symbols`

### Progress Storage Schema (localStorage)

```typescript
// Key: `progress:${moduleId}`
interface ModuleProgress {
  questions: Record<string, QuestionProgress>;
}

interface QuestionProgress {
  seen: number;
  correct: number;
  incorrect: number;
  lastSeen: string;  // ISO 8601
}

// Key: `streak`
interface StreakData {
  currentStreak: number;
  lastActiveDate: string;  // ISO 8601 date only (YYYY-MM-DD)
}

// Key: `settings`
interface UserSettings {
  preferredMode: QuizMode;
}
```

---

## D1 Database Schema

Quiz modules and questions are stored in Cloudflare D1 (edge SQLite). The schema mirrors the TypeScript types above but in relational form.

```sql
CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('geography','history','science','literature','entertainment','sports')),
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('foundation','core','advanced')),
  description TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK(question_type IN ('type-in','multiple-choice','matching'))
);

CREATE TABLE questions (
  id TEXT NOT NULL,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('type-in','multiple-choice','matching')),
  question TEXT NOT NULL,
  answer TEXT,
  alternate_answers TEXT DEFAULT '[]',  -- JSON array
  options TEXT,                          -- JSON array for multiple-choice
  correct_index INTEGER,                 -- for multiple-choice
  pairs TEXT,                            -- JSON array of {left, right} for matching
  explanation TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (id, module_id)
);

CREATE INDEX idx_questions_module ON questions(module_id);
CREATE INDEX idx_modules_category ON modules(category);
CREATE INDEX idx_modules_tier ON modules(tier);
```

Column notes:
- `alternate_answers`, `options`, and `pairs` are JSON-encoded TEXT columns. D1 supports `json_extract()` for queries if needed, but these are typically read as whole values.
- `sort_order` controls question ordering within a module for Learn mode (sequential).
- `correct_index` is only populated for multiple-choice questions.
- `answer` is only populated for type-in questions.
- `pairs` is only populated for matching questions.

### Seed Data Format

Quiz content is authored as JSON files in the `seeds/` directory, one file per module. A seed script reads these files and inserts them into D1.

```json
{
  "id": "geo-us-state-capitals",
  "category": "geography",
  "name": "US State Capitals",
  "tier": "foundation",
  "description": "All 50 US state capitals",
  "questionType": "type-in",
  "questions": [
    {
      "id": "q1",
      "type": "type-in",
      "question": "What is the capital of California?",
      "answer": "Sacramento",
      "alternateAnswers": [],
      "explanation": "Sacramento became the state capital in 1854, chosen for its central location and access to river transportation."
    }
  ]
}
```

The seed script (`scripts/seed.ts`) reads each JSON file, validates it against the TypeScript types, and runs INSERT statements against D1. It can be run locally via `wrangler d1 execute` or as part of deployment.

---

## Core Logic

### Quiz Engine (`src/lib/quiz-engine.ts`)

The quiz engine manages a quiz session. It is a pure state machine — no side effects, no DOM, no storage. Components call it and render its state.

```typescript
type QuizMode = 'learn' | 'quiz' | 'review-mistakes' | 'random-10';

interface QuizSession {
  module: QuizModule;
  mode: QuizMode;
  questions: Question[];        // Ordered question list for this session
  currentIndex: number;
  answers: SessionAnswer[];     // Accumulated answers
  startedAt: string;
  status: 'in-progress' | 'complete';
}

interface SessionAnswer {
  questionId: string;
  correct: boolean;
  userAnswer: string;
  timeSpentMs: number;
}
```

**Session initialization by mode:**
- **Learn** — all questions, sequential order, no scoring
- **Quiz** — all questions, shuffled
- **Review Mistakes** — filter to questions where `incorrect > 0` in stored progress, ordered by most recent miss first, then least recently seen
- **Random 10** — 10 random questions from the module (or all if <10)

### Fuzzy Matching (`src/lib/fuzzy-match.ts`)

For type-in questions:

1. Normalize both strings: lowercase, trim, strip diacritics, collapse whitespace
2. Check exact match against `answer` and all `alternateAnswers`
3. If no exact match and answer length >= 5, compute Levenshtein distance. Accept if distance <= 2.
4. Return `{ match: boolean; closestAnswer: string }`

Keep this simple — no NLP, no stemming. Alternate answers handle genuine variants (Kyiv/Kiev, Mumbai/Bombay).

### Storage Wrapper (`src/lib/storage.ts`)

Thin typed wrapper around localStorage:

```typescript
function getModuleProgress(moduleId: string): ModuleProgress | null
function saveModuleProgress(moduleId: string, progress: ModuleProgress): void
function getStreak(): StreakData
function updateStreak(): void  // Called when a quiz is completed
function getSettings(): UserSettings
function saveSettings(settings: UserSettings): void
```

All reads/writes wrapped in try/catch — if localStorage is unavailable (private browsing, quota), the app still works, just without persistence. No error UI needed; fail silently.

---

## Routing

Client-side hash routing. No library needed — `window.location.hash` + `hashchange` event.

| Hash | View | Description |
|------|------|-------------|
| `#/` or empty | Dashboard | Category grid |
| `#/category/:id` | CategoryView | Module list for a category |
| `#/quiz/:moduleId/:mode` | QuizView | Active quiz session |
| `#/progress` | ProgressView | Stats dashboard |

Why hash routing: Avoids the need for worker-side SPA fallback routing. The worker serves `index.html` for `/`, and all navigation happens client-side via hash changes.

---

## Worker (`src/worker.ts`)

The worker's v1 job is minimal:

1. Serve static assets (the built SPA) via Workers Static Assets binding
2. Provide a `/api/health` endpoint (useful for monitoring)
3. Return `index.html` for any non-asset, non-API route (SPA fallback)

```typescript
interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok' });
    }

    // API routes that query D1
    if (url.pathname.startsWith('/api/')) {
      // env.DB is available for all API route handlers
      // e.g., env.DB.prepare('SELECT * FROM modules WHERE category = ?').bind(category).all()
    }

    // Everything else: serve static assets (handled by assets binding)
    // Workers Static Assets handles this automatically
    return env.ASSETS.fetch(request);
  }
};
```

**wrangler.toml changes:**
```toml
name = "fun-trivia-game"
main = "src/worker.ts"
compatibility_date = "2024-12-01"
assets = { directory = "./dist/client" }

routes = [
  { pattern = "trivia.emilycogsdill.com", custom_domain = true }
]

[[d1_databases]]
binding = "DB"
database_name = "trivia-trainer"
database_id = "placeholder"
```

---

## Build Configuration

### Vite (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});
```

### Package Scripts

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "build": "vite build",
    "deploy": "vite build && wrangler deploy",
    "test": "vitest run",
    "preview": "vite preview"
  }
}
```

---

## UI Component Design

### Dashboard (`#/`)

```
┌──────────────────────────────────────────────┐
│  TRIVIA TRAINER              [Progress]      │
├──────────────────────────────────────────────┤
│                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Science  │ │ Lit     │ │ History │        │
│  │ ████░░░  │ │ ██░░░░  │ │ ███░░░  │        │
│  │ 10 mods  │ │ 11 mods │ │ 11 mods │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Geo     │ │ Entmt   │ │ Sports  │        │
│  │ █████░░  │ │ ██░░░░  │ │ █░░░░░  │        │
│  │ 14 mods  │ │ 10 mods │ │ 10 mods │        │
│  └─────────┘ └─────────┘ └─────────┘        │
│                                               │
└──────────────────────────────────────────────┘
```

- 2x3 grid on desktop, single column on mobile
- Each card: category color accent, name, progress bar, module count
- Click → navigates to `#/category/:id`

### Category View (`#/category/:id`)

- Header with category name + color
- Module list grouped by tier: Foundation first (visually emphasized), then Core, then Advanced
- Each module: name, tier badge, progress bar, best score
- Click module → mode selection modal → navigates to `#/quiz/:moduleId/:mode`

### Quiz View (`#/quiz/:moduleId/:mode`)

- Top bar: module name, progress (3/25), mode badge
- Question area: renders based on question type
  - **Multiple choice**: 4 option buttons in a 2x2 grid (mobile: single column)
  - **Type-in**: text input + submit button
  - **Matching**: two columns, click-to-pair (simpler than drag-and-drop, works on mobile)
- After answering: correct/incorrect indicator, correct answer, explanation text, Next button
- End of quiz: summary with score, time, list of wrong answers with correct answers

### Matching Question UI

Click-to-pair approach (no drag-and-drop — simpler, mobile-friendly):

1. Left column shows items, right column shows shuffled targets
2. User clicks a left item (highlights it), then clicks a right item to pair them
3. Paired items show a connecting line/color and move to a "matched" section
4. Incorrect pairs flash red and unpair
5. When all pairs matched, show results

### Progress View (`#/progress`)

- Category-level accuracy: 6 progress bars with percentages
- Weakest areas: modules with lowest accuracy, sorted
- Total mastered: `X / Y questions answered correctly at least once`
- Streak counter: `N days` with last active date
- Per-module breakdown table (collapsible by category)

---

## Category Colors

| Category | Color | Tailwind |
|----------|-------|----------|
| Science | Blue | `sky-400` / `sky-500` |
| Literature | Purple | `violet-400` / `violet-500` |
| History | Amber | `amber-400` / `amber-500` |
| Geography | Green | `emerald-400` / `emerald-500` |
| Entertainment | Pink | `pink-400` / `pink-500` |
| Sports & Games | Orange | `orange-400` / `orange-500` |

---

## Implementation Plan

### Phase 1: Infrastructure (scaffold)
1. Set up Vite + React + Tailwind build pipeline
2. Configure wrangler.toml for static assets
3. Implement hash router
4. Create shared UI components (Button, ProgressBar, Badge, etc.)
5. Define TypeScript types for modules and questions
6. Implement storage wrapper
7. Implement fuzzy matching with tests
8. Implement quiz engine with tests

### Phase 2: Foundation Modules (core content)
Implement all Foundation-tier modules (2-3 per category to start):

| Category | Foundation Modules |
|----------|--------------------|
| Geography | World Capitals — Major, US State Capitals, Countries of Europe, Major World Rivers, Oceans & Seas |
| History | US Presidents, Major Wars, Ancient Civilizations, WWI Facts, WWII Facts |
| Science | Element Symbols, Human Body Systems, Planets, Chemistry Basics |
| Literature | Shakespeare's Plays, Classic Novels → Authors, Greek/Roman Mythology |
| Entertainment | Best Picture Winners, Famous Paintings → Artist |
| Sports | Major Sports Leagues, Grand Slam Tennis, Sports Rules |

### Phase 3: UI Polish
1. Dashboard with category cards and progress
2. Category view with module listings
3. Quiz view for all three question types
4. Quiz summary screen
5. Progress view with stats
6. Dark theme refinement, animations, mobile responsiveness

### Phase 4: Expand Content
Add Core and Advanced tier modules per the PRD curriculum.

### Phase 5: Future (out of v1 scope)
- KV for server-side progress persistence (replace localStorage)
- Authentication
- AI-generated questions via Anthropic API
- Daily challenge mode

---

## Testing Strategy

| Layer | What to test | Tool |
|-------|-------------|------|
| Fuzzy matching | Normalization, Levenshtein, alternate answers, edge cases | Vitest unit tests |
| Quiz engine | Session init per mode, question ordering, scoring, completion | Vitest unit tests |
| Storage | Read/write/fallback when unavailable | Vitest unit tests |
| Worker | Health endpoint, SPA fallback | @cloudflare/vitest-pool-workers |
| Data integrity | Every module has valid structure, no empty questions/explanations | Vitest snapshot/schema tests |
| UI (future) | Core flows: start quiz, answer, see results | Playwright |

---

## Performance Considerations

- **Bundle size**: Quiz data lives in D1, not in the client bundle. The SPA only fetches module/question data via API calls when needed, keeping the initial bundle small.
- **D1 query performance**: D1 runs co-located with the worker at the edge. Queries for a single module's questions (typically 10-50 rows) complete in single-digit milliseconds. Indexes on `module_id`, `category`, and `tier` cover all query patterns.
- **Caching**: Workers Static Assets handles edge caching. Vite's content-hashed filenames ensure cache busting on deploys.
- **localStorage quota**: ~5MB is typical. Per-question progress for all 60 modules won't exceed this — each module's progress is a small JSON object.

---

## API Contracts

The worker exposes a REST API that serves both the browser SPA and external agents (OpenClaw via MCP). All responses are JSON. All endpoints are GET unless noted.

### `GET /api/health`

Health check.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "version": "0.0.1"
}
```

### `GET /api/categories`

List all categories with metadata and module counts.

**Response:** `200 OK`
```json
{
  "categories": [
    {
      "id": "geography",
      "name": "Geography",
      "color": "#34d399",
      "moduleCount": 14,
      "tiers": {
        "foundation": 5,
        "core": 5,
        "advanced": 4
      }
    }
  ]
}
```

### `GET /api/modules`

List all modules. Supports filtering.

**Query params:**
- `category` (optional): filter by category ID
- `tier` (optional): filter by tier (`foundation`, `core`, `advanced`)

**Response:** `200 OK`
```json
{
  "modules": [
    {
      "id": "geo-world-capitals-major",
      "category": "geography",
      "name": "World Capitals — Major Countries",
      "tier": "foundation",
      "description": "Capitals of ~50 most-asked countries",
      "questionType": "type-in",
      "questionCount": 50
    }
  ]
}
```

### `GET /api/modules/:moduleId`

Get a single module with full question data.

**Response:** `200 OK`
```json
{
  "id": "geo-world-capitals-major",
  "category": "geography",
  "name": "World Capitals — Major Countries",
  "tier": "foundation",
  "description": "Capitals of ~50 most-asked countries",
  "questionType": "type-in",
  "questionCount": 50,
  "questions": [
    {
      "id": "q1",
      "type": "type-in",
      "question": "What is the capital of France?",
      "answer": "Paris",
      "alternateAnswers": [],
      "explanation": "Paris has been the capital since the late 10th century under the Capetian dynasty."
    }
  ]
}
```

**Response:** `404 Not Found`
```json
{
  "error": "Module not found",
  "moduleId": "nonexistent-id"
}
```

### `POST /api/modules/:moduleId/check`

Check an answer for a specific question. Performs server-side fuzzy matching for type-in questions.

**Request body:**
```json
{
  "questionId": "q1",
  "answer": "paris"
}
```

For multiple-choice:
```json
{
  "questionId": "q1",
  "answerIndex": 2
}
```

**Response:** `200 OK`
```json
{
  "correct": true,
  "correctAnswer": "Paris",
  "explanation": "Paris has been the capital since the late 10th century under the Capetian dynasty.",
  "fuzzyMatch": false
}
```

When incorrect:
```json
{
  "correct": false,
  "correctAnswer": "Paris",
  "explanation": "Paris has been the capital since the late 10th century under the Capetian dynasty.",
  "userAnswer": "lyon",
  "fuzzyMatch": false
}
```

**Response:** `400 Bad Request`
```json
{
  "error": "Missing required field: questionId"
}
```

**Response:** `404 Not Found`
```json
{
  "error": "Question not found",
  "questionId": "q999"
}
```

### `POST /api/quiz/start`

Start a quiz session. Returns the session with ordered questions (server controls ordering based on mode).

**Request body:**
```json
{
  "moduleId": "geo-world-capitals-major",
  "mode": "quiz"
}
```

**Response:** `200 OK`
```json
{
  "sessionId": "sess_abc123",
  "moduleId": "geo-world-capitals-major",
  "mode": "quiz",
  "questionCount": 50,
  "questions": [
    {
      "index": 0,
      "id": "q14",
      "type": "type-in",
      "question": "What is the capital of Japan?"
    }
  ]
}
```

Note: In `learn` mode, questions include answers and explanations inline. In `quiz`/`review-mistakes`/`random-10` modes, answers are withheld — use the `/check` endpoint.

### `GET /api/quiz/random`

Get a random question from any module. Useful for "daily challenge" style interactions.

**Query params:**
- `category` (optional): limit to a category
- `tier` (optional): limit to a tier

**Response:** `200 OK`
```json
{
  "moduleId": "sci-planets-solar-system",
  "moduleName": "Planets of the Solar System",
  "question": {
    "id": "q3",
    "type": "multiple-choice",
    "question": "Which planet has the most moons?",
    "options": ["Jupiter", "Saturn", "Uranus", "Neptune"]
  }
}
```

### Error Responses (all endpoints)

All errors follow this shape:
```json
{
  "error": "Human-readable error message",
  "details": {}
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing/invalid params) |
| 404 | Resource not found |
| 405 | Method not allowed |
| 500 | Internal server error |

---

## MCP Integration for OpenClaw

The worker exposes an MCP (Model Context Protocol) endpoint so that an OpenClaw agent can interact with the trivia system programmatically — browsing modules, running quizzes, and checking answers without a browser.

### MCP Server Endpoint

`POST /mcp` — standard MCP JSON-RPC endpoint.

### MCP Tools Exposed

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_categories` | List all trivia categories with module counts | none |
| `list_modules` | List modules, optionally filtered | `category?`, `tier?` |
| `get_module` | Get a module with all questions | `moduleId` |
| `start_quiz` | Start a quiz session | `moduleId`, `mode` |
| `check_answer` | Check an answer for a question | `moduleId`, `questionId`, `answer` or `answerIndex` |
| `get_random_question` | Get a random question | `category?`, `tier?` |
| `get_module_stats` | Get question count and tier info for a module | `moduleId` |

### MCP Resources Exposed

| Resource URI | Description |
|-------------|-------------|
| `trivia://categories` | All categories (read-only) |
| `trivia://modules/{category}` | Modules for a category |
| `trivia://module/{moduleId}` | Full module data with questions |

### Implementation Approach

Use the `@modelcontextprotocol/sdk` package with a Workers-compatible transport. The MCP server is a thin wrapper around the same logic that powers the REST API — both call into the same quiz engine and data repository (D1).

```typescript
// src/mcp.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createMcpServer() {
  const server = new McpServer({
    name: 'trivia-trainer',
    version: '0.0.1',
  });

  server.tool('list_categories', {}, async () => {
    // calls into the same registry as GET /api/categories
  });

  server.tool('check_answer', {
    moduleId: z.string(),
    questionId: z.string(),
    answer: z.string().optional(),
    answerIndex: z.number().optional(),
  }, async ({ moduleId, questionId, answer, answerIndex }) => {
    // calls into the same fuzzy matching logic
  });

  return server;
}
```

The worker routes `/mcp` to the MCP server's HTTP handler:

```typescript
if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
  return mcpServer.handleRequest(request);
}
```

### Why MCP?

OpenClaw agents can discover and use the trivia API without hardcoded knowledge. An agent given the MCP endpoint can:
1. Browse available categories and modules
2. Start a quiz session and answer questions conversationally
3. Track which modules are Foundation tier to prioritize
4. Help author new quiz content by understanding the data schema

---

## Implementation Order (Test-First)

The build order prioritizes contracts and tests before UI:

### Step 1: Types, Data Schema, and D1 Migration
- Define all TypeScript types (`src/data/types.ts`)
- Create D1 schema migration (`migrations/0001_initial_schema.sql`)
- Create data repository (`src/data/repository.ts`) — queries D1 for modules and questions
- Apply migration locally via `wrangler d1 migrations apply`
- Write schema validation tests

### Step 2: Core Logic + Tests
- Fuzzy matching (`src/lib/fuzzy-match.ts`) + unit tests
- Quiz engine (`src/lib/quiz-engine.ts`) + unit tests
- Storage wrapper (`src/lib/storage.ts`) + unit tests

### Step 3: API Layer + Tests
- Worker with all API endpoints (`src/worker.ts`)
- Integration tests for every endpoint using `@cloudflare/vitest-pool-workers`
- Test error cases (404s, bad requests, edge cases)

### Step 4: Seed Data (Foundation Modules)
- Author seed JSON files in `seeds/` — 2-3 Foundation modules per category with real question data
- Write seed script (`scripts/seed.ts`) to load JSON into D1
- Run seed script locally via `wrangler d1 execute`
- Data validation tests pass (verify inserted data matches expected types)

### Step 5: MCP Server + Tests
- MCP tool definitions and handlers
- Integration tests for MCP tool calls

### Step 6: React SPA
- Build pipeline (Vite + React + Tailwind)
- Components consuming the API
- Client-side routing, progress tracking

---

## Open Questions

1. **Matching question UX**: Click-to-pair is proposed over drag-and-drop. If the click UX feels clunky, we could revisit with a lightweight drag library.
2. **Question ordering within Learn mode**: Sequential (as authored) or shuffled? Proposing sequential since it often follows a logical order (e.g., presidents in chronological order).
3. **Module data accuracy**: The PRD emphasizes factual accuracy. Should we add a data validation test that flags modules for manual review, or trust the authoring process?
4. **MCP transport**: The `@modelcontextprotocol/sdk` may need a Workers-compatible HTTP transport adapter. Need to verify compatibility during Step 5.
5. **Session state for `/api/quiz/start`**: Should sessions be stateless (client holds all state) or server-side (stored in KV)? Proposing stateless for v1 — the session response contains all needed data.
