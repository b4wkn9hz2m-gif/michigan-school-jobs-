import raw from "../../data/jobs.json";
import type { Job } from "../../scripts/pipeline.ts";
import { CATEGORIES, COUNTIES, OTHER_CATEGORY, slugify } from "../config/taxonomy.ts";

export type { Job };

// Fixture data for local previews only: JOBS_FIXTURE=test/fixtures/jobs.json npm run build
const fixturePath = process.env.JOBS_FIXTURE;
const source: Job[] = fixturePath
  ? JSON.parse((await import("node:fs")).readFileSync(fixturePath, "utf8"))
  : (raw as Job[]);

const now = Date.now();
export const jobs: Job[] = source.filter((j) => Date.parse(j.expiresAt) > now);

export const countySlug = (c: string) => slugify(c);
export const allCategories = [...CATEGORIES.map(({ slug, name }) => ({ slug, name })), OTHER_CATEGORY];

export function countByCounty(list = jobs) {
  const m = new Map<string, number>();
  for (const c of COUNTIES) m.set(c, 0);
  for (const j of list) m.set(j.county, (m.get(j.county) ?? 0) + 1);
  return m;
}

export function countByCategory(list = jobs) {
  const m = new Map<string, number>();
  for (const c of allCategories) m.set(c.slug, 0);
  for (const j of list) m.set(j.category, (m.get(j.category) ?? 0) + 1);
  return m;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Detroit" });
}

export function isNew(job: Job) {
  return now - Date.parse(job.postedAt) < 7 * 86_400_000;
}
