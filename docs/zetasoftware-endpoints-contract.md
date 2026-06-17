> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# Contrato REST Zetasoftware PR-01

Fuente: `docs/Api ZetaSoftware collection.json`, coleccion Postman oficial descargada de Zetasoftware.  
Revision local: 2026-04-19.  
Conteo observado: 262 endpoints REST.

## Reglas comunes

- Base URL: variable Postman `{{baseUrl}}`, mapeada en Convertilabs como `ZETASOFTWARE_BASE_URL`.
- URL: `{{baseUrl}}/APIs/<EndpointName>`.
- Metodo: `POST`.
- Headers: `Accept: application/json` y `Content-Type: application/json`.
- Autenticacion: cada request envia `Connection` dentro del wrapper oficial.

```json
{
  "Connection": {
    "DesarrolladorCodigo": "...",
    "DesarrolladorClave": "...",
    "EmpresaCodigo": "...",
    "EmpresaClave": "...",
    "UsuarioCodigo": 1,
    "UsuarioClave": "",
    "RolCodigo": 1
  }
}
```

Variables de entorno server-only:

- `ZETASOFTWARE_BASE_URL`
- Si no esta definido, Convertilabs puede derivar la base URL desde `ZETASOFTWARE_API_STOCK`, `ZETASOFTWARE_API_PRECIO` o `ZETASOFTWARE_API_ARTICULOS` quitando el sufijo `/APIs/<EndpointName>`.
- `ZETASOFTWARE_DESARROLLADOR_CODIGO`
- `ZETASOFTWARE_DESARROLLADOR_CLAVE`
- `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY`
- `ZETASOFTWARE_EMPRESA_CODIGO` solo como fallback de desarrollo
- `ZETASOFTWARE_EMPRESA_CLAVE` solo como fallback de desarrollo
- `ZETASOFTWARE_USUARIOCODIGO` solo como fallback de desarrollo
- `ZETASOFTWARE_ROLCODIGO` solo como fallback de desarrollo

Para credenciales por organizacion hay dos modos:

- Produccion recomendada: `credential_source = db_encrypted`. `DesarrolladorCodigo` y `DesarrolladorClave` son credenciales de Convertilabs y viven siempre en variables de entorno. `EmpresaCodigo`, `EmpresaClave`, `UsuarioCodigo` y `RolCodigo` se guardan cifradas en `organization_integration_connections.encrypted_credentials`.
- Fallback de desarrollo: `credential_source = server_env`. El runtime lee primero `ZETASOFTWARE_<PROFILE>_EMPRESA_CODIGO`, `ZETASOFTWARE_<PROFILE>_EMPRESA_CLAVE`, `ZETASOFTWARE_<PROFILE>_USUARIOCODIGO` y `ZETASOFTWARE_<PROFILE>_ROLCODIGO`, y cae a `ZETASOFTWARE_*` si no existe el perfil.
- Seguridad: `EmpresaClave` y `DesarrolladorClave` no se guardan en `config_json`, no se registran en `audit_log` y no se devuelven al cliente. La UI solo muestra un fingerprint corto no reversible cuando hay credenciales configuradas.

## Wrappers

Query generico:

```json
{
  "QueryIn": {
    "Connection": {},
    "Data": {
      "Page": 1,
      "Filters": {}
    }
  }
}
```

Salida query:

```json
{
  "QueryOut": {
    "Succeed": true,
    "Response": [],
    "IsLastPage": true,
    "Error": null
  }
}
```

Load, Save y Delete usan wrappers especificos:

- `LoadIn` -> `LoadOut`
- `SaveIn` -> `SaveOut`
- `DeleteIn` -> `DeleteOut`

CFEs recibidos usa wrappers propios:

- `CFEsRecibidosIn` -> `CFEsRecibidosOut`
- `CFERecibidoDetalleIn` -> `CFERecibidoDetalleOut`

Facturas de Clientes usa wrappers propios:

- `QueryVentasIn` -> `QueryVentasOut`
- `VentaDetalladaIn` -> `VentaDetalladaOut`
- `VentasDetalladasIn` -> `VentasDetalladasOut`
- `URLPDFIn` -> `URLPDFOut`

## Registry Convertilabs

El registry vive en `modules/integrations/zeta/client/endpoint-registry.ts`. Ningun endpoint real se invoca si no existe en la coleccion Postman.

| Key | Endpoint Zeta | Wrapper | Stream |
|---|---|---|---|
| `userRolesQuery` | `RESTUsuariosEmpresaV1Query` | `QueryIn/QueryOut` | `zeta.health.user_roles` |
| `contactsQuery` | `RESTContactosV3Query` | `QueryIn/QueryOut` | `zeta.masters.contacts` |
| `contactLoad` | `RESTContactosV3Load` | `LoadIn/LoadOut` | `zeta.masters.contacts` |
| `customerCommercialDataQuery` | `RESTClienteV3Query` | `QueryIn/QueryOut` | `zeta.masters.customer_commercial_data` |
| `supplierCommercialDataQuery` | `RESTProveedorV2Query` | `QueryIn/QueryOut` | `zeta.masters.supplier_commercial_data` |
| `currenciesQuery` | `RESTMonedasV1Query` | `QueryIn/QueryOut` | `zeta.masters.currencies` |
| `costCentersQuery` | `RESTCentrosCostoV1Query` | `QueryIn/QueryOut` | `zeta.masters.cost_centers` |
| `taxRatesQuery` | `RESTTasasIVAV1Query` | `QueryIn/QueryOut` | `zeta.masters.vat_rates` |
| `currencyRatesQuery` | `RESTMonedasCotizacionesV1Query` | `QueryIn/QueryOut` | `zeta.masters.currency_rates` |
| `chartAccountsQuery` | `RESTPlanCuentasV2Query` | `QueryIn/QueryOut` | `zeta.masters.chart_accounts` |
| `businessLocationsQuery` | `RESTLocalesComercialesV1Query` | `QueryIn/QueryOut` | `zeta.masters.business_locations` |
| `referencesQuery` | `RESTReferenciasV1Query` | `QueryIn/QueryOut` | `zeta.masters.references` |
| `rutNumbersQuery` | `RESTRUTV1Query` | `QueryIn/QueryOut` | `zeta.masters.rut_numbers` |
| `journalTypesQuery` | `RESTTiposAsientosV1Query` | `QueryIn/QueryOut` | `zeta.masters.journal_types` |
| `documentTypesQuery` | `RESTTipoCFEV1Query` | `QueryIn/QueryOut` | `zeta.masters.document_types` |
| `salesDocumentTypesQuery` | `RESTComprobantesV1Query` | `QueryIn/QueryOut` | `zeta.masters.sales_document_types` |
| `salesInvoicesQuery` | `RESTFacturaClienteV4QueryVentas` | `QueryVentasIn/QueryVentasOut` | `zeta.documents.sales` |
| `salesInvoiceDetail` | `RESTFacturaClienteV4VentaDetallada` | `VentaDetalladaIn/VentaDetalladaOut` | `zeta.documents.sales` |
| `salesInvoicesDetailedDaily` | `RESTFacturaClienteV4VentasDetalladas` | `VentasDetalladasIn/VentasDetalladasOut` | `zeta.documents.sales` |
| `salesInvoicePdfUrl` | `RESTFacturaClienteV4URLPDF` | `URLPDFIn/URLPDFOut` | `zeta.documents.sales` |
| `salesPendingBalancesQuery` | `RESTFacturaClienteV4QuerySaldosPendientes` | `QuerySaldosPendientesIn/QuerySaldosPendientesOut` | `zeta.documents.sales_balances` |
| `customerDocumentsQuery` | `RESTComprobantesClienteV1Query` | `QueryIn/QueryOut` | `zeta.documents.customer_documents` |
| `receivedCfesQuery` | `RESTCFEsRecibidosV1CFEsRecibidos` | `CFEsRecibidosIn/CFEsRecibidosOut` | `zeta.documents.received_cfes` |
| `receivedCfeDetail` | `RESTCFEsRecibidosV1CFERecibidoDetalle` | `CFERecibidoDetalleIn/CFERecibidoDetalleOut` | `zeta.documents.received_cfes` |
| `bandejaJournalEntriesQuery` | `RESTBandejaEntradaAsientosV1Query` | `QueryIn/QueryOut` | `zeta.outbound.bandeja_journal_entries` |
| `bandejaJournalEntrySave` | `RESTBandejaEntradaAsientosV1Save` | `SaveIn/SaveOut` | `zeta.outbound.bandeja_journal_entries` |

## Health real

Endpoint: `RESTUsuariosEmpresaV1Query`.

Filtro usado:

```json
{
  "CodigoDesde": "<ZETASOFTWARE_ROLCODIGO>",
  "CodigoHasta": "<ZETASOFTWARE_ROLCODIGO>"
}
```

Criterio: si Zeta responde `Succeed = true`, la conexion se considera valida aunque `Response` venga vacio. Esto valida credenciales, base URL, wrapper y alcance de lectura sin modificar datos.

## Contactos

Endpoint: `RESTContactosV3Query`.

Filtros clave:

- `Search`
- `CodigoDesde`, `CodigoHasta`
- `RUTContiene`, `DocumentoContiene`
- `EsCliente`, `EsProveedor`
- `ContactoActivo`
- `FechaRegistroDesde`, `FechaRegistroHasta`

Campos clave:

- `Codigo`, `Nombre`, `RazonSocial`
- `DocumentoTipo`, `RUT`, `DocumentoSigla`, `Documento`
- `EsCliente`, `EsProveedor`, `ContactoActivo`
- datos de pais, departamento, localidad, direccion y emails

Uso v1: raw record + `ZetaPartyCandidate`; resolucion contra `parties`, `vendors` y `customers` segun rol documental.

## Ventas

Catalogo de comprobantes: `RESTComprobantesV1Query`.

Campos relevantes:

- `Codigo`, `Nombre`, `Abreviacion`
- `Tipo`, `TipoNombre`
- `LocalCodigo`, `LocalNombre`
- `CFE`, `IVA`, `Exportacion`, `NotaDebito`, `Activo`

Fuente documental primaria v1: `RESTFacturaClienteV4QueryVentas`.

Entrada:

- `Mes`, `Anio`
- `FechaDesde`, `FechaHasta`
- `Serie`, `NumeroDesde`, `NumeroHasta`
- `ClienteCodigo`
- `ComprobanteCodigo`
- `MonedaCodigo`
- `LocalCodigo`
- `Page`

Campos documentales y monetarios:

- `RegistroId`
- `ComprobanteCodigo`, `Serie`, `Numero`, `Fecha`
- `ComprobanteNombre`, `ComprobanteTipo`, `ComprobanteTipoNombre`
- `EsCFE`, `TipodeCFECodigo`, `TipoCFENombre`, `Emitido`
- `ClienteCodigo`, `ClienteNombre`, `ClienteRazonSocial`
- `MonedaCodigo`, `MonedaSimbolo`, `CotizacionEspecial`
- `LocalCodigo`, `CentroCostosCodigo`, `Referencia`
- `Subtotal`, `SubtotalSigno`, `IVA`, `IVASigno`, `Total`, `TotalSigno`

Detalle bajo demanda: `RESTFacturaClienteV4VentaDetallada`.

Entrada:

- `FacturaId`

Campos de detalle para materializacion:

- `FacturaFecha`, `FacturaSerie`, `FacturaNumero`, `FacturaSigno`
- `ClienteCodigo`, `ClienteNombre`
- `MonedaCodigo`, `MonedaSimbolo`, `Cotizacion`
- `ArticuloCodigo`, `ConceptoCodigo`, `LineaConcepto`
- `LineaCantidad`, `LineaPrecio`, `LineaSubtotal`, `LineaIVA`, `LineaTotal`
- `IVACodigo`, `IVANombre`, `IVATasa`

Detalle masivo controlado: `RESTFacturaClienteV4VentasDetalladas`. La coleccion/documentacion de Zeta indica uso maximo una vez por dia; Convertilabs no lo usa en la corrida mensual normal.

PDF opcional: `RESTFacturaClienteV4URLPDF`, usado solo para guardar `URLComprobante` cuando haga falta abrir el PDF.

API complementaria: `RESTComprobantesClienteV1Query`. No es la fuente documental primaria de ventas v1; queda para conciliacion por cliente, contexto comercial y narrativa operativa.

## CFEs recibidos

Listado: `RESTCFEsRecibidosV1CFEsRecibidos`.

Entrada:

- `LocalCodigo`
- `FechaDesde`, `FechaHasta`
- `TipoCFECodigo`
- `Pagina`

Campos resumen:

- `RUT`, `DenominacionSocial`
- `EmisorCFETipo`, `Serie`, `Numero`
- `EstadoLocal`, `EstadoDGI`, `EstadoReceptor`
- `FechaEmision`, `FechaVencimiento`
- `Moneda`, `TipoCambio`, `MontoAPagar`

Detalle: `RESTCFEsRecibidosV1CFERecibidoDetalle`.

Entrada:

- `EmisorRUT`
- `CFETipo`
- `CFESerie`
- `CFENumero`

Campos de detalle para materializacion:

- `Documento.FechaEmision`, `Documento.FormaPago`, `Documento.FechaVencimiento`
- `Documento.CFESerie`, `Documento.CFENumero`
- `Receptor.DenominacionSocial`, `Receptor.Documento`
- `Totales.Moneda`, `Totales.TipoCambio`
- `Totales.MontoNoGravado`, `Totales.MontoExportado`
- `Totales.MontoNetoConIVATasaMinima`, `Totales.MontoNetoConIVATasaBasica`
- `Totales.MontoIVAMinimo`, `Totales.MontoIVABasico`
- `Totales.MontoTotal`, `Totales.MontoAPagar`
- `Detalle[]` con linea, item, nombre, cantidad, unidad, precio y monto

## FX

Endpoint: `RESTMonedasCotizacionesV1Query`.

Filtros:

- `MonedaCodigo`
- `FechaDesde`, `FechaHasta`

Campos:

- `MonedaCodigo`
- `Fecha`
- `CotizacionComercial`
- `CotizacionFiscal`

Uso v1: preservar la tasa fuente de Zeta en raw records y comparar contra BCU en el resolver posterior, sin normalizar destructivamente el payload original.
