> **Estado Convertilabs 2.0:** este documento ejecuta el PR-04 real de `docs/plan-maestro-version1.md` y queda subordinado al documento refundacional.

# PR-04 Trabajos MVP

Fecha: 2026-06-17

Este PR implementa la primera superficie operativa de Trabajos sobre el modelo madre (`work_units` + `parties`), para que Convertilabs deje de presentar los trabajos como centros de costo legacy y empiece a usarlos como entidad conectiva de cliente, documentos y margen basico.

## Alcance ejecutado

- Se reemplazo `/app/o/[slug]/work` por un listado real de `work_units`.
- Se agrego creacion de trabajos desde la vista privada:
  - nombre;
  - codigo;
  - tipo;
  - cliente existente;
  - alta rapida de cliente como `party` con rol `customer`;
  - fechas;
  - venta y costo estimados;
  - moneda;
  - descripcion.
- Se agrego detalle de trabajo en `/app/o/[slug]/work/[workUnitId]`.
- El detalle muestra ficha, cliente, documentos vinculados, venta, costo y margen.
- El repositorio de `modules/work` resuelve clientes desde `parties`, cuenta documentos asociados y calcula resumen basico desde documentos enlazados.
- La creacion de trabajo registra un `business_event` `work_unit_created` cuando la tabla esta disponible.

## Archivos principales

- `app/app/o/[slug]/work/page.tsx`
- `app/app/o/[slug]/work/[workUnitId]/page.tsx`
- `app/app/o/[slug]/work/actions.ts`
- `components/work/work-list-page.tsx`
- `components/work/work-detail-page.tsx`
- `modules/work/repository.ts`
- `modules/work/index.ts`
- `tests/work-mvp.test.cjs`

## Validaciones previstas

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Fuera de alcance

- Asociar o reasignar documentos desde la UI del detalle.
- Crear cobros, pagos y tareas vinculadas al trabajo.
- Test E2E Nueva Palmira completo.
- Recalcular y persistir automaticamente `actual_revenue` y `actual_cost` desde documentos.

Estos puntos pertenecen a la continuacion de la Etapa 4 y a PR-05 segun el plan maestro.
