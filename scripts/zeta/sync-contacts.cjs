#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
require("../runtime/register-ts.cjs");

const { createClient } = require("@supabase/supabase-js");
const { runZetaSync } = require("@/modules/integrations/zeta/services/sync-service");

function printHelp() {
  console.log(`
Uso:
  npm run zeta:sync:contacts -- --slug <slug>
  npm run zeta:sync:contacts -- --organization-id <uuid>

Opciones:
  --slug <slug>              Slug de la organizacion en Convertilabs.
  --organization-id <uuid>   ID de la organizacion.
  --max-pages <n>            Paginas maximas de RESTContactosV3Query. Default: 200.
  --progress-every <n>       Imprime avance cada N contactos. Default: 100.
  --real                     Exige conexion Zeta real y marca testMode=false.
  --test                     Fuerza testMode=true.
  --test-run-key <key>       Clave de corrida test para trazabilidad.
`);
}

function parseArgs(argv) {
  const args = {
    slug: null,
    organizationId: null,
    maxPages: 200,
    progressEvery: 100,
    testMode: undefined,
    testRunKey: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--slug") {
      args.slug = next ?? null;
      index += 1;
    } else if (arg === "--organization-id" || arg === "--org-id") {
      args.organizationId = next ?? null;
      index += 1;
    } else if (arg === "--max-pages") {
      args.maxPages = Number(next);
      index += 1;
    } else if (arg === "--progress-every") {
      args.progressEvery = Number(next);
      index += 1;
    } else if (arg === "--real") {
      args.testMode = false;
    } else if (arg === "--test") {
      args.testMode = true;
    } else if (arg === "--test-run-key") {
      args.testRunKey = next ?? null;
      index += 1;
    } else {
      throw new Error(`Argumento no soportado: ${arg}`);
    }
  }

  if (!Number.isFinite(args.maxPages) || args.maxPages < 1) {
    throw new Error("--max-pages debe ser un numero mayor a cero.");
  }

  args.maxPages = Math.trunc(args.maxPages);

  if (!Number.isFinite(args.progressEvery) || args.progressEvery < 1) {
    throw new Error("--progress-every debe ser un numero mayor a cero.");
  }

  args.progressEvery = Math.trunc(args.progressEvery);

  return args;
}

async function resolveOrganizationId(supabase, args) {
  if (args.organizationId) {
    return args.organizationId;
  }

  if (!args.slug) {
    throw new Error("Indica --slug o --organization-id.");
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", args.slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error(`No encontre una organizacion con slug "${args.slug}".`);
  }

  console.log(`Organizacion: ${data.name ?? data.slug} (${data.id})`);

  return String(data.id);
}

async function assertRealZetaConnection(supabase, organizationId) {
  const { data, error } = await supabase
    .from("organization_integration_connections")
    .select("test_mode, config_json")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Guarda la conexion Zetasoftware antes de ejecutar el sync real.");
  }

  if (data.test_mode === true || data.config_json?.mock_enabled === true) {
    throw new Error(
      "La conexion Zetasoftware esta en modo test/mock. Desactiva test_mode/mock_enabled antes de usar --real.",
    );
  }
}

function timestamp() {
  return new Date().toLocaleTimeString("es-UY", { hour12: false });
}

function printProgress(progress) {
  if (progress.stage === "zeta_master_query_fetched") {
    console.log(
      `[${timestamp()}] ${progress.queryKey}: ${progress.rows} filas, `
      + `${progress.recordsSeen} vistas, ${progress.recordsUpserted} raw upserted.`,
    );
    return;
  }

  if (progress.stage === "zeta_contacts_materialization") {
    console.log(
      `[${timestamp()}] contactos ${progress.seen}/${progress.total} | `
      + `creados ${progress.created} | actualizados ${progress.updated} | `
      + `omitidos ${progress.skipped} | fallidos ${progress.failed}`,
    );
  }
}

async function main() {
  const { loadProjectEnv } = await import("../supabase/env.mjs");
  loadProjectEnv();

  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const organizationId = await resolveOrganizationId(supabase, args);

  if (args.testMode === false) {
    await assertRealZetaConnection(supabase, organizationId);
  }

  console.log(
    `Iniciando sync de contactos Zeta (maxPages=${args.maxPages}, progressEvery=${args.progressEvery}).`,
  );

  const summary = await runZetaSync({
    supabase,
    organizationId,
    stream: "contacts",
    maxPages: args.maxPages,
    runKind: "manual",
    testMode: args.testMode,
    testRunKey: args.testRunKey,
    progressEvery: args.progressEvery,
    onProgress: printProgress,
  });

  console.log("Sync de contactos Zeta terminado.");
  console.log(`Run: ${summary.runId}`);
  console.log(`Vistos: ${summary.recordsSeen}`);
  console.log(`Raw records upserted: ${summary.recordsUpserted}`);
  console.log(`Fallidos: ${summary.recordsFailed}`);

  if (summary.warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of summary.warnings.slice(0, 20)) {
      console.log(`- ${warning}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
