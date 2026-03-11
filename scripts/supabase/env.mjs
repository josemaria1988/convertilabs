import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./canonical-schema.mjs";

const envFiles = [".env.local", ".env"];

export function loadProjectEnv() {
  for (const envFile of envFiles) {
    const envPath = path.join(repoRoot, envFile);

    if (!fs.existsSync(envPath)) {
      continue;
    }

    const contents = fs.readFileSync(envPath, "utf8");

    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex < 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}
