// Confirms that every job's apply link opens the employer's real posting for THAT job.
// Jobs whose link is broken are removed from the site; a widespread failure is treated as an
// outage (nothing is removed) so one bad night at a district server can't empty the site.
import { stripHtml, type Job } from "./pipeline.ts";

export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;
export type BrokenLink = { id: string; title: string; employer: string; url: string; reason: string };

export const REVERIFY_DAYS = 7;
export const OUTAGE_SHARE = 0.3; // if more than 30% of checked links fail, assume an outage

const norm = (s: string) => stripHtml(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Does this page actually show this job? */
export function pageConfirmsJob(html: string, job: Job): boolean {
  const atId = job.applyUrl.match(/AppliTrackJobId=(\d+)/i)?.[1];
  if (atId && new RegExp(`JobID:\\s*${atId}\\b`).test(html)) return true;
  const title = norm(job.title).slice(0, 40);
  return title.length >= 4 && norm(html).includes(title);
}

export function needsCheck(job: Job, now: Date): boolean {
  return !job.verifiedAt || now.getTime() - Date.parse(job.verifiedAt) > REVERIFY_DAYS * 86_400_000;
}

async function checkOne(job: Job, fetcher: Fetcher): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { status, body } = await fetcher(job.applyUrl);
      if (status >= 200 && status < 300 && pageConfirmsJob(body, job)) return null;
      if (attempt === 1) return status >= 200 && status < 300 ? "page does not show this job" : `HTTP ${status}`;
    } catch (e) {
      if (attempt === 1) return `network error: ${(e as Error).message}`;
    }
  }
  return "unknown";
}

export async function verifyJobs(jobs: Job[], fetcher: Fetcher, now: Date, concurrency = 4) {
  const toCheck = jobs.filter((j) => needsCheck(j, now));
  const results = new Map<string, string | null>();
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, toCheck.length) }, async () => {
    while (i < toCheck.length) {
      const job = toCheck[i++];
      results.set(job.id, await checkOne(job, fetcher));
    }
  }));
  const failures = [...results.values()].filter((r) => r !== null).length;
  const outage = toCheck.length >= 10 && failures / toCheck.length > OUTAGE_SHARE;
  const broken: BrokenLink[] = [];
  const kept: Job[] = [];
  for (const j of jobs) {
    if (!results.has(j.id)) { kept.push(j); continue; }
    const reason = results.get(j.id)!;
    if (reason === null) kept.push({ ...j, verifiedAt: now.toISOString() });
    else if (outage) kept.push(j); // keep as-is during an outage; recheck next run
    else broken.push({ id: j.id, title: j.title, employer: j.employer, url: j.applyUrl, reason });
  }
  return { kept, broken, checked: toCheck.length, failures, outage };
}
