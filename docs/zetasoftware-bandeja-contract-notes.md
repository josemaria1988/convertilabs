> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# Bandeja de Entrada de Asientos Zetasoftware

Fuente: `docs/Api ZetaSoftware collection.json`.  
Estado PR-01: contrato documentado, writes reales deshabilitados hasta PR-15.

## Endpoints

| Operacion | Endpoint | Wrapper |
|---|---|---|
| Consultar | `RESTBandejaEntradaAsientosV1Query` | `QueryIn/QueryOut` |
| Cargar registro | `RESTBandejaEntradaAsientosV1Load` | `LoadIn/LoadOut` |
| Guardar registro | `RESTBandejaEntradaAsientosV1Save` | `SaveIn/SaveOut` |
| Eliminar registro | `RESTBandejaEntradaAsientosV1Delete` | `DeleteIn/DeleteOut` |

## Query

Entrada:

```json
{
  "QueryIn": {
    "Connection": {},
    "Data": {
      "Page": 1,
      "Filters": {
        "AsientoIdDesde": 1,
        "AsientoIdHasta": 1,
        "FechaDesde": "2026-04-01",
        "FechaHasta": "2026-04-30",
        "TipoAsiento": "TST",
        "Origen": "CVTLAB",
        "Validado": "N"
      }
    }
  }
}
```

Salida por fila:

- `RegistroId`
- `AsientoId`
- `Fecha`
- `TipoAsiento`
- `Concepto`
- `Moneda`
- `TipoCambio`
- `RUT`
- `Contacto`
- `Cuenta`
- `Importe`
- `DebeHaber`
- `CentroCostos`
- `Referencia`
- `Local`
- `LiteralTributario`
- `Origen`
- `Validado`
- `Error`

## Save

Entrada:

```json
{
  "SaveIn": {
    "Connection": {},
    "Data": {
      "RegistroId": 1,
      "AsientoId": 1,
      "Fecha": "2026-04-19",
      "TipoAsiento": "TST",
      "Concepto": "CVTLAB TEST CVTLAB-ZETA-TST-20260419-1200-abc123",
      "Moneda": 1,
      "TipoCambio": 1,
      "RUT": "000000000000",
      "Contacto": "CVTLAB PRUEBA",
      "Cuenta": "111101",
      "Importe": 100,
      "DebeHaber": "D",
      "CentroCostos": "PROY-001",
      "Referencia": "CVTLAB TST CVTLAB-ZETA-TST-20260419-1200-abc123",
      "Local": 1,
      "LiteralTributario": 0
    }
  }
}
```

Salida:

```json
{
  "SaveOut": {
    "Succeed": true,
    "Error": null
  }
}
```

Cuando falla, `Error.Detail[]` puede traer `Id`, `Tipo` y `Descripcion`.

## Mapper conceptual futuro

El mapper `posting_proposals -> Bandeja Save` debe construirse desde facts ya preservados en raw records, documentos y propuestas contables.

Campos minimos que PR-08/PR-11 deben preservar:

- Documento: fecha, tipo de comprobante, serie, numero y referencia externa.
- Moneda: codigo Zeta, tipo de cambio Zeta y politica de comparacion BCU.
- Contraparte: RUT, nombre y rol cliente/proveedor.
- Lineas: importe, IVA, total, concepto y cuenta resuelta si existe.
- Operacion: `documents.cost_center_id` y codigo externo de centro de costo si se resuelve.
- Auditoria: raw record, sync run, payload hash y `document_source_refs`.

## Reglas de seguridad

- No ejecutar `Save` ni `Delete` en PR-01 a PR-14.
- Todo write futuro debe correr con `test_mode = true` salvo aprobacion explicita.
- Todo registro de prueba debe incluir `test_run_key` con prefijo `CVTLAB-ZETA-TST`.
- Todo run con write debe cerrar con `cleanup_status = verified` o `not_required`.
- Los campos `Concepto` y `Referencia` deben contener una marca inequívoca de prueba durante smokes reales.
