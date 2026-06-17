/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  resolveOrganizationDashboardPath,
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

test("private navigation exposes the Convertilabs 2.0 operating menu", () => {
  const navItems = buildOrganizationPrivateNavItems("rontil", "home");

  assert.deepEqual(
    navItems.map((item) => item.label),
    ["Inicio", "Trabajos", "Documentos", "Dinero", "Agenda", "Mas"],
  );
  assert.deepEqual(
    navItems.map((item) => item.href),
    [
      "/app/o/rontil/dashboard",
      "/app/o/rontil/work",
      "/app/o/rontil/documents",
      "/app/o/rontil/open-items",
      "/app/o/rontil/agenda",
      "/app/o/rontil/advanced",
    ],
  );
  assert.equal(navItems[0].current, true);
  assert.equal(navItems.find((item) => item.label === "Agenda").mobilePrimary, false);
});

test("public and workspace navigation mirror the operational primary sections", () => {
  assert.deepEqual(marketingNav.map((item) => item.label), ["Contacto"]);
  assert.deepEqual(
    workspaceNav.map((item) => item.label),
    ["Inicio", "Trabajos", "Documentos", "Dinero", "Agenda", "Mas"],
  );
});
