// Runs after `astro build`. Fails the build (so nothing broken gets deployed) unless every
// listed job has a page with exactly one Apply button pointing to the employer's posting.
import { existsSync, readFileSync } from "node:fs";
import type { Job } from "./pipeline.ts";

const fixture = process.env.JOBS_FIXTURE;
const all: Job[] = JSON.parse(readFileSync(fixture || "data/jobs.json", "utf8"));
const now = Date.now();
const jobs = all.filter((j) => Date.parse(j.expiresAt) > now);
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const problems: string[] = [];

const searchPage = readFileSync("dist/jobs/index.html", "utf8");
for (const job of jobs) {
  const file = `dist/jobs/${job.slug}/index.html`;
  if (!existsSync(file)) { problems.push(`${job.slug}: page missing`); continue; }
  const html = readFileSync(file, "utf8");
  const applyLinks = [...html.matchAll(/<a[^>]*class="btn btn-green"[^>]*href="([^"]+)"[^>]*target="_blank"[^>]*>/g)].map((m) => decode(m[1]));
  if (applyLinks.length !== 1) problems.push(`${job.slug}: expected 1 Apply button, found ${applyLinks.length}`);
  else if (applyLinks[0] !== job.applyUrl) problems.push(`${job.slug}: Apply goes to ${applyLinks[0]} instead of ${job.applyUrl}`);
  if (!/^https:\/\//.test(job.applyUrl)) problems.push(`${job.slug}: apply link is not https (${job.applyUrl})`);
  if (!searchPage.includes(`"s":"${job.slug}"`)) problems.push(`${job.slug}: missing from search`);
}

if (problems.length) {
  console.error(`✗ Site check failed (${problems.length} problems):\n  ` + problems.slice(0, 30).join("\n  "));
  process.exit(1);
}
console.log(`✓ Site check: all ${jobs.length} jobs have a page with one working Apply button to the employer.`);
