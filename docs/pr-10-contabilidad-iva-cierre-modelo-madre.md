# PR-10 Contabilidad, IVA y cierre integrados

## Resultado

El kernel contable, IVA y cierre quedan conectados al modelo madre sin reescribir las piezas sanas.

## Implementado

- Inicio muestra senales de IVA y cierre junto con trabajos, documentos, dinero y agenda.
- Agenda muestra el ultimo VAT run, flags fiscales, documentos trazados y ultimo close check.
- El cockpit de cierre materializa blockers/warnings accionables como tasks bloqueadas con metadata de origen.
- El detalle de trabajo muestra asientos, open items, receivables, payables, IVA compras, IVA ventas y margen documental.
- El flujo de posting documental registra business events compatibles con el enum actual usando `event_type = document_posted` y `metadata_json.event_code`.

## Eventos trazados

- `document_posted_provisional`
- `vat_relevant_document_ready`
- `document_confirmed`
- `document_posted_final`

## Criterios cubiertos

- Facturas con `work_unit_id` impactan dinero y margen.
- Open items conservan `party_id` y `work_unit_id`.
- IVA ya no vive solo en `/tax`.
- Cierre genera bloqueos accionables en Agenda.
- El kernel contable existente se conserva.

## Pruebas

- `tests/accounting-fiscal-integration-mvp.test.cjs`
- Regresiones existentes de open items, VAT, close y work units.
