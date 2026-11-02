import raw from "../../data/jobs.json";
import featuredRules from "../../data/featured.json";
import { applyFeatured, type FeaturedRule } from "../../scripts/pipeline.ts";
import type { Job } from "../../scripts/pipeline.ts";
import { CATEGORIES, COUNTIES, OTHER_CATEGORY, slugify } from "../config/taxonomy.ts";

export type { Job };

// Fixture data for local previews only: JOBS_FIXTURE=test/fixtures/jobs.json npm run build
const fixturePath = process.env.JOBS_FIXTURE;
const source: Job[] = fixturePath
  ? JSON.parse((await import("node:fs")).readFileSync(fixturePath, "utf8"))
  : (raw as Job[]);

const now = Date.now();
export const jobs: Job[] = applyFeatured(source.filter((j) => Date.parse(j.expiresAt) > now), featuredRules as FeaturedRule[], new Date(now));

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

// Display-only cleanup of titles: districts add internal codes ("26-ATH-18 ...; NFHS") and some post in ALL CAPS.
const SMALL = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with"]);
export function cleanTitle(raw: string): string {
  let t = raw.trim().replace(/^\d{2}-[A-Z]{2,6}-\d+\s*[-:]?\s*/, "").replace(/\s*;\s*[A-Z0-9 ]{2,8}$/, "").replace(/\s{2,}/g, " ");
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length > 6 && letters === letters.toUpperCase()) {
    t = t.toLowerCase().replace(/\b[a-z][a-z'’]*/g, (w, i) => (i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)));
  }
  return t || raw;
}

// The posting's excerpt looks like "Position type: X. Location: Y." — pull the pieces out so pages can show them clearly.
export function postingFacts(job: Job): { place: string; positionType: string } {
  const e = job.excerpt || "";
  return {
    place: (e.match(/Location:\s*([^.]+)\./)?.[1] ?? "").trim(),
    positionType: (e.match(/Position type:\s*([^.]+)\./)?.[1] ?? "").trim(),
  };
}
