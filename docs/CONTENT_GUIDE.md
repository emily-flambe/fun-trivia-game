# Content Guide

Standards for creating trivia exercises. Read this before writing or modifying any seed file.

## Audience

Learned League players. LL is an invitation-only online trivia league with 18 categories. Questions are typed-answer, one correct response, emphasis on breadth. Knowing *something* about 1,000 topics beats knowing everything about 10. The content in this app should optimize for that: dense, connective, trivia-useful facts across a wide surface area.

## The One Rule

**Explanations are the product.** Everything else — the schema, the UI, the quiz formats — exists to deliver explanations to the user's brain. If the explanation isn't worth reading, the item isn't worth having.

---

## Exercise Design

### Choosing a Format

| Format | When to use | Example |
|---|---|---|
| **text-entry** | Each item has a distinct question. The prompt matters as much as the answer. | "Who wrote *Moby-Dick*?" → Herman Melville |
| **fill-blanks (unordered)**| "Name all members of a set." Completeness is the challenge. | Name the six noble gases |
| **fill-blanks (ordered)** | Sequence matters. Position is a testable fact. | Name all U.S. Presidents in order |

**Default to text-entry** unless the exercise is naturally a set or sequence. Text-entry is more flexible: it supports Learn mode, Quiz mode, Grid mode, and Random 10.

### Quiz Modes

All text-entry exercises support two quiz modes, selectable by the user:

- **Quiz** (`?mode=quiz`) — sequential, one item at a time with full feedback after each answer
- **Grid** (`?mode=grid`) — all items visible at once as labeled blanks. The prompt is the label, the user fills in answers next to each one. Good for paired associations (state/capital, year/president). Submit by pressing Enter in any blank.

Grid mode is not a separate format or config — it's a presentation option available on any text-entry exercise. The "Grid" button appears alongside "Quiz" in the exercise listing and Learn mode.

**Don't split sequences.** If the content is one ordered list (all presidents, all elements by atomic number, all Super Bowl winners), keep it as ONE exercise. Users should see the complete picture in Learn mode. A 47-item grid is fine. A 118-item grid is fine. The UI handles it.

**Don't mix formats in one exercise.** Each exercise has one format. If a topic needs both Q&A and "name them all," make two exercises under the same node.

### Sizing

- **No minimum.** A 5-item exercise is fine if the set is naturally small (Great Lakes, oceans, BRICS nations).
- **No arbitrary maximum.** If the canonical set has 47 items (presidents) or 118 items (elements), include them all. Don't truncate to hit a round number.
- **Natural boundaries only.** Split exercises at natural content boundaries (decades, eras, geographic regions), never at arbitrary counts.

### Naming

- Exercise names should be plain and descriptive: "All U.S. Presidents", "World Capitals", "Element Symbols"
- No cleverness, no puns, no branding
- fill-blanks prompts should be imperative: "Name all six noble gases", "Name the first 10 amendments"

---

## Explanations

### Structure

Each explanation is a series of bullet points separated by `\n` in the JSON. No bullet characters — the UI renders them as a list.

**5–8 bullets per item.** Fewer if the item is minor (a fill-blanks entry that's one member of a set). More if the item is a major entity (a president, a country, a landmark work).

### What to Include

Listed in priority order. Every explanation should have the first 2–3. Include the rest as they apply.

1. **Core identity** — What it IS, when it happened, who did it. Dates, term of office, classification. Always first.
2. **Category/affiliation** — Party, genre, nationality, movement, era. The bucket it goes in.
3. **The famous thing** — The single fact most associated with this item. The one that shows up in trivia questions. Lincoln → Emancipation Proclamation. Hemingway → sparse prose, Old Man and the Sea.
4. **Firsts, lasts, onlys, records** — Trivia gold. "First president to X", "only country to Y", "shortest/longest/tallest/oldest". These are the facts that become trivia questions.
5. **Surprising connections** — Links to other items or unexpected associations. "Died on the same day as X", "was the son of Y", "coined the term Z". These build the web of knowledge that makes someone good at trivia.
6. **How it dies** — For people: how and when they died, especially if unusual. For things: how it ended, what replaced it. Morbid but trivia-relevant.
7. **The pub quiz fact** — The weird, memorable detail that sticks. "Could write Latin with one hand and Greek with the other." "Got stuck in the bathtub." "Was a peanut farmer." These are the facts people remember.

### What NOT to Include

- **Restating the answer.** "Paris is the capital of France." The user already knows that — it's the answer they just gave or the card they just read.
- **Vague praise.** "Was very important." "Made significant contributions." Say WHAT they did.
- **Opinions or rankings.** "Considered one of the greatest" — by whom? Either state the ranking system ("ranked #3 by C-SPAN historians poll") or skip it.
- **Unverifiable claims.** If you're not sure, don't include it. Better to have 5 solid bullets than 7 with 2 questionable ones.
- **Trivially obvious facts.** "Abraham Lincoln was the 16th president" as a bullet point for Lincoln is wasted space — that's already in the cardFront.

### Voice

- **Terse and factual.** No narrative, no transitions, no "interestingly" or "notably."
- **Lead with the fact.** Not "It is worth noting that he was the tallest president" → "Tallest president at 6'4\""
- **Use specific numbers.** Not "served for a long time" → "served 36 years (1973–2009)"
- **Use en-dashes for ranges.** 1789–1797, not 1789-1797.

### Example: Good vs Bad

**Good** (Lincoln):
```
16th President (1861–1865), Republican
Preserved the Union through the Civil War and issued the Emancipation Proclamation (1863)
Delivered the Gettysburg Address, one of the most famous speeches in American history
First Republican president ever elected
Assassinated by John Wilkes Booth at Ford's Theatre on April 14, 1865
Tallest president at 6'4" and largely self-educated as a frontier lawyer from Illinois
Established Thanksgiving as a permanent national holiday (1863)
Face on the $5 bill and the penny, and carved into Mount Rushmore
```

**Bad** (Lincoln):
```
Abraham Lincoln was the 16th president of the United States
He is widely considered one of the greatest presidents in American history
Lincoln was very important during the Civil War period
He gave many famous speeches including the Gettysburg Address
He was assassinated in 1865
Lincoln appears on U.S. currency
```

The bad version restates the answer, uses vague praise, lacks dates and specifics, and wastes bullets on obvious information.

---

## Cards (Learn Mode)

### cardFront / cardBack

Every item should have both. They control what appears on the flashcard grid in Learn mode.

**cardBack is the card face** (shown by default). It should be the **answer** — the thing to memorize.
**cardFront is revealed on tap** (shown in the detail panel). It should be the **identifier or prompt**.

| Content type | cardFront | cardBack | Why |
|---|---|---|---|
| Ordered people (presidents) | #N (YYYY–YYYY) | Full name | Number+dates identify; name is what to recall |
| Element symbols | Fe | Iron | Symbol is the clue; name is the answer |
| Country → capital | France | Paris | Country is the prompt; capital is the answer |
| Work → creator | *Moby-Dick* | Herman Melville | Work title is the clue; author is the answer |
| Event → date | 1969 | Moon landing | Date is the prompt; event is what to recall |
| Person → nickname | "Old Hickory" | Andrew Jackson | Nickname is the clue; real name is the answer |

**The Flip button** reverses cardFront ↔ cardBack, so users can drill in both directions. Design both sides to be useful standalone labels.

### When numbering is meaningful

Show numbers on cards ONLY when the number itself is trivia-relevant:
- Presidents: yes (#16 Lincoln is a trivia fact)
- Amendments: yes (the 19th Amendment is commonly referenced by number)
- Elements: yes (atomic number matters)
- Countries in a list: NO (there's no trivia value in "the 7th European country alphabetically")
- Novels in a list: NO

---

## Alternate Answers

Be generous. The fuzzy matcher handles minor typos, but alternates catch legitimate variant names:

- **Short forms**: "Washington" for "George Washington", "FDR" for "Franklin D. Roosevelt"
- **Variant spellings**: "Kyiv" / "Kiev", "Tchaikovsky" / "Chaikovsky"
- **With/without articles**: "The Great Gatsby" / "Great Gatsby"
- **With/without middle names**: "Harry Truman" / "Harry S. Truman"
- **Common nicknames**: "Teddy Roosevelt" / "TR"
- **Abbreviations**: "UK" / "United Kingdom"

Don't include wrong answers as alternates. "Holland" is not an alternate for "Netherlands" — it's a common misconception (Holland is two provinces). But "The Netherlands" IS a valid alternate for "Netherlands."

---

## Fact Verification

### Always verify with WebSearch

- Current world leaders, heads of state
- Recent award winners (Oscars, Nobel, etc.)
- Championship results from the last 2 years
- Population figures, GDP rankings
- Any "current" or "most recent" claim

### Trust but double-check

- Historical dates (training data is usually right, but off-by-one errors happen)
- Death dates of people who died recently
- Record holders (records get broken)

### Safe to use from training data

- Well-established historical facts (who wrote *Hamlet*, when was the Battle of Hastings)
- Scientific constants and classifications
- Geographic facts that don't change (capitals DO change occasionally — verify)

---

## Content Authoring

### Primary workflow: Admin API and MCP tools

Content is authored via the admin API or MCP tools, landing directly in D1. The database is the source of truth — not seed files.

### Admin API endpoints

All admin endpoints require a Cloudflare Access JWT from an admin email.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/exercises` | Create exercise with items |
| `PUT` | `/api/admin/exercises/:id` | Update exercise metadata |
| `DELETE` | `/api/admin/exercises/:id` | Delete exercise |
| `POST` | `/api/admin/exercises/:id/items` | Bulk upsert items |
| `PUT` | `/api/admin/exercises/:exerciseId/items/:itemId` | Update single item |
| `DELETE` | `/api/admin/exercises/:exerciseId/items/:itemId` | Delete item |
| `POST` | `/api/admin/nodes` | Upsert node |
| `GET` | `/api/admin/export/:exerciseId` | Export single exercise as seed JSON |
| `GET` | `/api/admin/export` | Export entire DB as seed JSON |
| `GET` | `/api/admin/content-health` | Content health report |

### MCP tools

The same operations are available as MCP tools for agent-driven content authoring:

`create_exercise`, `update_exercise`, `delete_exercise`, `upsert_items`, `update_item`, `delete_item`, `upsert_node`, `export_exercise`, `export_all`, `content_health`

### Seed files (optional)

Seed files in `seeds/` are still available for bulk import via `node scripts/seed.mjs --local` or `node scripts/seed.mjs --remote`, but they are no longer the source of truth. They serve as optional snapshots for bootstrapping or backup. The D1 database is canonical.

### Item IDs

Content-derived slugs, not indices. Use the most recognizable short form:
- `lincoln` not `president-16` or `item-0`
- `iron` not `fe` or `element-26`
- `paris` not `capital-france`

Must be unique within the exercise.

### Newlines in explanations

Use literal `\n` in JSON strings to separate bullet points. The UI splits on this and renders as a bulleted list.

```json
"explanation": "First fact about the thing\nSecond fact\nThird fact"
```

### Wikipedia Links

Every item MUST include a `links` array with at least one Wikipedia link. Links appear below explanations as "Read more:" hyperlinks.

**Required:** The main subject of the item (person, place, event, concept).
**Recommended:** 1-2 additional related topics mentioned in the explanation.

```json
"links": [
  { "text": "Alexander Graham Bell", "url": "https://en.wikipedia.org/wiki/Alexander_Graham_Bell" },
  { "text": "Telephone", "url": "https://en.wikipedia.org/wiki/Telephone" }
]
```

**Link text** should be the article's display name (e.g., "Alexander Graham Bell", not "the inventor").
**URLs** follow Wikipedia's format: `https://en.wikipedia.org/wiki/Article_Title` with underscores for spaces.
**Verify URLs** resolve to the correct article. Check for disambiguation pages.

Link validation is done via the `GET /api/admin/content-health` endpoint, which reports items missing Wikipedia links across the entire database.

### Sort order

Items appear in the order listed in the seed array or the order they are upserted via the API. For fill-blanks ordered exercises, this order IS the sequence. For text-entry and unordered fill-blanks, the quiz shuffles them but Learn mode preserves the authored order.

Put items in the most natural study order: chronological for historical sequences, alphabetical for reference sets, or "most important first" for curated lists.
