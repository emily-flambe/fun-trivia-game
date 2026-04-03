# Current Events Content Policy

This policy defines how to keep the `current-events` category useful for Learned League prep without letting content decay.

## Goals

- Keep facts fresh enough to be quiz-relevant.
- Avoid "breaking news" trivia that changes too quickly.
- Promote durable items into long-term categories once they stabilize.

## Scope And Window

- Default scope: events from the last 12 months.
- Preferred domains:
  - Geopolitics and major elections
  - International conflicts and agreements
  - Nobel and other major awards
  - Science/space milestones
  - Business and regulatory headlines
  - Major sports outcomes with broad trivia value

## Authoring Standard

- Favor stable outcomes over live/volatile metrics.
- Use text-entry questions unless the topic is naturally a fixed set.
- Include enough context to explain why the event matters.
- Avoid polling snapshots, unresolved legal actions, and evolving casualty/estimate numbers.

## Required Item Metadata

For items in `current-events`, store freshness metadata in `items.data`:

```json
{
  "prompt": "Which country held a presidential election in March 2026 that returned Daniel Noboa to office?",
  "cardFront": "2026 Ecuador election",
  "cardBack": "Ecuador",
  "links": [
    {
      "text": "2026 Ecuadorian general election",
      "url": "https://en.wikipedia.org/wiki/2026_Ecuadorian_general_election"
    }
  ],
  "currentEvent": {
    "eventDate": "2026-03-15",
    "lastReviewedAt": "2026-04-01",
    "reviewAfter": "2026-07-01",
    "stalenessNote": "Accurate as of April 1, 2026"
  }
}
```

Notes:
- `eventDate`: When the event happened (or a representative date).
- `lastReviewedAt`: Most recent accuracy review date.
- `reviewAfter`: Next required review date (default every 90 days).
- `stalenessNote`: Optional absolute-date context shown to editors/readers.

## Review Cadence

- Review `current-events` monthly.
- During review:
  - Refresh answers/explanations for active items.
  - Move stabilized items into durable categories (history, civics, science, sports, etc.).
  - Archive/remove items that no longer provide LL-prep value.

## Lifecycle Rules

1. `Active` (0-12 months from `eventDate`): stays in `current-events`.
2. `Promote` (typically 6-18 months): if the event has lasting significance, move to a permanent category.
3. `Archive` (any age): if the item is no longer useful or too volatile to maintain.

## Content Health Enforcement

Use `GET /api/admin/content-health` and extend checks over time for:

- Missing `currentEvent.eventDate`
- Missing `currentEvent.lastReviewedAt`
- Overdue `currentEvent.reviewAfter`
- Items older than window without promotion/archive action

This should be treated as an editorial backlog, not a hard deploy blocker.

## Operational Workflow (Mandatory)

- Do not use seed files for current-events updates.
- Create/update via `/api/admin/*` endpoints.
- Use remote D1 queries only for targeted verification/corrections.
- Keep all dates in ISO format (`YYYY-MM-DD`) and use absolute dates in explanations/notes.
