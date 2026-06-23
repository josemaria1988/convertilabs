/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
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
      "/app/o/rontil/money",
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

test("treasury aliases redirect to the canonical money route", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const files = [
    path.join(projectRoot, "app", "treasury", "page.tsx"),
    path.join(projectRoot, "app", "tesoreria", "page.tsx"),
    path.join(projectRoot, "app", "app", "o", "[slug]", "treasury", "page.tsx"),
    path.join(projectRoot, "app", "app", "o", "[slug]", "tesoreria", "page.tsx"),
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");

    assert.match(source, /redirect\(/);
    assert.match(source, /\/money/);
  }
});
