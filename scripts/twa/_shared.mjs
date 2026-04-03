import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bubblewrapVersion = "1.24.1";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(scriptDir, "../..");
export const twaDir = path.join(rootDir, "android-twa");
export const twaManifestPath = path.join(twaDir, "twa-manifest.json");

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

function parseOptionalInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function splitFingerprints(value) {
  return (value ?? "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function hasInitializedProject() {
  return fs.existsSync(path.join(twaDir, "gradlew"))
    || fs.existsSync(path.join(twaDir, "app"));
}

export function syncManifestFromEnv() {
  const manifest = readJson(twaManifestPath);
  const normalizedProductionUrl = normalizeUrl(firstDefined(
    process.env.TWA_PRODUCTION_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    manifest.webManifestUrl ? new URL(manifest.webManifestUrl).origin : undefined,
    "https://convertilabs.com",
  ));
  const packageId = firstDefined(
    process.env.TWA_ANDROID_PACKAGE_NAME,
    manifest.packageId,
    "com.convertilabs.campo",
  );
  const startUrl = firstDefined(process.env.TWA_START_URL, manifest.startUrl, "/mobile");
  const keystorePath = firstDefined(
    process.env.TWA_KEYSTORE_PATH,
    manifest.signingKey?.path,
    "./android-keystore.jks",
  );
  const keyAlias = firstDefined(
    process.env.TWA_KEY_ALIAS,
    manifest.signingKey?.alias,
    "convertilabs",
  );
  const appVersion = firstDefined(process.env.TWA_APP_VERSION, manifest.appVersion, "1.0.0");
  const appVersionCode = parseOptionalInteger(
    process.env.TWA_APP_VERSION_CODE,
    parseOptionalInteger(String(manifest.appVersionCode ?? "1"), 1),
  );
  const host = new URL(normalizedProductionUrl).host;

  manifest.generatorApp = manifest.generatorApp ?? "bubblewrap-cli";
  manifest.name = firstDefined(process.env.TWA_APP_NAME, manifest.name, "Convertilabs Campo");
  manifest.launcherName = firstDefined(
    process.env.TWA_LAUNCHER_NAME,
    manifest.launcherName,
    "Convertilabs Campo",
  );
  manifest.shortName = firstDefined(
    process.env.TWA_SHORT_NAME,
    manifest.shortName,
    "Convertilabs",
  );
  manifest.packageId = packageId;
  manifest.applicationId = packageId;
  manifest.host = host;
  manifest.startUrl = startUrl;
  manifest.webManifestUrl = new URL("/manifest.webmanifest", normalizedProductionUrl).toString();
  manifest.iconUrl = new URL("/pwa/icon-512.png", normalizedProductionUrl).toString();
  manifest.maskableIconUrl = new URL("/pwa/maskable-icon-512.png", normalizedProductionUrl).toString();
  manifest.appVersion = appVersion;
  manifest.appVersionCode = appVersionCode;
  manifest.signingKey = {
    path: keystorePath,
    alias: keyAlias,
  };
  manifest.fingerprints = splitFingerprints(
    firstDefined(
      process.env.TWA_SHA256_FINGERPRINTS,
      Array.isArray(manifest.fingerprints) ? manifest.fingerprints.join(",") : undefined,
      "",
    ),
  );

  fs.writeFileSync(twaManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return manifest;
}

export function ensureInitialized() {
  if (!hasInitializedProject()) {
    throw new Error(
      "El wrapper todavia no fue inicializado. Corre `npm run twa:init` antes de build/install/update.",
    );
  }
}

export function runBubblewrap(args, options = {}) {
  const result = spawnSync(
    "npx",
    [`@bubblewrap/cli@${bubblewrapVersion}`, ...args],
    {
      cwd: options.cwd ?? twaDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}
