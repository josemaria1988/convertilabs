import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://www.convertilabs.com",
  trailingSlash: "always",

  build: {
    format: "directory"
  },

  adapter: cloudflare()
});