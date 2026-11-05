import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripe, planPlacement, handleEvent } from "../fulfillment/worker.mjs";

const jobs = [
  { slug: "art-teacher-x", title: "Art Teacher", employer: "Oakland Schools", applyUrl: "https://a.test/1?x=1" },
  { slug: "bus-driver-y", title: "Bus Driver", employer: "Oakland Schools", applyUrl: "https://a.test/2" },
  { slug: "bus-driver-z", title: "Bus Driver", employer: "Wayne RESA", applyUrl: "https://a.test/3" },
];

test("signature accepts real, rejects forged and stale", async () => {
  const body = '{"a":1}', t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", "whsec").update(`${t}.${body}`).digest("hex");
  assert.equal(await verifyStripe(body, `t=${t},v1=${v1}`, "whsec"), true);
  assert.equal(await verifyStripe(body, `t=${t},v1=${"0".repeat(64)}`, "whsec"), false);
  assert.equal(await verifyStripe(body, `t=${t - 1000},v1=${v1}`, "whsec"), false);
  assert.equal(await verifyStripe(body, undefined, "whsec"), false);
});

test("job matching: site link, title, ambiguity, miss", () => {
  assert.deepEqual(planPlacement({ kind: "job", text: "https://www.michigan-school-jobs.com/jobs/art-teacher-x", jobs }).rule, { applyUrl: "https://a.test/1?x=1" });
  assert.deepEqual(planPlacement({ kind: "job", text: "art teacher", jobs }).rule, { applyUrl: "https://a.test/1?x=1" });
  assert.ok(planPlacement({ kind: "job", text: "bus driver", jobs }).error);
  assert.ok(planPlacement({ kind: "job", text: "astronaut", jobs }).error);
  assert.ok(planPlacement({ kind: "job", text: "", jobs }).error);
});

test("employer matching is exact-ish and refuses guesses", () => {
  assert.deepEqual(planPlacement({ kind: "employer", text: "oakland schools", jobs }).rule, { employer: "Oakland Schools" });
  assert.ok(planPlacement({ kind: "employer", text: "Nowhere", jobs }).error);
});

function fakeEnv(featured: any[], jobList = jobs) {
  const calls: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: any = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body });
    if (String(url).endsWith("data/jobs.json")) return new Response(JSON.stringify(jobList));
    if (String(url).endsWith("data/featured.json") && !init.method) return Response.json({ sha: "s", encoding: "base64", content: btoa(JSON.stringify(featured)) });
    if (init.method === "PUT") { featured = JSON.parse(atob(JSON.parse(init.body).content.replace(/\n/g, ""))); return new Response("{}"); }
    return new Response("{}");
  }) as any;
  return { env: { GITHUB_TOKEN: "t" }, calls, get featured() { return featured; }, restore: () => (globalThis.fetch = realFetch) };
}

test("paid featured post adds one rule, retry does not duplicate, sends alert", async () => {
  const f = fakeEnv([]);
  const ev = { type: "checkout.session.completed", data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", amount_total: 5900, customer_details: { email: "hr@x.org" }, custom_fields: [{ key: "linkortitleofthejobtofeature", text: { value: "art teacher" } }] } } };
  const now = Date.parse("2026-11-01");
  assert.equal(await handleEvent(ev, f.env, now), "placed");
  assert.equal(f.featured.length, 1);
  assert.equal(f.featured[0].until, "2026-12-01T00:00:00.000Z");
  assert.equal(await handleEvent(ev, f.env, now), "duplicate");
  assert.equal(f.featured.length, 1);
  assert.ok(f.calls.some((c) => c.url.endsWith("/issues")));
  f.restore();
});

test("unmatched payment raises a needs-a-human alert and changes nothing", async () => {
  const f = fakeEnv([]);
  const ev = { type: "checkout.session.completed", data: { object: { id: "cs_2", mode: "payment", payment_status: "paid", amount_total: 5900, custom_fields: [{ key: "job", text: { value: "astronaut" } }] } } };
  assert.equal(await handleEvent(ev, f.env), "alerted");
  assert.equal(f.featured.length, 0);
  f.restore();
});

test("subscription renewal extends the same plan", async () => {
  const f = fakeEnv([{ employer: "Wayne RESA", until: "2026-12-06T00:00:00.000Z", customer: "cus_1", ref: "cs_9" }]);
  const end = Math.floor(Date.parse("2027-01-05") / 1000);
  const ev = { type: "invoice.paid", data: { object: { id: "in_1", customer: "cus_1", billing_reason: "subscription_cycle", lines: { data: [{ period: { end } }] } } } };
  assert.equal(await handleEvent(ev, f.env), "renewed");
  assert.equal(f.featured[0].until, "2027-01-08T00:00:00.000Z");
  f.restore();
});

test("buyer emails and names never reach the repo or GitHub issues", async () => {
  const f = fakeEnv([]);
  const pii = { email: "jane.doe@school.org", name: "Jane Doe" };
  const ok = { type: "checkout.session.completed", data: { object: { id: "cs_p1", mode: "payment", payment_status: "paid", amount_total: 5900, customer_email: pii.email, customer_details: pii, custom_fields: [{ key: "job", text: { value: "art teacher" } }] } } };
  const bad = { type: "checkout.session.completed", data: { object: { id: "cs_p2", mode: "payment", payment_status: "paid", amount_total: 5900, customer_email: pii.email, customer_details: pii, custom_fields: [{ key: "job", text: { value: "astronaut" } }] } } };
  await handleEvent(ok, f.env, Date.parse("2026-11-01"));
  await handleEvent(bad, f.env, Date.parse("2026-11-01"));
  const written = JSON.stringify(f.featured) + f.calls.map((c) => {
    const body = (c as any).body ?? "";
    try { const j = JSON.parse(body); return JSON.stringify(j) + (j.content ? atob(j.content.replace(/\n/g, "")) : ""); } catch { return String(body); }
  }).join("");
  assert.ok(!written.includes(pii.email), "email leaked");
  assert.ok(!written.includes(pii.name), "name leaked");
  f.restore();
});

const paid = (id: string, cents: number, mode: string, text: string, customer?: string) => ({ type: "checkout.session.completed", data: { object: { id, mode, payment_status: "paid", amount_total: cents, customer, custom_fields: [{ key: "linkortitleofthejobtofeature", text: { value: text } }] } } });

test("each plan does what the pricing page promises", async () => {
  const now = Date.parse("2026-11-01");
  const f = fakeEnv([]);
  assert.equal(await handleEvent(paid("cs_u", 2900, "payment", "art teacher"), f.env, now), "placed");
  const urgent = f.featured.find((r: any) => r.ref === "cs_u");
  assert.equal(urgent.badge, "urgent");
  assert.equal(urgent.until, "2026-11-15T00:00:00.000Z"); // 14 days
  assert.equal(await handleEvent(paid("cs_f", 5900, "payment", "art teacher"), f.env, now), "placed");
  const feat = f.featured.find((r: any) => r.ref === "cs_f");
  assert.equal(feat.badge, undefined);
  assert.equal(feat.until, "2026-12-01T00:00:00.000Z"); // 30 days
  // Posting Plan: recorded, nothing pinned
  assert.equal(await handleEvent(paid("cs_p", 4900, "subscription", "Oakland Schools", "cus_p"), f.env, now), "recorded");
  const post = f.featured.find((r: any) => r.ref === "cs_p");
  assert.equal(post.plan, "posting");
  assert.equal(post.employer, undefined);
  assert.equal(post.applyUrl, undefined);
  // District Pro: features the district's jobs
  assert.equal(await handleEvent(paid("cs_d", 9900, "subscription", "Oakland Schools", "cus_d"), f.env, now), "placed");
  assert.equal(f.featured.find((r: any) => r.ref === "cs_d").employer, "Oakland Schools");
  // Unknown amount (e.g. Stripe's "Send test event"): alert, change nothing
  const before = f.featured.length;
  assert.equal(await handleEvent(paid("cs_t", 2000, "payment", "art teacher"), f.env, now), "alerted");
  assert.equal(f.featured.length, before);
  f.restore();
});

test("posting plan renewals extend the subscriber record", async () => {
  const f = fakeEnv([{ plan: "posting", until: "2026-12-06T00:00:00.000Z", customer: "cus_p", ref: "cs_p" }]);
  const end = Math.floor(Date.parse("2027-01-05") / 1000);
  const ev = { type: "invoice.paid", data: { object: { id: "in_2", customer: "cus_p", billing_reason: "subscription_cycle", lines: { data: [{ period: { end } }] } } } };
  assert.equal(await handleEvent(ev, f.env), "renewed");
  f.restore();
});
