/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("PR-13 hardening docs classify legacy routes and define pilot checklist", () => {
  const doc = read("docs/pr-13-hardening-piloto-interno.md");

  assert.match(doc, /Rutas legacy/);
  assert.match(doc, /Inicio 2\.0/);
  assert.match(doc, /Trabajo Nueva Palmira/);
  assert.match(doc, /IVA\/cierre visible fuera de `\/tax`/);
  assert.match(doc, /Pago a proveedores/);
  assert.match(doc, /npm run db:smoke:document-upload/);
});

test("PR-13 pilot findings document has every required section", () => {
  const doc = read("docs/piloto-interno-rontil-hallazgos.md");

  for (const section of [
    "Que funciono",
    "Que confundio",
    "Que falto",
    "Que sobro",
    "Que datos se repitieron",
    "Que se cargo dos veces",
    "Que no aparecio en Inicio",
    "Que dependio de memoria humana",
    "Que debe automatizarse",
    "Que debe quedar manual",
  ]) {
    assert.match(doc, new RegExp(section));
  }
});

test("PR-13 visible app copy no longer uses old beta/document-tray labels", () => {
  const visibleSources = [
    "components/marketing-footer.tsx",
    "app/(marketing)/contact/page.tsx",
    "components/documents/document-operational-tray.tsx",
    "components/documents/document-review-rule-workspace.tsx",
  ].map(read).join("\n");

  assert.doesNotMatch(visibleSources, /beta privada/i);
  assert.doesNotMatch(visibleSources, /Bandeja Documental/i);
  assert.match(visibleSources, /Documentos operativos/);
});
