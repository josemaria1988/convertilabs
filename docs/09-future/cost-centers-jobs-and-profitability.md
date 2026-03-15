# Cost centers, jobs y profitability

## Por que este documento existe

El rector exige que esta capa forme parte de la vision V1, pero el repo actual todavia no la implementa como modulo productivo real. Por eso se documenta separada: para dejar claro el objetivo sin venderlo como feature cerrada.

## Estado actual del repo

### Lo que si existe

- `suggestedCostCenters[]` en la recomendacion hibrida de presets;
- persistencia del borrador en `organization_preset_ai_runs`;
- `modules/exports/jobs.ts` como parte del namespace de exports;
- varios lugares del rector y de la UI ya mencionan futuros centros de costo, jobs y margen.

### Lo que no existe aun

- tabla `cost_centers`;
- tabla `jobs`;
- tabla `document_allocations`;
- asignacion real desde el review workspace;
- revenue links y snapshots de margen;
- vistas privadas de rentabilidad.

## Modelo objetivo

Cuando este modulo se implemente, deberia cubrir al menos:

- centros de costo estables por area o funcion;
- jobs o trabajos puntuales por OT/proyecto/servicio/viaje;
- asignacion de documentos y lineas a uno o varios destinos;
- vinculacion de ingresos y costos;
- margen bruto y neto estimado;
- costos no asignados y warnings de asignacion incompleta.

## Entidades objetivo sugeridas

- `cost_centers`
- `jobs`
- `job_groups` o `service_batches`
- `document_allocations`
- `job_revenue_links`
- `job_margin_snapshots`

## Relacion con el resto del producto

Este modulo no debe vivir separado del flujo principal. Debe alimentarse de:

- business profile;
- chart of accounts;
- document review;
- posting;
- VAT/import context;
- exports.

## Guardrails para el dia que se implemente

- no mezclar cost center con cuenta contable;
- no obligar al usuario a asignar todo desde el dia uno;
- permitir `sin asignar`, `un destino` o `varios destinos`;
- preservar explainability;
- dejar snapshot versionado de la asignacion usada al momento del posting;
- no rerunear IA sobre historicos sin orden explicita.

## Paso evolutivo ya preparado

La sugerencia IA de centros de costo durante onboarding es una semilla util:

- permite explicar estructura sugerida;
- deja auditoria del razonamiento;
- evita crear entidades reales demasiado pronto.

El siguiente paso correcto seria:

1. materializar borradores en tablas reales;
2. exponer CRUD en settings;
3. conectar asignacion al review workspace;
4. sumar reporting de rentabilidad.
