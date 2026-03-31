# No Seed Files

**NEVER create seed files in `seeds/`.** Seed files are legacy. All content creation and updates must go through the admin API.

To create content:
1. POST nodes to `https://trivia.emilycogsdill.com/api/admin/nodes`
2. POST exercises (with items) to `https://trivia.emilycogsdill.com/api/admin/exercises`

Auth: Use the service token from `.dev.vars`:
```
CF-Access-Client-Id: <CF_ACCESS_CLIENT_ID>
CF-Access-Client-Secret: <CF_ACCESS_CLIENT_SECRET>
```

Item format for the admin API — `prompt`, `cardFront`, `cardBack`, and `links` go inside the `data` JSON object, NOT as top-level item fields:
```json
{
  "id": "item-slug",
  "answer": "Answer",
  "alternates": ["Alt"],
  "explanation": "Bullet 1\nBullet 2",
  "data": {
    "prompt": "Question?",
    "cardFront": "Front",
    "cardBack": "Back",
    "links": [{"text": "Topic", "url": "https://en.wikipedia.org/wiki/Topic"}]
  },
  "sortOrder": 1
}
```

**Why:** PR #88 switched the trivia content agent from seed files to the admin API. Seed files are not the source of truth (D1 is), and creating them causes confusion about which system to use.
