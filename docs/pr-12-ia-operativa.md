# PR-12 IA operativa

## Resultado

La IA queda como asistente revisable, no como autoridad operativa.

## Contratos

- `work_unit_assignment_suggestion`
- `party_resolution_suggestion`
- `task_suggestion`
- `process_structuring_suggestion`
- `continuity_risk_suggestion`
- `company_status_summary`
- `money_risk_summary`

## Implementado

- Nueva tabla `operational_suggestions`.
- Builders puros para sugerencias y acciones.
- Repositorio para crear, rechazar, expirar y aceptar sugerencias.
- Aceptar `task_suggestion` crea una task.
- Aceptar `work_unit_assignment_suggestion` o `party_resolution_suggestion` crea un `entity_link`.
- Inicio muestra un brief contextual con links reales.

## Garantias

- Crear una sugerencia no muta entidades de negocio.
- Rechazar deja traza humana.
- Aceptar ejecuta una accion acotada.
- Todo se filtra por `organization_id`.
- Las respuestas de Inicio enlazan superficies reales.

## Pruebas

- `tests/operational-intelligence.test.cjs`
