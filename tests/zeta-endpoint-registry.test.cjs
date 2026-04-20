/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function walkPostmanItems(items, currentPath = [], output = []) {
  for (const item of items || []) {
    const nextPath = [...currentPath, item.name];

    if (item.item) {
      walkPostmanItems(item.item, nextPath, output);
    } else {
      output.push({
        path: nextPath,
        request: item.request,
      });
    }
  }

  return output;
}

function loadPostmanEndpoints() {
  const collectionPath = path.join(__dirname, "..", "docs", "Api ZetaSoftware collection.json");
  const collection = JSON.parse(fs.readFileSync(collectionPath, "utf8"));

  return walkPostmanItems(collection.item);
}

function postmanRequestUrl(request) {
  if (typeof request?.url === "string") {
    return request.url;
  }

  return request?.url?.raw || "";
}

test("Zeta endpoint registry maps only endpoints present in the Postman collection", () => {
  const {
    listZetaEndpoints,
  } = require("@/modules/integrations/zeta/client/endpoint-registry");
  const postmanEndpoints = loadPostmanEndpoints();

  for (const endpoint of listZetaEndpoints()) {
    const match = postmanEndpoints.find((entry) => {
      const url = postmanRequestUrl(entry.request);

      return entry.path.includes(endpoint.endpointName)
        || url.endsWith(`/APIs/${endpoint.endpointName}`);
    });

    assert.ok(match, `${endpoint.endpointName} should exist in the official collection`);
    assert.equal(match.request.method, "POST", `${endpoint.endpointName} should be POST`);
    assert.equal(
      postmanRequestUrl(match.request),
      `{{baseUrl}}/APIs/${endpoint.endpointName}`,
      `${endpoint.endpointName} should keep the official URL`,
    );
  }
});

test("Zeta endpoint registry includes the PR-01 required domains", () => {
  const {
    zetaEndpointRegistry,
  } = require("@/modules/integrations/zeta/client/endpoint-registry");

  assert.equal(zetaEndpointRegistry.userRolesQuery.endpointName, "RESTUsuariosEmpresaV1Query");
  assert.equal(zetaEndpointRegistry.contactsQuery.endpointName, "RESTContactosV3Query");
  assert.equal(zetaEndpointRegistry.salesInvoicesQuery.endpointName, "RESTFacturaClienteV4QueryVentas");
  assert.equal(zetaEndpointRegistry.salesInvoiceDetail.endpointName, "RESTFacturaClienteV4VentaDetallada");
  assert.equal(zetaEndpointRegistry.salesInvoicesDetailedDaily.endpointName, "RESTFacturaClienteV4VentasDetalladas");
  assert.equal(zetaEndpointRegistry.salesInvoicePdfUrl.endpointName, "RESTFacturaClienteV4URLPDF");
  assert.equal(zetaEndpointRegistry.customerDocumentsQuery.endpointName, "RESTComprobantesClienteV1Query");
  assert.equal(zetaEndpointRegistry.receivedCfesQuery.endpointName, "RESTCFEsRecibidosV1CFEsRecibidos");
  assert.equal(zetaEndpointRegistry.receivedCfeDetail.endpointName, "RESTCFEsRecibidosV1CFERecibidoDetalle");
  assert.equal(zetaEndpointRegistry.customerCommercialDataQuery.endpointName, "RESTClienteV3Query");
  assert.equal(zetaEndpointRegistry.supplierCommercialDataQuery.endpointName, "RESTProveedorV2Query");
  assert.equal(zetaEndpointRegistry.conceptsQuery.endpointName, "RESTConceptosV1Query");
  assert.equal(zetaEndpointRegistry.chartAccountsQuery.endpointName, "RESTPlanCuentasV2Query");
  assert.equal(zetaEndpointRegistry.journalTypesQuery.endpointName, "RESTTiposAsientosV1Query");
  assert.equal(zetaEndpointRegistry.businessLocationsQuery.endpointName, "RESTLocalesComercialesV1Query");
  assert.equal(zetaEndpointRegistry.referencesQuery.endpointName, "RESTReferenciasV1Query");
  assert.equal(zetaEndpointRegistry.rutNumbersQuery.endpointName, "RESTRUTV1Query");
  assert.equal(zetaEndpointRegistry.currencyRatesQuery.endpointName, "RESTMonedasCotizacionesV1Query");
  assert.equal(zetaEndpointRegistry.bandejaJournalEntrySave.outputWrapper, "SaveOut");
});
