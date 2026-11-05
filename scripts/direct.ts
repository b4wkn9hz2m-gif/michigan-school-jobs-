// Jobs that employers send us directly (Post a Job form, paid Posting Plan), kept in
// data/direct-jobs.json. They're merged into the site at build time and are not touched by
// the daily collector or the link checker (their apply links are the employer's own forms).
import { normalize, type Job, type RawPosting, type Source } from "./pipeline.ts";

export type DirectPost = RawPosting & { county: string; note?: string; website?: string };

export function directJobs(posts: DirectPost[], now: Date): Job[] {
  return posts
    .map((p) => {
      const source: Source = { id: "direct", employer: p.employer, county: p.county, city: p.city, adapter: "jsonld", url: p.website ?? p.applyUrl };
      const job = normalize(p, source, new Date(p.postedAt ?? now));
      return job && { ...job, expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString() : job.expiresAt, deadline: null, firstSeenAt: job.postedAt, lastSeenAt: now.toISOString() };
    })
    .filter((j): j is Job => !!j && Date.parse(j.expiresAt) > now.getTime());
}
