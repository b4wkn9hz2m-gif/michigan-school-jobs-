// Tells Bing (and other IndexNow search engines) about pages that are new or changed.
import { readFileSync } from "node:fs";
const KEY = "460dc5f48724f86324032537ccc219a6";
const HOST = "www.michigan-school-jobs.com";
const jobs = JSON.parse(readFileSync("data/jobs.json", "utf8"));
const list = Array.isArray(jobs) ? jobs : jobs.jobs;
const cutoff = Date.now() - 2 * 86400000;
const urls = new Set(["/", "/jobs", "/counties"]);
for (const j of list) if (j.firstSeenAt && Date.parse(j.firstSeenAt) > cutoff) urls.add("/jobs/" + j.slug);
const body = { host: HOST, key: KEY, keyLocation: "https://" + HOST + "/" + KEY + ".txt", urlList: [...urls].slice(0, 10000).map((p) => "https://" + HOST + p) };
const res = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
console.log("IndexNow", res.status, body.urlList.length, "urls");
