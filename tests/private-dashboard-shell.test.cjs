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
            ],
          },
          React.createElement("div", null, "Contenido"),
        ),
      );

      assert.match(html, /href="\/app\/o\/rontil\/documents"/);
      assert.match(html, /data-current="true"/);
      assert.match(html, /aria-current="page"/);
    },
  );
});
