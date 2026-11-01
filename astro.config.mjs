import { defineConfig } from "astro/config";

// Canonical domain. SITE_URL can override it (e.g. for a preview deploy).
export default defineConfig({
  site: process.env.SITE_URL || "https://www.michigan-school-jobs.com",
  trailingSlash: "ignore",
});
