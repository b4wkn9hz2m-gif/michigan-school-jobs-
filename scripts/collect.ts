// Daily collector: reads sources/districts.json, fetches each source, and rewrites data/jobs.json.
// Run with: npm run collect
import { readFile, writeFile } from "node:fs/promises";
import { applyFeatured, merge, normalize, type FeaturedRule, type Job, type RawPosting, type Source } from "./pipeline.ts";
import { parseJsonLd } from "./adapters/jsonld.ts";
import { fetchAppliTrack } from "./adapters/applitrack.ts";

const UA = "MichiganSchoolJobsBot/1.0 (+job listings aggregator; links back to the original posting)";

async function fetchSource(source: Source): Promise<RawPosting[]> {
  if (source.adapter === "applitrack") return fetchAppliTrack(source);
  const res = await fetch(source.url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseJsonLd(await res.text(), source, source.url);
}

async function main() {
  const now = new Date();
  const sources: Source[] = JSON.parse(await readFile("sources/districts.json", "utf8"));
  const previous: Job[] = JSON.parse(await readFile("data/jobs.json", "utf8"));
  const fresh: Job[] = [];
  const failed = new Set<string>();
  const report: { id: string; ok: boolean; count?: number; error?: string }[] = [];

  for (const source of sources) {
    try {
      const raws = await fetchSource(source);
      const jobs = raws.map((r) => normalize(r, source, now)).filter((j): j is Job => j !== null);
      fresh.push(...jobs);
      report.push({ id: source.id, ok: true, count: jobs.length });
    } catch (e) {
      failed.add(source.id);
      report.push({ id: source.id, ok: false, error: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, 500)); // be polite to district servers
  }

  const featuredRules: FeaturedRule[] = JSON.parse(await readFile("data/featured.json", "utf8").catch(() => "[]"));
  const jobs = applyFeatured(merge(previous, fresh, failed, now), featuredRules, now);
  await writeFile("data/jobs.json", JSON.stringify(jobs, null, 1) + "\n");
  await writeFile("data/collect-report.json", JSON.stringify({ ranAt: now.toISOString(), total: jobs.length, sources: report }, null, 1) + "\n");
  console.log(`Collected ${jobs.length} jobs from ${sources.length - failed.size}/${sources.length} sources.`);
  for (const r of report.filter((r) => !r.ok)) console.warn(`  ✗ ${r.id}: ${r.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
