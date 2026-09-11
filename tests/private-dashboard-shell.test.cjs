/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { test, assert } = require("./testkit.cjs");

function withModuleMocks(mocks, fn) {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return fn();
  } finally {
    Module._load = originalLoad;
  }
}

test("current private navigation items stay clickable", () => {
  withModuleMocks(
    {
      "next/link": {
        __esModule: true,
        default: function LinkStub({ href, children, ...props }) {
          const resolvedHref = typeof href === "string" ? href : (href?.pathname ?? "");
          return React.createElement("a", { href: resolvedHref, ...props }, children);
        },
      },
      "next/navigation": {
        usePathname() {
          return "/app/o/rontil/documents/doc-1";
        },
        useSearchParams() {
          return new URLSearchParams();
        },
      },
      "@/components/convertilabs-logo": {
        ConvertilabsLogo() {
          return React.createElement("span", null, "Convertilabs");
        },
      },
      "@/components/dashboard/account-menu": {
        AccountMenu() {
          return React.createElement("div", null, "Cuenta");
        },
      },
      "@/components/documents/document-spreadsheet-import-notifier": {
        DocumentSpreadsheetImportNotifier() {
          return null;
        },
      },
      "@/components/ui/inline-spinner": {
        InlineSpinner() {
          return React.createElement("span", null, "Cargando");
        },
      },
    },
    () => {
      const { PrivateDashboardShell } = require("@/components/dashboard/private-dashboard-shell");
      const html = renderToStaticMarkup(
        React.createElement(
          PrivateDashboardShell,
          {
            organizationName: "Rontil",
            organizationSlug: "rontil",
            userRole: "owner",
            title: "Revision documental",
            description: "Contexto",
            navItems: [
              {
                href: "/app/o/rontil/documents",
                label: "Documentos",
                description: "Bandeja",
                current: true,
              },
              { href: "/app/o/rontil/dashboard", label: "Inicio", icon: "home", description: "Inicio" },
              { href: "/app/o/rontil/work", label: "Trabajos", icon: "work", description: "Trabajos" },
              { href: "/app/o/rontil/money", label: "Dinero", icon: "money", description: "Dinero" },
              { href: "/app/o/rontil/agenda", label: "Agenda", icon: "agenda", description: "Agenda", mobilePrimary: false },
              { href: "/app/o/rontil/advanced", label: "Mas", icon: "more", description: "Otras herramientas" },
            ],
          },
          React.createElement("div", null, "Contenido"),
        ),
      );

      assert.match(html, /href="\/app\/o\/rontil\/documents"/);
      assert.match(html, /data-current="true"/);
      assert.match(html, /aria-current="page"/);
      assert.match(html, /<main id="workspace-content" tabindex="-1"/);
      assert.match(html, /href="#workspace-content"/);
      assert.match(html, /aria-label="Abrir navegación"/);
      assert.match(html, /<dialog[^>]+aria-label="Navegación principal"/);
      const drawer = html.match(/<dialog[\s\S]*?<\/dialog>/)?.[0];
      assert.ok(drawer, "Mobile navigation must use the accessible modal drawer");
      for (const path of ["dashboard", "work", "documents", "money", "agenda", "advanced"]) {
        assert.ok(drawer.includes(`href="/app/o/rontil/${path}"`), `The mobile drawer must retain ${path}`);
      }
      assert.ok(!drawer.includes('/app/o/rontil/audit'), "Navigation must not invent routes absent from the permission-filtered items");
      assert.match(drawer, />Más<\/span>/);
      assert.match(drawer, /action="\/logout" method="post"/);
      assert.doesNotMatch(html, /app-mobile-header__card|app-mobile-nav__item|>Soporte<|>Ayuda</);
    },
  );
});
