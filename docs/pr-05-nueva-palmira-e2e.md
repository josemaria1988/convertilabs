> **Estado Convertilabs 2.0:** este documento ejecuta el PR-05 de `docs/plan-maestro-version1.md` y queda subordinado al documento refundacional.

# PR-05 Nueva Palmira E2E

Fecha: 2026-06-17

Este PR conecta el flujo fundacional cliente + trabajo + gasto + venta + margen + Inicio. La implementacion queda preparada para el caso "Trabajo Nueva Palmira" sin hardcodear el tenant ni el nombre del trabajo.

## Alcance ejecutado

- Se agrego resumen financiero basico desde documentos vinculados:
  - ventas asociadas al trabajo;
  - compras/gastos asociados al trabajo;
  - margen basico;
  - conteos de documentos por venta, compra, pendiente, bloqueado y posteado.
- Se agrego asociacion manual de documentos existentes a un trabajo desde el detalle de trabajo.
- La asociacion actualiza:
  - `documents.work_unit_id`;
  - `ledger_open_items.work_unit_id`;
  - `ledger_settlement_links.work_unit_id`;
  - `entity_links` document -> work_unit;
  - `business_events` con `event_code = document_work_unit_assigned`.
- Inicio ahora puede mostrar margen de trabajos usando documentos vinculados como fallback cuando `actual_revenue` y `actual_cost` aun no fueron materializados.
- El detalle del trabajo muestra documentos, margen basico y estado documental conectado al caso operativo.

## Archivos principales

- `modules/work/work-unit-financial-summary.ts`
- `modules/work/repository.ts`
- `app/app/o/[slug]/work/actions.ts`
- `app/app/o/[slug]/work/[workUnitId]/page.tsx`
- `components/work/work-detail-page.tsx`
- `modules/presentation/company-home-loader.ts`
- `tests/work-mvp.test.cjs`

## Fuera de alcance

- Upload nuevo ya preasignado a trabajo.
- Tareas vinculadas al trabajo.
- Cobros/pagos manuales fuera de open items.
- Browser E2E con Playwright.

El flujo queda cubierto por tests de dominio/repositorio para mantenerlo estable dentro de la suite actual.
