# Trivia Trainer — Product Requirements Document

## Overview

A single-page web app for systematically building trivia knowledge, designed specifically for Learned League preparation. The app is a curated, pedagogically structured alternative to Sporcle — fewer quizzes, but the *right* quizzes, organized into a curriculum that builds foundational knowledge across LL's six categories.

The app is built as a standalone React artifact (single `.jsx` file) using Tailwind CSS and persistent storage. No backend, no API calls. All quiz content is hardcoded or generated at build time by the coding agent.

**Target user:** Emily, a data engineer who wants to close knowledge gaps in general trivia. She's analytically minded, prefers direct feedback, and wants to see measurable progress.

---

## Core Concepts

### Categories

Learned League uses six categories. The app organizes all content under these:

1. **Science** — physics, chemistry, biology, earth science, math, medicine, technology
2. **Literature** — novels, authors, poetry, plays, literary movements, mythology
3. **History** — world history, US history, wars, leaders, ancient civilizations, political history
4. **Geography** — countries, capitals, rivers, mountains, flags, maps, demographics
5. **Entertainment** — film, TV, music, art, theater, pop culture, awards
6. **Sports & Games** — major sports, Olympics, board/card games, esports, rules, records

### Subcategories & Quiz Modules

Each category contains **quiz modules** — focused, finite sets of questions on a specific topic. A module is the atomic unit of the app. Examples:

- Geography → "World Capitals" (quiz yourself on all ~195)
- History → "US Presidents in Order"
- Science → "Periodic Table — Element Symbols"
- Entertainment → "Best Picture Winners"
- Literature → "Shakespeare's Plays"
- Sports → "Grand Slam Tennis Tournaments"

Each module has a defined **question bank** — a static list of question/answer pairs. Modules are tagged with a difficulty tier.

### Difficulty Tiers

- **Foundation** — the absolute basics that come up all the time. If you don't know these, you'll miss easy points. (e.g., world capitals of major countries, periodic table common elements, US presidents)
- **Core** — the next layer out. Solid general knowledge that covers ~70% of LL questions. (e.g., world capitals of ALL countries, rivers + what countries they flow through, Nobel Prize categories)
- **Advanced** — the long tail. Useful but diminishing returns. (e.g., vice presidents, lesser-known composers, African geography deep cuts)

---

## Curriculum: Category Breakdown

Below is the full curriculum the coding agent should implement. Each module is a quiz with a defined question bank. **The coding agent is responsible for populating these question banks with accurate data.** If a module has too many items to hardcode (e.g., all 195 world capitals), the agent should include them all — completeness matters.

### Geography

| Module | Tier | Description |
|---|---|---|
| World Capitals — Major Countries | Foundation | Capitals of ~50 most-asked countries (G20, European, major Asian/African/South American) |
| World Capitals — All Countries | Core | All ~195 sovereign nation capitals |
| US State Capitals | Foundation | All 50 |
| Countries of Europe | Foundation | Name all European countries (map or list) |
| Countries of Africa | Core | Name all African countries |
| Countries of Asia | Core | Name all Asian countries |
| Major World Rivers | Foundation | ~30 rivers: which countries, which continent, where they empty |
| Major Mountain Ranges | Core | ~20 ranges: location, notable peaks |
| Oceans & Major Seas | Foundation | 5 oceans, ~15 major seas, where they are |
| World's Largest Countries by Area | Core | Top 20 |
| World's Most Populous Countries | Core | Top 20 |
| Island Nations | Advanced | ~25 island countries and where they are |
| Landlocked Countries | Advanced | All landlocked nations |
| Flags of the World | Advanced | Visual flag identification for ~50 commonly tested nations |

### History

| Module | Tier | Description |
|---|---|---|
| US Presidents in Order | Foundation | All presidents, number, party, and era |
| Major Wars & Conflicts | Foundation | ~20 wars: dates, belligerents, outcome, key facts |
| Ancient Civilizations | Foundation | Egypt, Rome, Greece, Mesopotamia, China, Mesoamerica — key facts, dates, leaders |
| European Monarchs | Core | Key monarchs of England, France, Spain, Russia — who they were, when they ruled |
| 20th Century World Leaders | Core | ~30 leaders: country, era, key events |
| US Constitutional Amendments | Core | All 27 — what each one does |
| Major Revolutions | Core | French, American, Russian, Chinese, Industrial — key dates, figures, outcomes |
| Cold War Key Events | Core | ~15 events: dates, significance |
| World War I Key Facts | Foundation | Causes, alliances, major battles, outcome |
| World War II Key Facts | Foundation | Causes, major theaters, key figures, outcome |
| Historical Empires | Advanced | Ottoman, Mongol, British, Roman, Persian, etc. — peak territory, key rulers, timeline |

### Science

| Module | Tier | Description |
|---|---|---|
| Periodic Table — Element Symbols | Foundation | All 118 elements: name ↔ symbol |
| Periodic Table — Element Facts | Core | Atomic numbers of common elements, element categories, notable properties |
| Human Body Systems | Foundation | ~12 organ systems, major organs, basic functions |
| Planets of the Solar System | Foundation | Order, key facts (size, moons, distance), dwarf planets |
| Famous Scientists | Core | ~40 scientists: what they're known for, era, nationality |
| SI Units & Measurements | Core | Base SI units, common derived units, prefixes |
| Biological Taxonomy | Core | Kingdom/phylum/class basics, notable classifications |
| Nobel Prize in Science | Advanced | Categories, notable winners, what they won for |
| Math Fundamentals | Core | Key constants (pi, e, phi), famous theorems, mathematicians |
| Chemistry Basics | Foundation | Acids vs bases, pH, molecular formulas for common compounds |

### Literature

| Module | Tier | Description |
|---|---|---|
| Shakespeare's Plays | Foundation | All ~37 plays: which are comedies/tragedies/histories, key characters, famous quotes |
| Classic Novel → Author Matching | Foundation | ~80 major novels matched to their authors |
| Poetry → Poet Matching | Core | ~40 famous poems matched to poets |
| Literary Movements | Core | Romanticism, Modernism, Realism, etc. — key authors, time periods, characteristics |
| Mythology — Greek/Roman | Foundation | Major gods (Greek + Roman names), key myths, heroes |
| Mythology — Norse, Egyptian, Other | Core | Key figures and stories |
| Children's & YA Literature | Core | ~30 classic children's books and authors (Narnia, Roald Dahl, etc.) |
| Pulitzer Prize for Fiction | Advanced | Notable winners |
| Nobel Prize in Literature | Advanced | Notable winners and their nationalities |
| Famous Opening Lines | Core | ~25 recognizable opening lines matched to novels |
| Literary Characters → Novel | Core | ~50 famous characters: which book are they from |

### Entertainment

| Module | Tier | Description |
|---|---|---|
| Best Picture Winners | Foundation | All Academy Award Best Picture winners |
| Famous Directors → Films | Core | ~30 major directors and their key films |
| Classic TV Shows | Core | ~40 landmark TV shows: creator, network, era, premise |
| Musical Artists → Hit Songs | Core | ~50 major artists/bands and their signature songs |
| Classical Composers | Core | ~25 key composers: era, nationality, famous works |
| Art Movements | Core | Impressionism, Cubism, Renaissance, etc. — key artists, time periods |
| Famous Paintings → Artist | Foundation | ~30 iconic paintings matched to artists |
| Grammy / Emmy / Tony Basics | Advanced | Key categories, notable winners |
| Disney & Pixar Films | Core | All animated features in order |
| Broadway Musicals | Core | ~25 landmark musicals: composer/lyricist, key songs |

### Sports & Games

| Module | Tier | Description |
|---|---|---|
| Major Sports Leagues & Champions | Foundation | NFL, MLB, NBA, NHL, Premier League — recent champions, basic format |
| Olympic Host Cities | Core | All Summer + Winter Olympic host cities |
| Grand Slam Tennis | Foundation | 4 tournaments: location, surface, notable winners |
| FIFA World Cup | Core | All host countries and winners |
| Heisman Trophy Winners | Advanced | Notable winners |
| Major Golf Tournaments | Core | The 4 majors: names, locations, notable winners |
| Boxing Weight Classes | Advanced | The major classes |
| Board & Card Games | Core | Rules basics for chess, poker, bridge, backgammon, Scrabble, Go |
| Sports Rules & Terminology | Foundation | Key rules across major sports (what's an offside, what's a double fault, etc.) |
| Sports Records & Milestones | Core | Key records: home runs, points, goals, etc. |

---

## App Structure & UX

### Navigation

The app has three main views:

1. **Dashboard** — shows all six categories as cards, with progress indicators. Each category expands to show its modules with completion percentage and tier badges.
2. **Quiz View** — the active quiz experience for a selected module.
3. **Progress View** — overall stats: modules completed, accuracy by category, streak tracking, weak areas.

### Dashboard Behavior

- Categories displayed as six large cards in a grid
- Each card shows: category name, icon/color, number of modules, overall category progress (% of questions answered correctly at least once)
- Clicking a category expands it (or navigates to a subcategory page) showing all modules
- Modules show: name, tier badge (Foundation/Core/Advanced), progress bar, best score
- Foundation modules should be visually emphasized — they're the starting point

### Quiz View Behavior

- A quiz presents questions one at a time
- **Question types the app should support:**
  - **Type-in:** Free text input, fuzzy-matched (e.g., "What is the capital of France?" → user types "Paris"). Fuzzy matching should handle minor typos and common alternate spellings.
  - **Multiple choice:** 4 options, one correct. Use this for modules where type-in would be too ambiguous.
  - **Matching:** Given a list on the left and right, match them (e.g., match novels to authors). Good for association-building.
- Each module defines which question type it uses (the coding agent should choose the most appropriate type per module)
- After answering, the user sees:
  - Whether they were correct (green/red)
  - The correct answer (always shown)
  - A **brief explanation or memorable fact** (1-2 sentences) that helps the answer stick. This is critical — it's what makes this a learning tool, not just a quiz. Example: "The capital of Myanmar is Naypyidaw, not Yangon. The capital was moved in 2006 — Yangon is the largest city but not the capital."
  - A "Next" button
- At the end of a quiz session, show a summary: score, time taken, list of wrong answers for review
- Users can choose to quiz on: all questions in a module, only questions they've gotten wrong before, or a random subset

### Quiz Session Options

When starting a module, the user picks a mode:
- **Learn** — show the answer immediately alongside the question. Flashcard-style. No scoring.
- **Quiz** — standard quiz, scored
- **Review Mistakes** — only questions previously answered incorrectly
- **Random 10** — quick 10-question sample from the module

### Progress & Spaced Repetition

- Use persistent storage (`window.storage`) to track per-question state:
  - Times seen, times correct, times incorrect, last seen date
- Modules show a mastery percentage: (questions answered correctly at least once) / (total questions)
- The Progress view shows:
  - Category-level accuracy breakdown
  - A "weakest areas" section highlighting modules or questions with the lowest accuracy
  - Total questions mastered across all categories
  - A streak counter (days with at least one quiz completed)
- **Spaced repetition logic:** In "Review Mistakes" mode, prioritize questions that were most recently missed, then questions not seen in the longest time. Keep it simple — no need for a full SM-2 algorithm, just a sensible priority queue.

---

## Technical Requirements

### Stack

- **Single React `.jsx` file** — this is a Claude artifact, everything in one file
- **Tailwind CSS** for styling (utility classes only, no compiler)
- **Persistent storage** via `window.storage` API (see below)
- No external API calls. All quiz content is hardcoded in the source.
- No `localStorage` or `sessionStorage` — these don't work in the artifact environment

### Storage Schema

Use `window.storage` with these keys:

```
progress:{moduleId}  →  JSON object: { questions: { [questionId]: { seen: number, correct: number, incorrect: number, lastSeen: ISO string } } }
streak                →  JSON object: { currentStreak: number, lastActiveDate: ISO string }
settings              →  JSON object: { preferredMode: string, ... }
```

All storage calls are async and must be wrapped in try/catch. Use a single key per module to avoid excessive sequential storage calls.

### Data Structure

Each module should be defined as a JS object:

```javascript
{
  id: "geo-world-capitals-major",
  category: "geography",
  name: "World Capitals — Major Countries",
  tier: "foundation",
  questionType: "type-in",  // or "multiple-choice" or "matching"
  questions: [
    {
      id: "q1",
      question: "What is the capital of France?",
      answer: "Paris",
      alternateAnswers: [],  // for fuzzy matching
      explanation: "Paris has been the capital since the late 10th century under the Capetian dynasty."
    },
    // ...
  ]
}
```

### Fuzzy Matching

For type-in questions, implement basic fuzzy matching:
- Case-insensitive
- Trim whitespace
- Accept answers listed in `alternateAnswers` (e.g., "Kyiv" and "Kiev")
- Optionally use Levenshtein distance ≤ 2 for typo tolerance on longer answers

---

## Design Direction

The app should feel **clean, focused, and motivating** — like a well-designed study tool, not a game show. Think Duolingo's clarity meets a dark-mode dashboard aesthetic.

- Dark theme preferred (easy on the eyes for long study sessions)
- Each of the six categories gets a distinct accent color
- Progress indicators should be satisfying — progress bars, completion badges
- Typography should be crisp and readable
- Minimal chrome — the content is the interface
- Smooth transitions between views (no jarring page loads)
- Mobile-responsive (Emily may use this on her phone)

---

## Implementation Notes for the Coding Agent

1. **Start with 2-3 modules per category** to prove out the architecture, then expand. Don't try to ship all ~60 modules at once. Prioritize all Foundation tier modules first.

2. **Question bank accuracy is critical.** Double-check factual data. If you're unsure about something (e.g., whether a country's capital recently changed), flag it with a comment.

3. **The explanations are the most important part.** Every answer should have a 1-2 sentence explanation that makes the fact memorable. Don't just restate the answer — add context, a mnemonic, or a surprising detail.

4. **Keep the single-file constraint in mind.** This is a React artifact — everything goes in one `.jsx` file. The question banks will make this file large, and that's okay. Use code organization (separate sections, clear comments) to keep it navigable.

5. **The storage API is async.** Load progress data on mount, save after each answer. Don't block the UI on storage operations. Handle failures gracefully (if storage fails, the quiz still works, you just lose progress tracking).

6. **For matching questions**, implement a drag-and-drop or click-to-pair interface. Keep it simple but functional.

7. **The app should be immediately usable.** No onboarding flow, no account creation. Open it and start quizzing.

---

## Future Considerations (Out of Scope for v1)

These are things Emily may ask the OpenClaw agent to add later:

- AI-generated quiz questions (via Anthropic API) for infinite practice
- Custom quiz creation (user adds their own questions)
- Daily challenge mode (curated mix across categories)
- Import/export progress data
- Timed challenge mode
- Multiplayer/comparison features
- Integration with Learned League question history for meta-analysis
