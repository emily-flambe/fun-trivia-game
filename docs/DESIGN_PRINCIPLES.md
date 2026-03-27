# Trivia Trainer — Design Principles

Lessons learned from building this app. These override the PRD when they conflict.

## Learn Mode

**Cards on a table, not flashcards.** Learn mode shows ALL items in a grid simultaneously — like cards laid out on a table. Users can see everything at once, tap to expand details. Not one-at-a-time flashcards.

**No arbitrary numbering on cards.** Cards should NOT show sequential numbers (1, 2, 3...) unless the number is a relevant fact — like a president's number (#16 Lincoln) or an element's atomic number. For countries, novels, paintings, etc., the number adds nothing and clutters the card.

**Show the answer, not the question.** In Learn mode, the card face shows the answer (the thing to memorize), not the question prompt. The question and explanation are revealed on tap. You're studying a reference, not taking a test.

**Specialized renderers for specialized content.** Some content has a natural visual layout (periodic table, maps, timelines). Use it. Don't force everything into generic cards. The module should declare its display type, and the renderer should be selected accordingly — not hardcoded via moduleId checks.

## Quiz Mode

**Quiz tests recall.** Quiz mode presents the question, user types the answer. This is where the work happens. Learn mode is for reference; Quiz mode is for testing.

**Fuzzy matching is generous.** Accept minor typos (Levenshtein ≤ 2 for answers ≥ 5 chars), case-insensitive, strip diacritics, strip leading articles ("The Great Gatsby" = "Great Gatsby"), ignore punctuation and hyphens.

**Always show the explanation after answering.** Whether right or wrong, show the explanation. This is what makes it a learning tool. The explanation should be memorable — not just restating the answer.

**"Give up" is always available.** Don't trap users on a question they don't know. Let them skip and see the answer.

## Content

**Explanations are the product.** The explanation field is the most important part of every question. It should be dense, trivia-useful, and memorable. Include: dates, key facts, surprising details, connections to other knowledge. Not just "X is the answer because X."

**Research-backed content.** Use Wikipedia and other sources to populate explanations. Don't rely on training data alone — verify facts, especially for things that change (current leaders, recent winners, updated statistics).

**Rich profiles for "things to know about."** For modules where each item is a distinct entity (countries, presidents, novels, composers), the explanation should be a dense trivia profile: founding date, key figures, notable facts, cultural impact, "pub quiz" details.

## Architecture

**Modules are the atomic unit.** Each module is a self-contained set of questions on one topic. Adding content = adding a JSON file to seeds/.

**Questions are format-agnostic.** Every question stores a canonical text answer. The presentation format (text-entry, multiple-choice, matching) is chosen at quiz time, not baked into the question data.

**Display types are module-level.** Modules should declare how they want to be rendered in Learn mode (`cards`, `periodic-table`, `map`, `timeline`, etc.). The UI selects the renderer — no special-casing by moduleId.

**Think like Sporcle.** Different quizzes need different presentations. Some are typed answers, some are clickable maps, some are grids, some are timelines. The system should support all of these as pluggable display types.

## Process

**Deploy as you go.** Don't accumulate changes. Deploy after each meaningful change so the user can see progress in real time.

**Verify visually.** After deploying UI changes, take a Playwright screenshot and actually look at the page. Don't trust API responses or source code alone.
