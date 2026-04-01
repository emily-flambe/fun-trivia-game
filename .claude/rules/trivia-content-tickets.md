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
## Title format

Follow the rule in `~/.claude/rules/linear-ticket-titles.md`: lead with the category, list key topics, no percentages or filler words. Keep under 70 characters.

## Labels

Always include `agent:trivia-content` in the labels array.
