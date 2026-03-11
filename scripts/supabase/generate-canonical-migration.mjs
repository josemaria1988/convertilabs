import path from "node:path";
import {
  generatedMigrationPath,
  writeCanonicalMigrationFile,
} from "./canonical-schema.mjs";

const outputPath = await writeCanonicalMigrationFile(generatedMigrationPath);

console.log(`Generated ${path.relative(process.cwd(), outputPath)}`);
