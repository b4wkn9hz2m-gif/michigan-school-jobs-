# Featured (paid) listings

`featured.json` pins paid jobs to the top of search and the home page with a "Featured" badge.
Each entry matches jobs by **any** of `jobId`, `applyUrl`, `employer` (all of that employer's jobs,
e.g. an Agency or District Pro plan), or `titleContains` (case-insensitive, combined with `employer`).
It stops automatically after `until`.

```json
[
  { "note": "Featured Post - paid 2026-11-05 (Stripe receipt #1234)", "applyUrl": "https://www.applitrack.com/...", "until": "2026-12-05" },
  { "note": "Agency plan - EduStaff", "employer": "EduStaff", "until": "2026-12-01" },
  { "note": "Featured SLP posts", "employer": "Huron Valley Schools", "titleContains": "speech", "until": "2026-12-01" }
]
```
