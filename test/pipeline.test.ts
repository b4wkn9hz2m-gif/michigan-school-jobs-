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

import { parseAppliTrack } from "../scripts/adapters/applitrack.ts";

test("parseAppliTrack reads real AppliTrack markup", () => {
  const html = readFileSync(new URL("./fixtures/applitrack-maisd.html", import.meta.url), "utf8");
  const src: Source = { id: "montcalm-isd", employer: "Montcalm Area ISD", county: "Montcalm", adapter: "applitrack", url: "https://www.applitrack.com/maisd/onlineapp/jobpostings/view.asp?all=1&embed=1" };
  const raws = parseAppliTrack(html, src);
  assert.equal(raws.length, 2);
  assert.equal(raws[0].title, "Business Manager");
  assert.equal(raws[0].employer, "Vestaburg Community School");
  assert.equal(raws[0].postedAt, "2026-09-30T12:00:00-05:00");
  assert.match(raws[0].applyUrl, /^https:\/\/www\.applitrack\.com\/maisd\/OnlineApp\/JobPostings\/view\.asp\?all=1&AppliTrackJobId=4910_37258&/);
  assert.match(raws[0].description!, /^Position type: Administration \/ Business Manager\./);
  const job = normalize(raws[1], src, now)!;
  assert.equal(job.title, "Special Education Supervisor");
  assert.equal(job.category, "special-education");
  assert.equal(job.county, "Montcalm");
});

test("open-ended postings stay up while listed, and test postings are skipped", () => {
  const old = normalize({ title: "Kitchen Helper", employer: "", applyUrl: "https://x.org/1", postedAt: "2024-07-11" }, source, now)!;
  assert.ok(Date.parse(old.expiresAt) > now.getTime());
  assert.equal(old.deadline, null);
  assert.equal(normalize({ title: "TEST ONLY - Do not apply.", employer: "", applyUrl: "https://x.org/2" }, source, now), null);
});

test("new categories: early childhood, clubs, security, excluded coach titles", () => {
  assert.equal(classify("GSRP Relief Assistant"), "early-childhood");
  assert.equal(classify("Drama Club Sponsor"), "coaching");
  assert.equal(classify("Building Security"), "safety-security");
  assert.equal(classify("Instructional Coach - K-5"), "teaching");
  assert.equal(classify("District Psychologist"), "therapies");
});

test("countyByEmployer overrides the source's default county", () => {
  const src: Source = { ...source, countyByEmployer: { "Mt. Pleasant Public Schools": "Isabella" } };
  assert.equal(normalize({ title: "Teacher", employer: "Mt. Pleasant Public Schools", applyUrl: "https://x.org/a" }, src, now)!.county, "Isabella");
  assert.equal(normalize({ title: "Teacher", employer: "Flint Community Schools", applyUrl: "https://x.org/b" }, src, now)!.county, "Kent");
});

import { applyFeatured } from "../scripts/pipeline.ts";

test("applyFeatured pins matching paid jobs until the end date", () => {
  const mk = (title: string, employer: string, d: string) => ({ ...normalize({ title, employer, applyUrl: `https://x.org/${title}`, postedAt: d }, source, now)! });
  const jobs = [mk("Teacher", "A Schools", "2026-10-30"), mk("Speech Pathologist", "B Schools", "2026-10-01"), mk("Aide", "C Agency", "2026-09-01")];
  const out = applyFeatured(jobs, [
    { employer: "b schools", titleContains: "speech", until: "2026-12-01" },
    { employer: "C Agency", until: "2026-12-01" },
    { applyUrl: "https://x.org/Teacher", until: "2026-10-01" }, // expired
    { until: "2026-12-01" }, // matches nothing (no criteria)
  ], now);
  assert.deepEqual(out.filter((j) => j.featured).map((j) => j.title), ["Speech Pathologist", "Aide"]);
  assert.equal(out[0].featured, true);
  assert.equal(out.at(-1)!.title, "Teacher");
});

test("normalize strips URLs pasted into titles", () => {
  const j = normalize({ title: "Bus Driverhttps://www.applitrack.com/wisd/onlineapp/admin/x", employer: "", applyUrl: "https://x.org/u" }, source, now)!;
  assert.equal(j.title, "Bus Driver");
});

import { pageConfirmsJob, verifyJobs } from "../scripts/linkcheck.ts";

test("pageConfirmsJob matches the AppliTrack JobID or the title", () => {
  const j = normalize({ title: "Business Manager", employer: "", applyUrl: "https://www.applitrack.com/maisd/OnlineApp/JobPostings/view.asp?all=1&AppliTrackJobId=4910_37258&AppliTrackViewPosting=1" }, source, now)!;
  assert.ok(pageConfirmsJob(readFileSync(new URL("./fixtures/applitrack-maisd.html", import.meta.url), "utf8"), j));
  assert.ok(pageConfirmsJob("<h1>Business&nbsp;Manager</h1>", j));
  assert.ok(!pageConfirmsJob("<p>This posting is no longer available.</p>", j));
});

test("verifyJobs drops broken links, keeps good ones, and does nothing during an outage", async () => {
  const mk = (n: number) => normalize({ title: `Teacher Number ${n}`, employer: "", applyUrl: `https://x.org/${n}` }, source, now)!;
  const jobs = Array.from({ length: 12 }, (_, n) => mk(n));
  const okFetch = async (url: string) => {
    const n = Number(url.split("/").pop());
    if (n === 3) return { status: 404, body: "" };
    if (n === 7) return { status: 200, body: "<p>Posting closed</p>" };
    return { status: 200, body: `<h1>Teacher Number ${n}</h1>` };
  };
  const r = await verifyJobs(jobs, okFetch, now, 3);
  assert.equal(r.outage, false);
  assert.deepEqual(r.broken.map((b) => b.title).sort(), ["Teacher Number 3", "Teacher Number 7"]);
  assert.equal(r.kept.length, 10);
  assert.ok(r.kept.every((j) => j.verifiedAt === now.toISOString()));
  // Already verified recently -> not re-checked
  const again = await verifyJobs(r.kept, async () => { throw new Error("should not fetch"); }, now);
  assert.equal(again.checked, 0);
  // Outage: everything fails -> nothing removed
  const down = await verifyJobs(jobs, async () => { throw new Error("ECONNRESET"); }, now);
  assert.equal(down.outage, true);
  assert.equal(down.kept.length, 12);
  assert.equal(down.broken.length, 0);
});

import { verificationUrl } from "../scripts/linkcheck.ts";

test("verificationUrl reads AppliTrack's server-rendered version of the same posting", () => {
  assert.equal(verificationUrl("https://www.applitrack.com/x/OnlineApp/JobPostings/view.asp?all=1&AppliTrackJobId=1_2&AppliTrackViewPosting=1"),
    "https://www.applitrack.com/x/OnlineApp/JobPostings/view.asp?all=1&AppliTrackJobId=1_2&AppliTrackViewPosting=1&embed=1");
  assert.equal(verificationUrl("https://www.applitrack.com/x/a.asp?embed=1"), "https://www.applitrack.com/x/a.asp?embed=1");
  assert.equal(verificationUrl("https://jobs.example.org/1"), "https://jobs.example.org/1");
});

test("AppliTrack jobs hosted on a member district's board link to that district's posting, with description", () => {
  const html = readFileSync(new URL("./fixtures/applitrack-outside.html", import.meta.url), "utf8");
  const src: Source = { id: "wayne-resa", employer: "Wayne RESA", county: "Wayne", adapter: "applitrack", url: "https://www.applitrack.com/resa/onlineapp/jobpostings/view.asp?all=1&embed=1" };
  const [raw] = parseAppliTrack(html, src);
  assert.equal(raw.applyUrl, "https://www.applitrack.com/GPSchools/onlineapp/JobPostings/view.asp?AppliTrackJobId=4163&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1");
  assert.equal(raw.employer, "Grosse Pointe Public Schools");
  assert.match(raw.description!, /POSITION DESCRIPTION: The School Psychologist is responsible/);
});

import { directJobs } from "../scripts/direct.ts";

test("direct employer posts become listings until their end date", () => {
  const post = { title: "Preschool Director", employer: "Trinity Christian Academy", county: "Oakland", city: "Pontiac", employmentType: "Full Time", applyUrl: "https://tally.so/r/x", postedAt: "2026-11-05T12:00:00-05:00", expiresAt: "2026-12-05T23:59:00-05:00", description: "Lead our preschool program." };
  const [job] = directJobs([post], new Date("2026-11-06"));
  assert.equal(job.sourceId, "direct");
  assert.equal(job.category, "early-childhood");
  assert.equal(job.county, "Oakland");
  assert.equal(job.applyUrl, "https://tally.so/r/x");
  assert.equal(directJobs([post], new Date("2026-12-07")).length, 0);
});
