# ZetaSoftware - Validacion read-only y mapeo operativo

## Estado

Documento de PR 5. Zeta queda como fuente externa estructurada. No habilita escrituras reales.

## Prohibido en esta etapa

- Save real en Zeta.
- Delete real en Zeta.
- Bandeja real de asientos.
- Crear datos productivos irreversibles.
- Asumir estabilidad de IDs no verificados.

## Componentes existentes

- endpoint registry;
- REST client server-only;
- connection service con credenciales cifradas;
- health check;
- sync runs;
- cursors;
- raw records;
- materializacion de contactos, ventas y CFEs recibidos;
- export controlado de compras/gastos con preflight y reconciliacion.

## Streams read-only

- Contactos;
- Centros de costo;
- Comprobantes de cliente / ventas;
- CFEs recibidos / compras;
- maestros contables;
- saldos pendientes si el endpoint queda validado.

## Mapeos canonicos

- Zeta contacto -> `party`, `contact`, `party_identifier`.
- Zeta centro costo -> `work_unit` o pendiente de resolucion.
- Zeta comprobante cliente -> `document`, `business_event`, `party`, `work_unit_candidate`.
- Zeta CFE recibido -> `document`, `business_event`, `party`, `work_unit_candidate`.
- Zeta articulo -> referencia externa de catalogo, no stock maestro interno por defecto.

## Resolucion humana

Los datos claros pueden materializarse contra el canon existente. Los datos ambiguos no se finalizan automaticamente.

Quedan para revision:

- contacto sin RUT, email o nombre confiable;
- posible duplicado de `party`;
- centro de costo que no equivale claramente a `work_unit`;
- venta sin centro de costo;
- gasto sin trabajo;
- documento con party dudoso;
- moneda, IVA o fecha dudosa;
- raw record repetido con payload distinto.

La referencia externa se preserva en `integration_raw_records`, `integration_entity_links` o `document_source_refs`, segun el tipo de entidad local.

## Estado de implementacion local

El repo ya contiene:

- normalizadores Zeta para contactos, ventas, CFEs recibidos y cuentas;
- registry de endpoints;
- REST client server-only;
- sync runner con cursors/raw records;
- materializadores de contactos, cuentas, conceptos y tipos de asiento;
- tests `zeta-*` sin credenciales reales.

Pendiente antes de usar Zeta como fuente operativa principal:

- validar endpoints contra Rontil/Zeta real;
- confirmar equivalencia de centros de costo con trabajos;
- definir bandeja visual de resolucion para matches ambiguos;
- bloquear cualquier escritura hasta completar el circuito Nueva Palmira read-only.

## Gaps a validar con Rontil/Zeta real

- Si CentroCostoCodigo equivale a trabajo real.
- Si hay ventas sin centro de costo.
- Si hay contactos sin RUT.
- Si hay centros de costo ambiguos.
- Si existe sandbox o protocolo controlado.
- Si `RegistroId`, `FacturaId` y `AsientoId` son estables.
- Si hay endpoints confiables para binarios XML/PDF.
- Si saldos pendientes deben venir de Zeta o de Convertilabs.

## Verificacion local

Los tests de Zeta se ejecutan sin credenciales reales con stubs/mocks:

```bash
npm test
```
