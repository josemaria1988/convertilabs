# PR-01 - Contrato REST Zetasoftware

Fecha: 2026-04-19  
Estado: implementado localmente.

## Objetivo

Cerrar el contrato real de endpoints Zetasoftware usando la coleccion Postman oficial y reemplazar el health pending por una llamada REST real, manteniendo el modo mock para desarrollo seguro.

## Cambios

- Se agrego registry server-only de endpoints en `modules/integrations/zeta/client/endpoint-registry.ts`.
- Se agrego cliente REST generico en `modules/integrations/zeta/client/rest-client.ts`.
- Se agrego carga de credenciales desde variables `ZETASOFTWARE_*` en `modules/integrations/zeta/client/auth.ts`.
- Se actualizo el health de Settings para usar `RESTUsuariosEmpresaV1Query` cuando `mock_enabled = false`.
- Se documento el contrato general en `docs/zetasoftware-endpoints-contract.md`.
- Se documento temprano el contrato de Bandeja en `docs/zetasoftware-bandeja-contract-notes.md`.
- Se agregaron variables de ejemplo en `.env.example`.

## Endpoint de health

Endpoint: `RESTUsuariosEmpresaV1Query`.

Input:

```json
{
  "QueryIn": {
    "Connection": {},
    "Data": {
      "Page": 1,
      "Filters": {
        "CodigoDesde": "<ZETASOFTWARE_ROLCODIGO>",
        "CodigoHasta": "<ZETASOFTWARE_ROLCODIGO>"
      }
    }
  }
}
```

Resultado esperado:

- `Succeed = true`: conexion `connected`.
- `Succeed = false`: conexion `error` con codigo/mensaje Zeta normalizado.
- falta de env/base URL: conexion `error` sin llamar a la API.

## Variables requeridas

- `ZETASOFTWARE_BASE_URL`
- `ZETASOFTWARE_DESARROLLADOR_CODIGO`
- `ZETASOFTWARE_DESARROLLADOR_CLAVE`
- `ZETASOFTWARE_EMPRESA_CODIGO`
- `ZETASOFTWARE_EMPRESA_CLAVE`
- `ZETASOFTWARE_USUARIOCODIGO`
- `ZETASOFTWARE_ROLCODIGO`

`ZETASOFTWARE_USUARIOCLAVE` se soporta como opcional porque la coleccion lo muestra, pero el set de credenciales provisto actualmente no lo incluye.

## Tests agregados

- `tests/zeta-endpoint-registry.test.cjs`
- `tests/zeta-rest-client.test.cjs`

Tambien se actualizo `tests/zeta-connection-service.test.cjs` para cubrir health real configurado, health mock y error de runtime config.

## Notas de seguridad

- El cliente solo corre server-side.
- Los errores normalizados no incluyen credenciales ni request body.
- El modo mock sigue disponible con `ZETA_INTEGRATION_MOCK=1` o `mock_enabled`.
- Los endpoints de Bandeja `Save/Delete` solo estan registrados/documentados. PR-01 no ejecuta writes reales.
