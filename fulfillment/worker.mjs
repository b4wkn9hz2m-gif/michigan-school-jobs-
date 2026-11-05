// Fulfillment worker: Stripe webhook -> data/featured.json (GitHub) -> site redeploys itself.
// Secrets (set in Cloudflare, never in code): STRIPE_WEBHOOK_SECRET, GITHUB_TOKEN.
// Alerts: every sale and every problem opens a GitHub issue, which GitHub emails to the repo owner.
// Privacy: buyers' names and emails are NEVER written to the repo or to issues (the repo may be
// public). Alerts carry only the amount and Stripe IDs; buyer details stay in Stripe.
const REPO = "b4wkn9hz2m-gif/michigan-school-jobs-";
// Shown at GET / so the site health check can confirm which code is deployed.
export const VERSION = "2026-11-05.2";
const DAY = 86_400_000;
export const FEATURED_DAYS = 30;
export const GRACE_DAYS = 3;

// ---- Stripe signature check (HMAC-SHA256, 5 minute tolerance) ----
export async function verifyStripe(body, header, secret, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return header.split(",").some((p) => p.startsWith("v1=") && p.slice(3) === hex);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const iso = (ms) => new Date(ms).toISOString();

// ---- Decide what to feature. Pure, so it can be tested. ----
export function planPlacement({ kind, text, jobs, siteHost = "www.michigan-school-jobs.com" }) {
  text = (text || "").trim();
  if (!text) return { error: "buyer left the job field empty" };
  if (kind === "employer") {
    const want = norm(text);
    const employers = [...new Set(jobs.map((j) => j.employer))];
    const hits = employers.filter((e) => norm(e) === want);
    const loose = hits.length ? hits : employers.filter((e) => norm(e).includes(want) || want.includes(norm(e)));
    if (loose.length === 1) return { rule: { employer: loose[0] } };
    return { error: loose.length ? `employer name matches several: ${loose.slice(0, 5).join(" | ")}` : `no employer matches "${text}"` };
  }
  // single featured job: a link to our site, an apply link, or part of a title
  const slug = text.match(new RegExp(`${siteHost.replace(/\./g, "\\.")}/jobs/([a-z0-9-]+)`, "i"))?.[1];
  const bySlug = slug && jobs.find((j) => j.slug === slug);
  if (bySlug) return { rule: { applyUrl: bySlug.applyUrl } };
  const byUrl = /^https?:\/\//i.test(text) && jobs.find((j) => j.applyUrl === text || j.applyUrl.split("&")[0] === text.split("&")[0]);
  if (byUrl) return { rule: { applyUrl: byUrl.applyUrl } };
  if (/^https?:\/\//i.test(text)) return { error: `link does not match any live job: ${text}` };
  const hits = jobs.filter((j) => norm(j.title).includes(norm(text)));
  if (hits.length === 1) return { rule: { applyUrl: hits[0].applyUrl } };
  return { error: hits.length ? `title "${text}" matches ${hits.length} jobs` : `no live job matches "${text}"` };
}

// ---- GitHub helpers ----
const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "msj-fulfillment", ...(init.headers || {}) },
  });
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const b64e = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

async function readFile(env, path) {
  const r = await gh(env, `contents/${path}`);
  if (!r.ok) throw new Error(`read ${path}: HTTP ${r.status}`);
  const j = await r.json();
  return { sha: j.sha, text: j.encoding === "base64" ? b64d(j.content) : await (await fetch(j.download_url)).text() };
}

async function readJobs(env) {
  const r = await gh(env, "contents/data/jobs.json", { headers: { Accept: "application/vnd.github.raw+json" } });
  if (!r.ok) throw new Error(`read jobs: HTTP ${r.status}`);
  return r.json();
}

/** Apply an edit to featured.json, retrying if someone else committed in between. */
export async function editRules(env, edit, message) {
  for (let i = 0; i < 4; i++) {
    const { sha, text } = await readFile(env, "data/featured.json");
    const before = JSON.parse(text || "[]");
    const after = edit(before);
    if (after === null) return false; // nothing to change
    const put = await gh(env, "contents/data/featured.json", {
      method: "PUT",
      body: JSON.stringify({ message, content: b64e(JSON.stringify(after, null, 2) + "\n"), sha, committer: { name: "fulfillment-bot", email: "fulfillment-bot@users.noreply.github.com" } }),
    });
    if (put.ok) return true;
    if (put.status !== 409 && put.status !== 422) throw new Error(`write featured.json: HTTP ${put.status}`);
  }
  throw new Error("write featured.json: too many conflicts");
}

async function alert(env, title, body) {
  await gh(env, "issues", { method: "POST", body: JSON.stringify({ title, body }) });
}

// ---- Event handling ----
const answer = (session, ...names) => {
  const f = (session.custom_fields || []).find((x) => names.some((n) => x.key.includes(n)));
  return f?.text?.value || "";
};

// What each Stripe price buys (amount in cents). Must match PLANS in src/config/taxonomy.ts.
export const PRODUCTS = {
  2900: { name: "Urgent Badge", kind: "job", days: 14, badge: "urgent" },
  5900: { name: "Featured Post", kind: "job", days: FEATURED_DAYS },
  4900: { name: "Posting Plan", kind: "posting", days: 35 },
  9900: { name: "District Pro", kind: "employer", days: 35 },
  24900: { name: "Agency plan", kind: "employer", days: 35 },
};

export async function handleEvent(event, env, now = Date.now()) {
  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    if (obj.payment_status && obj.payment_status !== "paid") return "not paid yet";
    const amount = `$${((obj.amount_total || 0) / 100).toFixed(2)}`;
    const isSub = obj.mode === "subscription";
    const product = PRODUCTS[obj.amount_total];
    const text = answer(obj, "employer", "district", "organization", "agency", "job", "link");
    if (!product) {
      await alert(env, `Needs a human: ${amount} payment`, `A payment came in for an amount that doesn't match any plan, so nothing was changed.\n\nBuyer wrote: "${text}"\nStripe session: ${obj.id}\nStripe customer: ${obj.customer || "-"}\n\n(If this was a Stripe "Send test event", this alert means the automation is connected correctly.)`);
      return "alerted";
    }
    if (product.kind === "posting") {
      // Posting Plan: the subscriber may post their own jobs; nothing gets pinned. Keep a record so
      // renewals extend it and the daily routine knows their posts are covered.
      const rule = { note: `Posting Plan - ${amount} (${obj.id})`, plan: "posting", organization: text, until: iso(now + product.days * DAY), ref: obj.id, ...(obj.customer ? { customer: obj.customer } : {}) };
      const changed = await editRules(env, (rules) => (rules.some((r) => r.ref === obj.id) ? null : [...rules, rule]), `Record Posting Plan ${obj.id}`);
      if (changed) await alert(env, `Sale: ${amount} Posting Plan`, `New Posting Plan subscriber: "${text}". They can now send unlimited job posts through the Post a Job form; add each one to data/direct-jobs.json (expiry 30 days, renewable while subscribed).`);
      return changed ? "recorded" : "duplicate";
    }
    const jobs = await readJobs(env);
    const plan = planPlacement({ kind: product.kind, text, jobs });
    if (plan.error) {
      await alert(env, `Needs a human: ${amount} payment`, `A payment came in but I could not place it automatically.\n\nReason: ${plan.error}\nBuyer wrote: "${text}"\nStripe session: ${obj.id}\nStripe customer: ${obj.customer || "-"}\n\nThe buyer's contact details are in Stripe (Payments → search for the session ID).\nFix: add a rule to data/featured.json (see data/FEATURED.md) and email the buyer.`);
      return "alerted";
    }
    const until = iso(now + product.days * DAY);
    const rule = { note: `${product.name} - ${amount} (${obj.id})`, ...plan.rule, ...(product.badge ? { badge: product.badge } : {}), until, ref: obj.id, ...(obj.customer && isSub ? { customer: obj.customer } : {}) };
    const changed = await editRules(env, (rules) => {
      if (rules.some((r) => r.ref === obj.id)) return null; // Stripe retried; already done
      const keep = rules.filter((r) => Date.parse(r.until) > now - 30 * DAY);
      return [...keep, rule];
    }, `Fulfil ${product.name} ${obj.id}`);
    if (changed) await alert(env, `Sale: ${amount}`, `Placed automatically.\n\n\`\`\`json\n${JSON.stringify(rule, null, 2)}\n\`\`\`\nIt goes live within a couple of minutes.`);
    return changed ? "placed" : "duplicate";
  }

  if (event.type === "invoice.paid" && obj.billing_reason === "subscription_cycle") {
    const end = obj.lines?.data?.[0]?.period?.end;
    if (!end || !obj.customer) return "ignored";
    const until = iso(end * 1000 + GRACE_DAYS * DAY);
    let found = false;
    await editRules(env, (rules) => {
      const mine = rules.filter((r) => r.customer === obj.customer);
      found = mine.length > 0;
      if (!found) return null;
      return rules.map((r) => (r.customer === obj.customer ? { ...r, until } : r));
    }, `Renew plan ${obj.customer}`);
    if (!found) await alert(env, `Renewal could not be matched: ${obj.customer}`, `Invoice ${obj.id} was paid but no plan rule has this customer. Check data/featured.json.`);
    return found ? "renewed" : "alerted";
  }
  return "ignored";
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/stripe-webhook" || req.method !== "POST") return new Response(`ok ${VERSION}`, { status: 200 });
    const body = await req.text();
    if (!(await verifyStripe(body, req.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) return new Response("bad signature", { status: 400 });
    try {
      const out = await handleEvent(JSON.parse(body), env);
      return new Response(out, { status: 200 });
    } catch (e) {
      try { await alert(env, "Automation error", `${e.message}\n\nStripe will retry this event automatically for up to 3 days.`); } catch {}
      return new Response("error", { status: 500 }); // Stripe retries
    }
  },
};
