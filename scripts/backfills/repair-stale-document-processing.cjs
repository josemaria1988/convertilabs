#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { pathToFileURL } = require("node:url");

require(path.join(__dirname, "..", "..", "tests", "register-ts.cjs"));

function parseArgs(argv) {
  const parsed = {
    dryRun: true,
    organizationId: null,
    documentIds: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }

    if (argument === "--apply") {
      parsed.dryRun = false;
      continue;
    }

    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (argument === "--organization-id") {
      parsed.organizationId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === "--document-id") {
      const value = argv[index + 1] ?? "";
      parsed.documentIds.push(...value.split(",").map((entry) => entry.trim()).filter(Boolean));
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

function printUsage() {
  console.log("Uso:");
  console.log("  npm run documents:repair:stale-processing -- [--dry-run] [--apply] [--organization-id <uuid>] [--document-id <uuid[,uuid...]>]");
  console.log("");
  console.log("Ejemplos:");
  console.log("  npm run documents:repair:stale-processing -- --dry-run");
  console.log("  npm run documents:repair:stale-processing -- --apply --organization-id org-uuid");
  console.log("  npm run documents:repair:stale-processing -- --apply --document-id doc-1,doc-2");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const envModuleUrl = pathToFileURL(path.join(__dirname, "..", "supabase", "env.mjs")).href;
  const { loadProjectEnv } = await import(envModuleUrl);
  loadProjectEnv();

  const {
    reconcileStaleDocumentProcessingRuns,
  } = require(path.join(__dirname, "..", "..", "modules", "documents", "processing.ts"));
  const result = await reconcileStaleDocumentProcessingRuns({
    organizationId: options.organizationId,
    documentIds: options.documentIds,
    dryRun: options.dryRun,
  });

  console.log(
    `${options.dryRun ? "[dry-run]" : "[apply]"} inspected ${result.inspectedCount} document(s), matched ${result.repairedRuns.length} stale run(s).`,
  );

  if (result.repairedRuns.length === 0) {
    return;
  }

  for (const repairedRun of result.repairedRuns) {
    console.log(
      `- document=${repairedRun.documentId} run=${repairedRun.runId} reason=${repairedRun.staleReason} applied=${repairedRun.applied} message="${repairedRun.message}"`,
    );
  }

  if (options.dryRun) {
    console.log("");
    console.log("No se aplicaron cambios. Vuelve a correr con --apply para persistir la reparacion.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
