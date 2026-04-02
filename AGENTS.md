# Agent Instructions

This file defines the minimum required rules for automated coding agents.
`CLAUDE.md` contains full project context and detailed procedures.
If there is a conflict, follow the stricter rule.

## Non-Negotiable Rules

- Do all implementation work in a dedicated git worktree; never work directly in the primary checkout.
- Every feature and bug fix must include test coverage.
- Run `npm run test:all` before finalizing changes.
- Use non-destructive git commands only (no force push, no hard reset, no destructive checkout).
- All changes must go through a pull request; do not push directly to `main`.
- For trivia content tasks, the live D1/admin API is the source of truth; do not use seed files.

## Content Operations (MANDATORY)

- NEVER use `seeds/*.json` or `scripts/seed.mjs` to implement content tickets.
- Use admin API endpoints (`/api/admin/*`) for content creation/updates.
- Use remote D1 queries for verification and targeted fixes.

### Quiz Structure (MANDATORY)

- In `text-entry`, answers must be short/canonical and easy to type.
- Prompts must cue a single expected answer; do not require users to type long definitions.
- For foreign phrase exercises, use meaning/context in prompt and phrase as answer.
- Add alternates for punctuation/diacritic variants when relevant.
- In `fill-blanks`, include `data.label` when slots need explicit cues (for example NATO letters).

### Required Auth In Non-Interactive Shells

Wrangler remote D1 commands require `CLOUDFLARE_API_TOKEN`.

```powershell
$env:CLOUDFLARE_API_TOKEN="<token>"
```

Admin API automation should use `Authorization: Bearer <ADMIN_API_KEY>`.

## Reference

- Read `CLAUDE.md` before substantial changes for architecture, testing matrix, deployment, and workflow details.
