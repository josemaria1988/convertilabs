import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.convertilabs.com",
  trailingSlash: "always",
  build: {
    format: "directory"
  }
});
