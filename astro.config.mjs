import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.convertilab.com",
  trailingSlash: "always",
  build: {
    format: "directory"
  }
});
