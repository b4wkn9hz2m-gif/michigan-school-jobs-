import { defineConfig } from "astro/config";

// Set SITE_URL in the deploy environment once a domain is chosen.
export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  trailingSlash: "ignore",
});
