# Michigan School Jobs

A statewide job board for Michigan K-12 schools. It collects openings from district career pages every morning, lists them by county and role, and links each one to the employer's official application. Job seekers always use it free. Revenue comes from featured posts, district plans, and staffing-agency plans.

To clone it for another state, edit `src/config/site.ts` and the county list in `src/config/taxonomy.ts`.

## How it runs (≈ $0/month)
| Piece | What it does | Status |
|---|---|---|
| `scripts/collect.ts` | Fetches each source in `sources/districts.json`, cleans, categorizes, de-duplicates, expires → `data/jobs.json` | ✅ built + tested |
| `scripts/adapters/jsonld.ts` | Reads schema.org `JobPosting` data from careers pages | ✅ tested on a synthetic page |
| `scripts/adapters/applitrack.ts` | Frontline AppliTrack (common in MI) | ✅ built against live pages (Nov 2026); 2,216 jobs parsed from 6 sources |
| `sources/districts.json` | Job sources. Starts with 6 county consortium boards covering 104 districts/academies (Oakland, Wayne, Washtenaw, Genesee, Montcalm, Ionia) | ✅ first batch; add more ISDs to grow coverage |
| `.github/workflows/daily-collect.yml` | Runs the collector daily at ~5am ET, tests, builds, commits new data | ✅ written, not yet run on GitHub |
| Website (`src/`) | Astro static site: home, search with filters, job pages, 83 county pages, category pages, pricing, post-a-job, sitemap | ✅ built, checked on desktop + mobile |
| `supabase/migrations/0001_accounts.sql` | Phase 2: employer/seeker accounts, direct posts, applications, resumes | ✅ schema + security tested locally, not connected to the site yet |

Hosting: connect the repo to **Cloudflare Pages** (free, commercial use allowed). Build command `npm run build`, output `dist`, env `SITE_URL=https://your-domain`. Each daily data commit triggers a redeploy.

## Ideas carried over from the Ohio hub
- Categories plus county and job-type filters, with "Featured" placement as the paid upgrade
- One clear Apply button per job
- Closed listings show a friendly "this listing has closed" page instead of an error
- Organization details are entered once and reused (saved on the device now, on the account in phase 2)
- The post-a-job form shows every missing field at once
- The category picker stays open while you choose several (checkboxes)
- Layout checked at phone and desktop widths

## Commands
```sh
npm install
npm test                 # pipeline unit tests
./test/sql/run.sh        # schema + security checks against a local Postgres (needs postgres installed)
npm run collect          # fetch listings (needs network access to the district sites)
npm run build            # build the site into dist/
JOBS_FIXTURE=test/fixtures/jobs.json npm run build   # preview with SYNTHETIC test listings (never deploy)
```

## Owner checklist before launch
- [ ] Pick a name/domain and set `contactEmail` in `src/config/site.ts`
- [ ] Have a lawyer glance at terms/privacy for an aggregator; honor removal requests within 1 business day
- [ ] Connect Cloudflare Pages; set `SITE_URL`
- [ ] Submit the sitemap in Google Search Console
- [ ] Create Stripe Payment Links for the paid plans
