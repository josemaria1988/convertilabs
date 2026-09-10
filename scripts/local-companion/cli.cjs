#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { parseArgs } = require("node:util");
const { setTimeout: delay } = require("node:timers/promises");

const root = path.resolve(__dirname, "../..");
const stateDirectory = path.join(root, ".local-companion");
const configPath = path.join(stateDirectory, "config.json");
const statePath = path.join(stateDirectory, "supervisor.json");
const stopPath = path.join(stateDirectory, "stop-request.json");
const workerPollIntervalMs = 4 * 60 * 60 * 1000;
const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

function parseCommand(argv) {
  const parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
    help: { type: "boolean", short: "h" }, slug: { type: "string" }, actor: { type: "string" },
    file: { type: "string" }, document: { type: "string" }, out: { type: "string" },
    filters: { type: "string" }, from: { type: "string" }, to: { type: "string" },
    article: { type: "string" }, "price-base": { type: "string" }, "max-pages": { type: "string" },
    "price-list": { type: "string" }, currency: { type: "string" },
    "app-url": { type: "string" }, port: { type: "string" }, once: { type: "boolean" },
    cloud: { type: "boolean" }, "with-worker": { type: "boolean" },
    "dry-run": { type: "boolean" }, "sync-config": { type: "string" },
    now: { type: "boolean" }, reason: { type: "string" },
  } });
  if (!parsed.values.help && (parsed.values.now !== undefined || parsed.values.reason !== undefined)) {
    if (parsed.positionals[0] !== "sync-zeta") throw new Error("--now y --reason sólo se admiten para sync-zeta.");
    manualSyncAuthorization(parsed.values);
  }
  if (parsed.positionals[0] === "report" && !parsed.values.help) {
    if (parsed.positionals.length !== 2) throw new Error("Indicá exactamente un tipo de reporte después de report.");
    const allowed = ["slug", "actor", "out", "filters", "from", "to", "article", "price-base", "price-list", "currency", "max-pages", "app-url"];
    for (const key of Object.keys(parsed.values)) if (!allowed.includes(key)) throw new Error(`Opción no permitida para report: --${key}.`);
  }
  return parsed;
}

function help() {
  process.stdout.write(`Convertilabs Local — piloto privado, sin envío automático a Zeta\n
  npm run local -- doctor [--cloud]
  npm run local -- configure --slug <organizacion> --actor <UUID-del-usuario>
  npm run local -- ingest --file "C:\\Facturas\\factura.jpg"
  npm run local -- status --document <UUID>
  npm run local -- worker [--once]
  npm run local -- sync-zeta [--dry-run] [--sync-config "configuracion.json"]
  npm run local -- sync-zeta --now --reason "Solicitud explícita del usuario para adelantar la corrida de hoy"
  npm run local -- cache-status
  npm run local -- report sales --from YYYY-MM-DD --to YYYY-MM-DD --out "ventas.json"
  npm run local -- report purchases --from YYYY-MM-DD --to YYYY-MM-DD --out "compras.json"
  npm run local -- report articles --out "articulos.json"
  npm run local -- report stock --out "stock.json"
  npm run local -- report base-prices --article "00001" --price-base "1" --out "precios.json"
  npm run local -- report base-prices --price-base "LP" --out "precios-base.json"
  npm run local -- report sales-prices --price-list 1 --article "00001" --currency 1 --out "precios-venta.json"
  npm run local -- report stock --filters "filtros.json" --out "stock.csv"
  npm run local -- serve [--with-worker] [--port 4318]
  npm run local -- stop

--slug y --actor pueden darse por comando o guardarse con configure.
Los reportes se leen únicamente de Supabase; --filters es un archivo JSON con filtros del contrato.
sync-zeta actualiza esa copia una vez al día desde las 18:00 de Uruguay, con presupuesto de solicitudes.
--dry-run muestra el plan sin consultar Zeta ni escribir en Supabase. No existe --force.
--now requiere --reason y autorización humana explícita; adelanta la única corrida de hoy, sin repetirla a las 18:00.
JSON conserva tipos originales. CSV guarda también un .metadata.json de trazabilidad.
ingest guarda en Supabase y encola Codex local. status devuelve el enlace para revisión.
El programa local deshabilita la API paga aun si existe OPENAI_API_KEY.
`);
}

async function readJSON(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

function validateSyncConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("La configuración diaria debe ser un objeto JSON.");
  const allowed = ["maxRequests", "minIntervalMs", "maxPages", "pricePairs", "salesPriceLists"];
  if (Object.keys(config).some((key) => !allowed.includes(key))) throw new Error(`Configuración diaria: sólo se admiten ${allowed.join(", ")}.`);
  const limits = { maxRequests: [1, 1000, 100], minIntervalMs: [1000, 60000, 2000], maxPages: [1, 200, 100] };
  const result = { ...config };
  for (const [key, [min, max, fallback]] of Object.entries(limits)) {
    const value = config[key] ?? fallback;
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${key} debe ser un entero entre ${min} y ${max}.`);
    result[key] = value;
  }
  const code = (value) => typeof value === "string" && value.length > 0 && value.length <= 150 && value === value.trim() && !/[\u0000-\u001f]/.test(value);
  result.pricePairs = config.pricePairs ?? [];
  if (!Array.isArray(result.pricePairs) || result.pricePairs.length > 50 || result.pricePairs.some((pair) => !pair
    || Object.keys(pair).some((key) => !["articleCode", "priceBaseCode"].includes(key)) || !code(pair.articleCode) || !code(pair.priceBaseCode))) {
    throw new Error("pricePairs admite hasta 50 pares articleCode/priceBaseCode con códigos exactos en texto.");
  }
  result.salesPriceLists = config.salesPriceLists ?? [];
  if (!Array.isArray(result.salesPriceLists) || result.salesPriceLists.length > 20
    || result.salesPriceLists.some((value) => !Number.isSafeInteger(value) || value < 1)
    || new Set(result.salesPriceLists).size !== result.salesPriceLists.length) {
    throw new Error("salesPriceLists admite hasta 20 códigos de lista enteros positivos, sin repetidos.");
  }
  return result;
}

function reportFilters(values, fileFilters = {}) {
  if (!fileFilters || typeof fileFilters !== "object" || Array.isArray(fileFilters)) throw new Error("filters debe ser un objeto JSON.");
  const filters = { ...fileFilters };
  for (const [option, key] of [["from", "FechaDesde"], ["to", "FechaHasta"], ["article", "ArticuloCodigo"], ["price-base", "PrecioBaseCodigo"]]) {
    if (values[option] !== undefined) filters[key] = values[option];
  }
  for (const [option, key] of [["price-list", "PrecioVentaCodigo"], ["currency", "MonedaCodigo"]]) {
    if (values[option] === undefined) continue;
    const value = values[option];
    if (!/^[0-9]+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error(`--${option} debe ser un entero positivo.`);
    filters[key] = Number(value);
  }
  return filters;
}

function manualSyncAuthorization(values) {
  if (values.now === undefined && values.reason === undefined) return undefined;
  const reason = values.reason;
  if (values.now !== true || typeof reason !== "string" || reason !== reason.trim()
    || reason.length < 12 || reason.length > 500 || /[\u0000-\u001f]/.test(reason)) {
    throw new Error("Adelantar la corrida requiere --now y --reason con la autorización humana explícita (12 a 500 caracteres, sin controles ni espacios extremos).");
  }
  return { reason };
}

async function syncZeta(values, who) {
  const file = values["sync-config"] ? path.resolve(values["sync-config"]) : path.join(stateDirectory, "zeta-daily.json");
  const config = validateSyncConfig(await readJSON(file, values["sync-config"] ? null : {}));
  const manualAuthorization = manualSyncAuthorization(values);
  if (values["dry-run"]) {
    return print({ status: "dry_run", organization: who.slug, apiRequests: 0, databaseWrites: 0,
      schedule: { time: "18:00", timeZone: "America/Montevideo", maxAttemptsPerDay: 1 },
      ...(manualAuthorization ? { manualAuthorization, execution: "advance_today_once", repeatsAtScheduledTime: false } : {}),
      reports: ["sales", "purchases", "articles", "stock", ...(config.pricePairs.length || config.salesPriceLists.length ? ["base-prices"] : []), ...(config.salesPriceLists.length ? ["sales-prices"] : [])], masters: true,
      salesWindow: "Desde el último día sincronizado; primera ejecución desde hoy",
      purchasesWindow: "Mes actual completo, con historial acumulado por identificador", ...config,
      pricesCoverage: { mode: config.salesPriceLists.length ? "configured_sales_lists" : "explicit_pairs", salesPriceLists: config.salesPriceLists,
        allArticlesCovered: false, pendingSynchronization: true, pricingScope: "generic_list_without_customer_conditions" },
      message: "Los límites son internos, no la cuota oficial de Zeta. Las listas seleccionadas requieren sus reglas y las bases completas correspondientes, dentro del mismo presupuesto diario. Este plan no confirma precios actuales ni cobertura publicada; ausencia confirmada y falta de cobertura son estados diferentes." });
  }
  const { resolveLocalCompanionContext } = require("@/modules/local-companion/context");
  const context = await resolveLocalCompanionContext({ ...who, requireWrite: true });
  const { runDailyZetaSync } = require("@/modules/integrations/zeta/sync/daily-sync");
  return print(await runDailyZetaSync({ ...config, ...(manualAuthorization ? { manualAuthorization } : {}), supabase: context.supabase,
    organizationId: context.organization.id, actorProfileId: who.actorProfileId }));
}

async function identity(values) {
  const config = await readJSON(configPath, {});
  const slug = values.slug || process.env.CONVERTILABS_ORGANIZATION_SLUG || config.slug;
  const actorProfileId = values.actor || process.env.CONVERTILABS_ACTOR_PROFILE_ID || config.actorProfileId;
  if (!slug || !actorProfileId) throw new Error("Configurá organización y usuario con local configure --slug <slug> --actor <UUID>. No se elige una empresa automáticamente.");
  return { slug, actorProfileId, appUrl: values["app-url"] || config.appUrl || "http://127.0.0.1:4318" };
}

async function writeNew(file, text) {
  const destination = path.resolve(file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, text, { flag: "wx", mode: 0o600 });
  return destination;
}

async function doctor(values) {
  const { doctorCodexProvider } = require("@/modules/local-companion/codex-provider");
  const { getSupabaseConfigStatus } = require("@/lib/env");
  const { isPaidAIAllowed } = require("@/lib/llm/provider-policy");
  const report = { node: process.version, platform: process.platform,
    processingProvider: process.env.CONVERTILABS_PROCESSING_PROVIDER, paidAPIEnabled: isPaidAIAllowed(),
    supabase: getSupabaseConfigStatus(), codex: await doctorCodexProvider() };
  if (values.cloud) {
    const { resolveLocalCompanionContext } = require("@/modules/local-companion/context");
    const context = await resolveLocalCompanionContext(await identity(values));
    const { error } = await context.supabase.from("document_processing_runs")
      .select("id, lease_token, lease_expires_at").eq("organization_id", context.organization.id).limit(1);
    report.cloud = { organization: context.organization, role: context.role,
      localQueueSchemaAvailable: !error,
      message: error ? "Falta verificar/aplicar la migración del worker local en este Supabase." : "Lectura de cola local disponible; no se modificaron datos." };
    try {
      const { buildZetaConnection } = require("@/modules/integrations/zeta/client/auth");
      const runtime = await buildZetaConnection({ supabase: context.supabase, organizationId: context.organization.id });
      report.zeta = { credentialsReadable: true, credentialSource: runtime.metadata.credentialSource,
        apiTested: false, message: "Configuración legible; este diagnóstico no consulta ni escribe en Zeta." };
    } catch {
      report.zeta = { credentialsReadable: false, apiTested: false,
        message: "La configuración local no permite abrir la conexión Zeta guardada. Revisá su clave de cifrado y Ajustes / Integraciones." };
    }
  }
  print(report);
  return report;
}

function waitForStop(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
}

async function worker(values, signal, dependencies = {}) {
  const resolveLocalCompanionContext = dependencies.context || require("@/modules/local-companion/context").resolveLocalCompanionContext;
  const processNextLocalDocument = dependencies.processNext || require("@/modules/documents/processing").processNextLocalDocument;
  const doctorCodexProvider = dependencies.doctor || require("@/modules/local-companion/codex-provider").doctorCodexProvider;
  const report = dependencies.report || print;
  const who = await identity(values);
  const readiness = await doctorCodexProvider();
  if (!readiness.ready) throw new Error("Codex no está listo. Ejecutá local doctor y resolvé los checks antes de procesar facturas.");
  const initial = await resolveLocalCompanionContext({ ...who, requireWrite: true });
  const schema = await initial.supabase.from("document_processing_runs").select("id, lease_token")
    .eq("organization_id", initial.organization.id).limit(1);
  if (schema.error) throw new Error("El worker requiere la migración de cola local en Supabase. No se tomó ninguna factura.");
  const workerId = `${os.hostname().slice(0, 32)}:${process.pid}:${randomUUID()}`;
  let errors = 0;
  while (!signal.aborted) {
    try {
      // Recheck membership on each iteration so revoked access stops the pilot.
      const context = await resolveLocalCompanionContext({ ...who, requireWrite: true });
      const result = await processNextLocalDocument({ organizationId: context.organization.id, workerId, signal });
      errors = 0;
      if (result.claimed || values.once) report({ at: new Date().toISOString(), ...result });
      if (values.once) return result;
      if (["authentication", "quota", "configuration", "codex_missing", "process_unavailable", "unsupported_version", "pdf_renderer_missing"].includes(result.code)) {
        report({ at: new Date().toISOString(), status: "paused", code: result.code,
          message: "El trabajador se pausó para conservar las demás facturas pendientes. Resolvé el diagnóstico y reiniciá Convertilabs Local." });
        await waitForStop(signal);
        return result;
      }
    } catch (error) {
      if (signal.aborted) break;
      if (values.once) throw error;
      errors++;
      // No raw provider payload or credentials in service logs.
      report({ at: new Date().toISOString(), status: "paused", consecutiveErrors: errors,
        message: error.code === "quota" || error.code === "authentication" ? error.message
          : "Worker en espera: ejecutá local doctor --cloud para revisar sesión, conexión y migración." });
    }
    if (signal.aborted) break;
    report({ at: new Date().toISOString(), status: "waiting", pollIntervalSeconds: workerPollIntervalMs / 1000,
      nextCheckAt: new Date(Date.now() + workerPollIntervalMs).toISOString() });
    await delay(workerPollIntervalMs, null, { signal }).catch(() => {});
  }
}

async function stop() {
  const state = await readJSON(statePath, null);
  if (!state) return print({ status: "stopped", message: "No hay una instancia local administrada." });
  await fs.writeFile(stopPath, JSON.stringify({ instance: state.instance }), { mode: 0o600 });
  print({ status: "stop_requested", message: "Se solicitó detener el worker y la aplicación local. La factura en curso queda recuperable." });
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    const executable = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
    await new Promise((resolve) => {
      const terminator = spawn(executable, ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      terminator.once("exit", resolve); terminator.once("error", resolve);
    });
  } else child.kill("SIGTERM");
}

async function serve(values, controller) {
  const port = Number(values.port || 4318);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("Puerto inválido (1024–65535).");
  if (values["with-worker"]) await identity(values);
  await fs.mkdir(stateDirectory, { recursive: true });
  const old = await readJSON(statePath, null);
  if (old) {
    let alive = true;
    try { process.kill(old.pid, 0); } catch (error) { if (error.code === "ESRCH") alive = false; }
    if (alive) throw new Error("Ya hay una instancia local. Usá local stop antes de reiniciarla.");
    await fs.unlink(statePath);
  }
  const instance = randomUUID();
  await fs.writeFile(statePath, JSON.stringify({ pid: process.pid, instance, startedAt: new Date().toISOString(), port }), { flag: "wx", mode: 0o600 });
  const next = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, windowsHide: true, stdio: "inherit", env: { ...process.env, CONVERTILABS_LOCAL_APP: "1",
      APP_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}` },
  });
  next.once("error", () => controller.abort());
  next.once("exit", () => controller.abort());
  const watcher = setInterval(async () => {
    const request = await readJSON(stopPath, null).catch(() => null);
    if (request?.instance === instance) controller.abort();
  }, 1000);
  print({ status: "starting", url: `http://127.0.0.1:${port}`, worker: Boolean(values["with-worker"]), paidAPIEnabled: false });
  try {
    if (values["with-worker"]) {
      await worker(values, controller.signal).catch((error) => {
        print({ status: "worker_paused", message: error.message });
      });
    }
    await waitForStop(controller.signal);
  } finally {
    clearInterval(watcher);
    controller.abort();
    await terminateChild(next);
    await fs.unlink(statePath).catch(() => {});
    await fs.unlink(stopPath).catch(() => {});
  }
}

async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseCommand(argv);
  const command = positionals[0];
  if (values.help || !command) return help();
  process.chdir(root);
  const { loadProjectEnv } = await import("../supabase/env.mjs");
  loadProjectEnv();
  // This executable is always the subscription-based companion. The cloud API provider stays explicit.
  process.env.CONVERTILABS_PROCESSING_PROVIDER = "codex_local";
  process.env.CONVERTILABS_DISABLE_PAID_AI = "true";
  require("../runtime/register-ts.cjs");
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  try {
    if (command === "doctor") return await doctor(values);
    if (command === "stop") return await stop();
    if (command === "serve") return await serve(values, controller);
    if (command === "worker") {
      const result = await worker(values, controller.signal);
      if (values.once && result?.status === "error") process.exitCode = 1;
      return result;
    }
    const who = await identity(values);
    if (command === "sync-zeta") return await syncZeta(values, who);
    if (command === "cache-status") {
      const { resolveLocalCompanionContext } = require("@/modules/local-companion/context");
      const { loadZetaCacheStatus } = require("@/modules/integrations/zeta/cache/report-cache");
      const context = await resolveLocalCompanionContext(who);
      return print(await loadZetaCacheStatus({ supabase: context.supabase, organizationId: context.organization.id }));
    }
    if (command === "configure") {
      const { resolveLocalCompanionContext, localDocumentReviewUrl } = require("@/modules/local-companion/context");
      const context = await resolveLocalCompanionContext({ ...who, requireWrite: true });
      localDocumentReviewUrl(who.slug, "00000000-0000-0000-0000-000000000000", who.appUrl);
      await fs.mkdir(stateDirectory, { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(who, null, 2), { mode: 0o600 });
      return print({ configured: true, organization: context.organization, role: context.role, configPath });
    }
    if (command === "ingest") {
      if (!values.file) throw new Error("Indicá --file con la foto o PDF.");
      const { ingestLocalDocument } = require("@/modules/local-companion/documents");
      return print(await ingestLocalDocument({ ...who, filePath: path.resolve(values.file) }));
    }
    if (command === "status") {
      if (!values.document) throw new Error("Indicá --document con el UUID del documento.");
      const { loadLocalDocumentStatus } = require("@/modules/local-companion/documents");
      return print(await loadLocalDocumentStatus({ ...who, documentId: values.document }));
    }
    if (command === "report") {
      if (!values.out || ![".json", ".csv"].includes(path.extname(values.out).toLowerCase())) throw new Error("Indicá --out con un archivo nuevo .json o .csv.");
      const destination = path.resolve(values.out);
      // Fail before reading the shared snapshot if an output already exists.
      if (await fs.stat(destination).then(() => true, () => false)) throw new Error("El archivo de salida ya existe; usá otro nombre.");
      const { exportZetaReport, serializeZetaReportCsv } = require("@/modules/local-companion/zeta-reports");
      const filters = reportFilters(values, values.filters ? await readJSON(path.resolve(values.filters), null) : {});
      const report = await exportZetaReport({ ...who, report: positionals[1], filters,
        maxPages: values["max-pages"] ? Number(values["max-pages"]) : undefined });
      const csv = path.extname(destination).toLowerCase() === ".csv";
      const output = await writeNew(destination, csv ? serializeZetaReportCsv(report) : JSON.stringify(report, null, 2));
      if (csv) await writeNew(`${destination}.metadata.json`, JSON.stringify(report.metadata, null, 2));
      return print({ output, ...report.metadata });
    }
    throw new Error(`Comando desconocido: ${command}. Usá local --help.`);
  } finally {
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "No se pudo completar el comando local."}\n`);
  process.exitCode = 1;
});

module.exports = { parseCommand, main, worker, validateSyncConfig, reportFilters, manualSyncAuthorization };
