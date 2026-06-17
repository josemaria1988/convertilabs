> **Estado Convertilabs 2.0:** este documento ejecuta el PR-06 de `docs/plan-maestro-version1.md` y queda subordinado al documento refundacional.

# PR-06 Money MVP

Fecha: 2026-06-17

Este PR crea el dominio visible `money` encima de `ledger_open_items` y `ledger_settlement_links`. El usuario ve Dinero, no el subledger tecnico.

## Alcance ejecutado

- Se creo `modules/money` como capa de producto:
  - deudores;
  - acreedores;
  - vencidos;
  - vencen esta semana;
  - agrupacion por cliente/proveedor;
  - agrupacion por trabajo.
- Se agrego la ruta privada `/app/o/[slug]/money`.
- Se agrego redirect global `/money`.
- El menu principal ahora apunta a `/money`.
- `/open-items` queda disponible como subledger contable tecnico.
- Se amplio `v_open_items_outstanding` con:
  - `work_unit_id`;
  - `work_unit_name`;
  - `work_unit_code`.
- Se agrego migracion incremental para el read model de dinero.
- Inicio y Agenda ahora enlazan a la superficie de producto `/money`.

## Archivos principales

- `modules/money/repository.ts`
- `modules/money/types.ts`
- `components/money/money-dashboard.tsx`
- `app/app/o/[slug]/money/page.tsx`
- `app/money/page.tsx`
- `db/schema/09_accounting_read_models.sql`
- `supabase/migrations/20260617_pr06_money_work_unit_read_model.sql`
- `tests/money-mvp.test.cjs`

## Fuera de alcance

- Entidades operativas nuevas `payments`, `collections` y `financial_accounts`.
- Conciliacion bancaria.
- Caja/bancos real.
- Pantallas de alta manual de pagos/cobros.

La base queda lista para esos pasos porque los saldos ya se agrupan por `party`, `document` y `work_unit`.
