// Generates SYNTHETIC listings for layout testing only. Never deploy these.
import { writeFileSync } from "node:fs";
import { normalize, type Source } from "../scripts/pipeline.ts";
const titles = ["Special Education Teacher - ASD", "Speech-Language Pathologist", "3rd Grade Teacher", "Bus Driver", "Custodian - Night Shift", "Paraprofessional", "High School Math Teacher", "School Social Worker", "Daily Substitute Teacher", "Food Service Cook - Part Time", "Assistant Principal", "Head Varsity Soccer Coach"];
const counties = ["Kent", "Wayne", "Oakland", "Washtenaw", "Grand Traverse", "Marquette"];
const now = new Date();
const jobs = titles.flatMap((t, i) => counties.slice(0, 1 + (i % 3)).map((c, k) => {
  const src: Source = { id: `example-${c}`, employer: `Example ${c} Schools (test data)`, county: c, city: "Exampleton", adapter: "jsonld", url: "https://example.org" };
  const j = normalize({ title: t, employer: "", applyUrl: `https://example.org/${i}-${k}`, description: "Synthetic test listing used to check the page layout. Not a real job.", postedAt: new Date(now.getTime() - (i + k) * 86400000).toISOString() }, src, now)!;
  return { ...j, featured: i === 1 && k === 0 };
}));
writeFileSync("test/fixtures/jobs.json", JSON.stringify(jobs, null, 1));
console.log(jobs.length, "synthetic jobs");
