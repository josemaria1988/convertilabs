/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const { renderToStaticMarkup } = require("react-dom/server");
const { test, assert } = require("./testkit.cjs");

test("field upload server page renders camera capture with CRLF deployment settings and no paid option", async () => {
  const pagePath = require.resolve("@/app/app/o/[slug]/field/upload/page");
  const sheetPath = require.resolve("@/components/mobile/field-upload-sheet");
  const previousModules = new Map([pagePath, sheetPath].map((path) => [path, require.cache[path]]));
  const previousLoad = Module._load;
  const previousFetch = global.fetch;
  const envKeys = ["CONVERTILABS_PROCESSING_PROVIDER", "CONVERTILABS_DISABLE_PAID_AI"];
  const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  let authorizationChecks = 0;
  const unusedAction = async () => assert.fail("Rendering must not perform upload actions");
  Module._load = function patchedLoad(name, parent, isMain) {
    if (name === "next/navigation") return { useRouter: () => ({}) };
    if (name === "@/components/mobile/field-activity-list") return { FieldActivityList: () => null };
    if (name === "@/modules/auth/server-auth") return {
      async requireOrganizationDashboardPage(slug) {
        authorizationChecks++;
        assert.equal(slug, "test-org");
        return { organization: { id: "org-1", slug } };
      },
    };
    if (parent?.filename === pagePath && name === "../actions") return {
      assignFieldDocumentToWorkUnitAction: unusedAction,
      enqueueFieldDocumentExtractionsAction: unusedAction,
      failFieldDocumentUploadAction: unusedAction,
      finalizeFieldDocumentUploadAction: unusedAction,
      prepareFieldDocumentUploadAction: unusedAction,
    };
    if (parent?.filename === pagePath && name === "../data") return {
      readOptionalSearchParam: (value) => Array.isArray(value) ? value[0] : value,
      async loadFieldWorkspaceData({ organizationId }) {
        assert.equal(authorizationChecks, 1);
        assert.equal(organizationId, "org-1");
        return { filteredDocuments: [], costCenters: [], workUnits: [], activeCostCenterId: null,
          costCenterNameById: new Map(), workUnitNameById: new Map() };
      },
    };
    return previousLoad.call(this, name, parent, isMain);
  };
  global.fetch = async () => assert.fail("Rendering fixture must not access network");
  process.env.CONVERTILABS_PROCESSING_PROVIDER = "codex_local\r\n";
  process.env.CONVERTILABS_DISABLE_PAID_AI = "true\r\n";
  try {
    for (const path of previousModules.keys()) delete require.cache[path];
    const page = await require(pagePath).default({ params: Promise.resolve({ slug: "test-org" }) });
    const { FieldUploadSheet } = require(sheetPath);
    const upload = page.props.children.find((child) => child?.type === FieldUploadSheet);
    assert.equal(authorizationChecks, 1);
    assert.equal(upload.props.defaultProcessingProvider, "codex_local");
    assert.equal(upload.props.allowPaidAPI, false);
    const html = renderToStaticMarkup(upload);
    assert.match(html, /Sacar foto de factura/);
    assert.match(html, /capture="environment"/);
    assert.match(html, /value="codex_local" selected=""/);
    assert.doesNotMatch(html, /value="openai"/);
  } finally {
    Module._load = previousLoad;
    global.fetch = previousFetch;
    for (const [path, previous] of previousModules) {
      delete require.cache[path];
      if (previous) require.cache[path] = previous;
    }
    for (const [key, previous] of Object.entries(previousEnv)) {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  }
});
