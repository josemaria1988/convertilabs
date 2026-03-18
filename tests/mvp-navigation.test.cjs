/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveOrganizationDocumentsPath,
  resolvePostAuthDestination,
} = require("@/modules/auth/server-auth");
const { buildOrganizationPrivateNavItems } = require("@/modules/organizations/private-nav");
const { marketingNav, workspaceNav } = require("@/lib/navigation");

test("post auth destination defaults to the documents workspace", () => {
  const authState = {
    hasMembership: true,
    primaryOrganization: {
      id: "org-1",
      slug: "rontil",
      name: "Rontil",
      role: "owner",
    },
  };

  assert.equal(
    resolvePostAuthDestination(authState),
    resolveOrganizationDocumentsPath("rontil"),
  );
  assert.equal(
    resolvePostAuthDestination(authState, "/app/o/rontil/tax"),
    "/app/o/rontil/tax",
  );
});

test("private navigation exposes the dedicated chart map route", () => {
  const navItems = buildOrganizationPrivateNavItems("rontil", "documents");

  assert.deepEqual(
    navItems.map((item) => item.label),
    ["Documentos", "Contabilidad", "Impuestos", "Mapa contable", "Configuracion"],
  );
  assert.deepEqual(
    navItems.map((item) => item.href),
    [
      "/app/o/rontil/documents",
      "/app/o/rontil/trial-balance",
      "/app/o/rontil/tax",
      "/app/o/rontil/chart-map",
      "/app/o/rontil/settings",
    ],
  );
});

test("public and workspace navigation include the chart map in private workspace", () => {
  assert.deepEqual(marketingNav.map((item) => item.label), ["Contacto"]);
  assert.deepEqual(
    workspaceNav.map((item) => item.label),
    ["Documentos", "Contabilidad", "Impuestos", "Mapa contable", "Configuracion"],
  );
});
