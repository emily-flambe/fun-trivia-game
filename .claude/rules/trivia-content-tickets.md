# Trivia Content Ticket Conventions

When creating or updating Linear tickets with the `agent:trivia-content` label, follow these formatting rules:

## Description format

1. **Lead with the exercise list.** Start with "Add N new exercises to Category:" followed by a bulleted list.
2. **Each exercise bullet** includes: name (bold), item count (~N items), format if non-default (e.g. fill-blanks), and 3-5 example items.
3. **No filler.** Do not include:
   - Coverage percentages or stats ("13% coverage", "weakest category")
   - "Current state" / "V1 target" lines
   - Priority tier headers (### High / Medium / Lower priority)
   - Context about what already exists or previously shipped
4. **Reference the content plan.** End with:
   ```
   **Reference:** [V1 Content Plan](https://github.com/emily-flambe/fun-trivia-game/blob/main/docs/V1_CONTENT_PLAN.md) — <Category> section
   ```
5. **Include update instructions.** Add this block at the end:
   ```
   **After completing this ticket:** Update [`docs/V1_CONTENT_PLAN.md`](https://github.com/emily-flambe/fun-trivia-game/blob/main/docs/V1_CONTENT_PLAN.md) — change the status of completed exercises from ❌ to ✅, add 📋 with this ticket ID to any that were ticketed but not yet done, and update the category coverage line and V1 Summary table.
   ```

## Title format

Follow the rule in `~/.claude/rules/linear-ticket-titles.md`: lead with the category, list key topics, no percentages or filler words. Keep under 70 characters.

## Labels

Always include `agent:trivia-content` in the labels array.
