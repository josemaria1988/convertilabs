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
- `ZETASOFTWARE_DESARROLLADOR_CODIGO`
- `ZETASOFTWARE_DESARROLLADOR_CLAVE`
- `ZETASOFTWARE_EMPRESA_CODIGO`
- `ZETASOFTWARE_EMPRESA_CLAVE`
- `ZETASOFTWARE_USUARIOCODIGO`
- `ZETASOFTWARE_USUARIOCLAVE` o `ZETASOFTWARE_USUARIO_CLAVE`, opcional mientras el entorno no lo requiera
- `ZETASOFTWARE_ROLCODIGO`

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

## Registry Convertilabs

El registry vive en `modules/integrations/zeta/client/endpoint-registry.ts`. Ningun endpoint real se invoca si no existe en la coleccion Postman.

| Key | Endpoint Zeta | Wrapper | Stream |
|---|---|---|---|
| `userRolesQuery` | `RESTUsuariosEmpresaV1Query` | `QueryIn/QueryOut` | `zeta.health.user_roles` |
| `contactsQuery` | `RESTContactosV3Query` | `QueryIn/QueryOut` | `zeta.masters.contacts` |
| `contactLoad` | `RESTContactosV3Load` | `LoadIn/LoadOut` | `zeta.masters.contacts` |
| `costCentersQuery` | `RESTCentrosCostoV1Query` | `QueryIn/QueryOut` | `zeta.masters.cost_centers` |
| `taxRatesQuery` | `RESTTasasIVAV1Query` | `QueryIn/QueryOut` | `zeta.masters.vat_rates` |
| `currencyRatesQuery` | `RESTMonedasCotizacionesV1Query` | `QueryIn/QueryOut` | `zeta.masters.currency_rates` |
| `journalTypesQuery` | `RESTTiposAsientosV1Query` | `QueryIn/QueryOut` | `zeta.masters.journal_types` |
| `documentTypesQuery` | `RESTTipoCFEV1Query` | `QueryIn/QueryOut` | `zeta.masters.document_types` |
| `salesDocumentTypesQuery` | `RESTComprobantesV1Query` | `QueryIn/QueryOut` | `zeta.masters.sales_document_types` |
| `customerDocumentsQuery` | `RESTComprobantesClienteV1Query` | `QueryIn/QueryOut` | `zeta.documents.sales` |
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

Movimientos por cliente: `RESTComprobantesClienteV1Query`.

Entrada:

- `ClienteCodigo`
- `Mes`, `Anio`
- `FechaDesde`, `FechaHasta`

Campos documentales y monetarios:

- `ComprobanteCodigo`, `Serie`, `Numero`, `Fecha`
- `MonedaCodigo`, `Cotizacion`
- `ClienteCodigo`, `ClienteNombre`, `ClienteDocumento`
- `CentroCostoCodigo`, `ReferenciaCodigo`
- `TotalRecibo`, `CFETipo`, `CFEEstado`
- `Lineas[]` con `ArticuloCodigo`, `Concepto`, `Cantidad`, `PrecioUnitario`, `Neto`, `IVA`, `Total`
- `FormasPago[]` con moneda y montos de pago

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
