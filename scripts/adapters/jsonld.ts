// Reads schema.org JobPosting data embedded in a careers page (<script type="application/ld+json">).
// This is the standard format Google for Jobs reads, so many applicant-tracking systems publish it.
import type { RawPosting, Source } from "../pipeline.ts";

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

function collectPostings(node: any, out: any[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => collectPostings(n, out));
  const types = asArray(node["@type"]);
  if (types.includes("JobPosting")) out.push(node);
  for (const key of ["@graph", "itemListElement", "item"]) if (node[key]) collectPostings(node[key], out);
}

export function parseJsonLd(html: string, source: Source, pageUrl: string): RawPosting[] {
  const postings: any[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      collectPostings(JSON.parse(m[1].trim()), postings);
    } catch {
      // Malformed block on the page: skip it, keep the rest.
    }
  }
  return postings.map((p) => {
    const loc = asArray(p.jobLocation)[0]?.address ?? {};
    const org = asArray(p.hiringOrganization)[0];
    const url = p.url ?? p.directApply?.url ?? pageUrl;
    return {
      title: String(p.title ?? p.name ?? ""),
      employer: typeof org === "string" ? org : org?.name ?? source.employer,
      applyUrl: new URL(url, pageUrl).toString(),
      description: String(p.description ?? ""),
      city: loc.addressLocality,
      county: loc.addressRegion && /county/i.test(loc.addressRegion) ? loc.addressRegion : undefined,
      employmentType: asArray(p.employmentType).join(" "),
      postedAt: p.datePosted,
      expiresAt: p.validThrough,
    };
  });
}
