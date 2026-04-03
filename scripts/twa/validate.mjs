import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { splitFingerprints, syncManifestFromEnv, twaDir, twaManifestPath } from "./_shared.mjs";

const manifest = syncManifestFromEnv();
const errors = [];
const warnings = [];

if (!fs.existsSync(twaManifestPath)) {
  errors.push("Falta android-twa/twa-manifest.json.");
}

if (!manifest.packageId) {
  errors.push("packageId no puede quedar vacio.");
}

if (!manifest.host) {
  errors.push("host no puede quedar vacio.");
}

if (!manifest.startUrl || !manifest.startUrl.startsWith("/")) {
  errors.push("startUrl debe empezar con '/'.");
}

if (!manifest.webManifestUrl || !/^https?:\/\//.test(manifest.webManifestUrl)) {
  errors.push("webManifestUrl debe ser una URL absoluta.");
}

if (!fs.existsSync(path.join(process.cwd(), "public", "pwa", "icon-512.png"))) {
  errors.push("Falta public/pwa/icon-512.png.");
}

if (!fs.existsSync(path.join(process.cwd(), "public", "pwa", "maskable-icon-512.png"))) {
  errors.push("Falta public/pwa/maskable-icon-512.png.");
}

if (!manifest.signingKey?.path) {
  warnings.push("No hay path de keystore configurado en twa-manifest.json.");
}

if (!manifest.signingKey?.alias) {
  warnings.push("No hay alias de keystore configurado en twa-manifest.json.");
}

if (splitFingerprints(process.env.TWA_SHA256_FINGERPRINTS).length === 0 && manifest.fingerprints.length === 0) {
  warnings.push("No hay fingerprints SHA-256 configurados; la TWA caera a Custom Tab hasta completar asset links.");
}

console.log("TWA manifest:", twaManifestPath);
console.log("TWA dir:", twaDir);
console.log("packageId:", manifest.packageId);
console.log("host:", manifest.host);
console.log("startUrl:", manifest.startUrl);
console.log("webManifestUrl:", manifest.webManifestUrl);

for (const warning of warnings) {
  console.warn(`WARN: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`ERROR: ${error}`);
  }

  process.exit(1);
}

console.log("Validacion TWA completa.");
