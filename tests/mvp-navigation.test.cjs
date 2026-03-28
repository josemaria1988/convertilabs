/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveOrganizationDashboardPath,
  resolveOrganizationDocumentsPath,
  resolvePostAuthDestination,
} = require("@/modules/auth/server-auth");
const { buildOrganizationPrivateNavItems } = require("@/modules/organizations/private-nav");
const { marketingNav, workspaceNav } = require("@/lib/navigation");

test("post auth destination defaults to the dashboard workspace", () => {
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
    resolveOrganizationDashboardPath("rontil"),
  );
  assert.equal(
    resolvePostAuthDestination(authState, "/app/o/rontil/tax"),
    "/app/o/rontil/tax",
  );
});

test("private navigation exposes the guided workspace and advanced entrypoint", () => {
  const navItems = buildOrganizationPrivateNavItems("rontil", "documents");

  assert.deepEqual(
    navItems.map((item) => item.label),
    ["Inicio", "Documentos", "Revision", "Impuestos", "Cierre", "Configuracion", "Avanzado"],
  );
  assert.deepEqual(
    navItems.map((item) => item.href),
    [
      "/app/o/rontil/dashboard",
      "/app/o/rontil/documents",
      "/app/o/rontil/review",
      "/app/o/rontil/tax",
      "/app/o/rontil/close",
      "/app/o/rontil/settings",
      "/app/o/rontil/advanced",
    ],
  );
});

test("public and workspace navigation mirror the guided primary sections", () => {
  assert.deepEqual(marketingNav.map((item) => item.label), ["Contacto"]);
  assert.deepEqual(
    workspaceNav.map((item) => item.label),
    ["Inicio", "Documentos", "Revision", "Impuestos", "Cierre", "Configuracion", "Avanzado"],
  );
});
