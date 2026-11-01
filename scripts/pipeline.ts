// Pure functions that turn raw postings from any source into clean, de-duplicated listings.
// No network or filesystem access here, so everything is unit-testable.
import { createHash } from "node:crypto";
import { CATEGORIES, COUNTIES, JOB_TYPES, slugify } from "../src/config/taxonomy.ts";

export type RawPosting = {
  title: string;
  employer: string;
  applyUrl: string;
  description?: string;
  city?: string;
  county?: string;
  employmentType?: string;
  postedAt?: string;
  expiresAt?: string;
};

export type Source = {
  id: string;
  employer: string;
  county: string;
  city?: string;
  website?: string;
  adapter: "jsonld" | "applitrack";
  url: string;
};

export type Job = {
  id: string;
  slug: string;
  title: string;
  employer: string;
  county: string;
  city: string;
  type: (typeof JOB_TYPES)[number];
  category: string;
  postedAt: string;
  expiresAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  applyUrl: string;
  excerpt: string;
  sourceId: string;
  featured: boolean;
};

export const LISTING_DAYS = 60;
// If a source fails to load, keep its last known jobs this long before dropping them.
export const SOURCE_GRACE_DAYS = 3;
const DAY = 86_400_000;

export function classify(title: string, description = ""): string {
  const hay = ` ${title.toLowerCase()} `;
  for (const c of CATEGORIES) if (c.keywords.some((k) => hay.includes(k))) return c.slug;
  const body = ` ${description.toLowerCase().slice(0, 600)} `;
  for (const c of CATEGORIES) if (c.keywords.some((k) => body.includes(k))) return c.slug;
  return "other";
}

export function inferType(title: string, employmentType = ""): Job["type"] {
  const s = `${title} ${employmentType}`.toLowerCase();
  if (/substitute|\bsub\b/.test(s)) return "Substitute";
  if (/intern/.test(s)) return "Internship";
  if (/temporary|temp\b|seasonal|summer|long[- ]term/.test(s)) return "Temporary";
  if (/part[\s_-]?time|\bpt\b/.test(s)) return "Part Time";
  return "Full Time";
}

export function normalizeCounty(raw?: string): string | null {
  if (!raw) return null;
  const s = raw.replace(/county/i, "").trim().toLowerCase().replace(/^saint /, "st. ").replace(/^st /, "st. ");
  return COUNTIES.find((c) => c.toLowerCase() === s) ?? null;
}

export function stripHtml(html = ""): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(text: string, max = 280): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function validDate(s?: string): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function jobId(employer: string, title: string, applyUrl: string): string {
  return createHash("sha1").update(`${employer}|${title}|${applyUrl}`.toLowerCase()).digest("hex").slice(0, 12);
}

export function normalize(raw: RawPosting, source: Source, now: Date): Job | null {
  const title = stripHtml(raw.title);
  if (!title || !/^https?:\/\//.test(raw.applyUrl)) return null;
  const employer = stripHtml(raw.employer) || source.employer;
  const text = stripHtml(raw.description);
  const postedAt = validDate(raw.postedAt) ?? now.toISOString();
  const expiresAt = validDate(raw.expiresAt) ?? new Date(Date.parse(postedAt) + LISTING_DAYS * DAY).toISOString();
  const id = jobId(employer, title, raw.applyUrl);
  return {
    id,
    slug: `${slugify(title).slice(0, 60)}-${id}`,
    title,
    employer,
    county: normalizeCounty(raw.county) ?? source.county,
    city: raw.city?.trim() || source.city || "",
    type: inferType(title, raw.employmentType),
    category: classify(title, text),
    postedAt,
    expiresAt,
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    applyUrl: raw.applyUrl,
    excerpt: excerpt(text),
    sourceId: source.id,
    featured: false,
  };
}

/**
 * Merge this run's results with the previous dataset.
 * - Jobs seen again keep their original firstSeenAt (and featured flag).
 * - Jobs from a source that loaded successfully but no longer list them are dropped (the posting closed).
 * - Jobs from a source that failed this run are kept for SOURCE_GRACE_DAYS.
 * - Expired jobs are always dropped.
 */
export function merge(previous: Job[], fresh: Job[], failedSourceIds: Set<string>, now: Date): Job[] {
  const prevById = new Map(previous.map((j) => [j.id, j]));
  const out = new Map<string, Job>();
  for (const j of fresh) {
    const p = prevById.get(j.id);
    out.set(j.id, p ? { ...j, firstSeenAt: p.firstSeenAt, featured: p.featured } : j);
  }
  for (const p of previous) {
    if (out.has(p.id) || !failedSourceIds.has(p.sourceId)) continue;
    if (now.getTime() - Date.parse(p.lastSeenAt) <= SOURCE_GRACE_DAYS * DAY) out.set(p.id, p);
  }
  return [...out.values()]
    .filter((j) => Date.parse(j.expiresAt) > now.getTime())
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.postedAt.localeCompare(a.postedAt));
}
