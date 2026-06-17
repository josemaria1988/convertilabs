# PR-11 Integraciones Zeta 2.0

## Resultado

Zeta queda tratado como fuente/destino externo. El modelo interno sigue siendo Convertilabs: parties, work_units, documents, business_events, journal_entries y money.

## Mapping canonico

| Zeta | Convertilabs |
|---|---|
| Contacto | `party` |
| RUT | `party_identifier` |
| CentroCosto | `work_unit` o `integration_entity_link` |
| CFE recibido | `document` + `document_source_ref` |
| Asiento | `journal_entry` como fuente externa |
| Bandeja de entrada | export target con payload Zeta |

## Implementado

- `modules/integrations/zeta/canonical-mapping.ts` define builders canonicos puros.
- El export de compra de gasto puede enviar `CodigoCentroCosto` desde work_unit.
- El runner Zeta conserva raw records, sync runs, audit events y errores trazables.
- Los raw records siguen siendo staging antes de materializar entidades finales.

## Pruebas

- `tests/zeta-canonical-mapping.test.cjs`
- `tests/zeta-sync-runner.test.cjs`
- `tests/zeta-purchase-expense-resolver.test.cjs`

## Regla

Zeta se adapta a Convertilabs. Ningun campo externo define por si solo la forma del modelo interno.
