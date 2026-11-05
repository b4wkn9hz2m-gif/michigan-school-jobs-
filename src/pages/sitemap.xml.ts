import type { APIRoute } from "astro";
import { COUNTIES } from "../config/taxonomy.ts";
import { jobs, allCategories, countByCategory, countByCounty, countySlug, comboPages } from "../lib/jobs.ts";

export const GET: APIRoute = ({ site }) => {
  const byCounty = countByCounty();
  const byCat = countByCategory();
  const paths = [
    "/", "/jobs", "/counties", "/pricing", "/about", "/contact", "/post-a-job", "/privacy", "/terms",
    ...COUNTIES.filter((c) => (byCounty.get(c) ?? 0) > 0).map((c) => `/counties/${countySlug(c)}`),
    ...allCategories.filter((c) => (byCat.get(c.slug) ?? 0) > 0).map((c) => `/categories/${c.slug}`),
    ...comboPages().map((p) => `/counties/${countySlug(p.county)}/${p.category.slug}`),
    ...jobs.map((j) => `/jobs/${j.slug}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map((p) => `  <url><loc>${new URL(p, site)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "content-type": "application/xml" } });
};
