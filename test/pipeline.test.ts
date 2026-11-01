import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classify, inferType, merge, normalize, normalizeCounty, type Source } from "../scripts/pipeline.ts";
import { parseJsonLd } from "../scripts/adapters/jsonld.ts";

const source: Source = { id: "test-ps", employer: "Test Public Schools", county: "Kent", city: "Testville", adapter: "jsonld", url: "https://jobs.example.org/careers" };
const now = new Date("2026-11-01T12:00:00Z");

test("classify picks the most specific category", () => {
  assert.equal(classify("Special Education Teacher - ASD"), "special-education");
  assert.equal(classify("School Social Worker"), "therapies");
  assert.equal(classify("3rd Grade Teacher"), "teaching");
  assert.equal(classify("Bus Driver"), "transportation");
  assert.equal(classify("Head Varsity Soccer Coach"), "coaching");
  assert.equal(classify("Zamboni Wrangler"), "other");
});

test("inferType reads title and schema employmentType", () => {
  assert.equal(inferType("Daily Substitute Teacher"), "Substitute");
  assert.equal(inferType("Cook", "PART_TIME"), "Part Time");
  assert.equal(inferType("Summer School Teacher"), "Temporary");
  assert.equal(inferType("Principal", "FULL_TIME"), "Full Time");
});

test("normalizeCounty handles suffixes and Saint", () => {
  assert.equal(normalizeCounty("Grand Traverse County"), "Grand Traverse");
  assert.equal(normalizeCounty("Saint Clair"), "St. Clair");
  assert.equal(normalizeCounty("Narnia"), null);
});

test("parseJsonLd extracts postings from @graph and skips malformed blocks", () => {
  const html = readFileSync(new URL("./fixtures/careers-page.html", import.meta.url), "utf8");
  const raws = parseJsonLd(html, source, source.url);
  assert.equal(raws.length, 2);
  assert.equal(raws[0].applyUrl, "https://jobs.example.org/jobs/101");
  assert.equal(raws[1].employer, "Test Public Schools");
  const job = normalize(raws[0], source, now)!;
  assert.equal(job.category, "therapies");
  assert.equal(job.county, "Kent");
  assert.equal(job.excerpt, "Provide speech & language services.");
  assert.equal(normalize(raws[1], source, now)!.type, "Part Time");
});

test("normalize rejects postings without a title or a real URL", () => {
  assert.equal(normalize({ title: "", employer: "", applyUrl: "https://x.org" }, source, now), null);
  assert.equal(normalize({ title: "Teacher", employer: "", applyUrl: "javascript:alert(1)" }, source, now), null);
});

test("merge keeps firstSeenAt, drops closed and expired jobs, and keeps failed sources within grace", () => {
  const mk = (title: string, over: object = {}) => ({ ...normalize({ title, employer: "", applyUrl: `https://x.org/${title}` }, source, now)!, ...over });
  const kept = mk("Teacher A", { firstSeenAt: "2026-10-01T00:00:00Z" });
  const closed = mk("Teacher B");
  const expired = mk("Teacher C", { expiresAt: "2026-10-31T00:00:00Z" });
  const other = { ...mk("Aide D"), sourceId: "down-ps", lastSeenAt: "2026-10-31T00:00:00Z" };
  const stale = { ...mk("Aide E"), sourceId: "down-ps", lastSeenAt: "2026-10-01T00:00:00Z" };
  const result = merge([kept, closed, expired, other, stale], [mk("Teacher A"), expired], new Set(["down-ps"]), now);
  const titles = result.map((j) => j.title).sort();
  assert.deepEqual(titles, ["Aide D", "Teacher A"]);
  assert.equal(result.find((j) => j.title === "Teacher A")!.firstSeenAt, "2026-10-01T00:00:00Z");
});
