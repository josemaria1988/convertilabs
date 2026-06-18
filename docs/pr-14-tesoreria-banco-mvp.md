# PR-14 Tesoreria / Banco MVP

Este corte convierte la superficie visible `/money` en **Tesoreria** sin cambiar la ruta canonica tecnica. Los aliases `/treasury`, `/tesoreria`, `/app/o/[slug]/treasury` y `/app/o/[slug]/tesoreria` redirigen a `/app/o/[slug]/money`.

## Implementado

- Modulo `modules/treasury` con calculos puros en unidades menores (`bigint`) para impacto de vales, caja libre, simulador de retiro, proyeccion y alertas.
- Repositorio server-side con conversion en bordes a importes `numeric(18,2)` de Postgres.
- Schema canonico `db/schema/14_treasury.sql` y migracion `supabase/migrations/20260618_pr14_treasury_mvp.sql`.
- Tablas operativas: cuentas bancarias, snapshots de saldo, vales, terminos, eventos, cuentas por cobrar manuales y reglas de colchon.
- RLS por membresia activa y permisos de insert/update para `owner`, `admin`, `admin_processing`, `accountant` y `operator`.
- RPCs transaccionales `treasury_record_vale_renewal` y `treasury_record_vale_closure`.
- UI `TreasuryWorkspace` en `/app/o/[slug]/money` con pestanas Resumen, Bancos, Vales, Por cobrar, Deudores/Acreedores y Subledger.
- Detalle de vale en `/app/o/[slug]/money/vales/[valeId]`.
- Inicio usa caja libre conservadora y alertas criticas cuando el schema de tesoreria existe; si no existe, degrada al resumen de open items.

## Limites Del MVP

- No hay integracion bancaria automatica.
- No se generan asientos contables, settlements ni movimientos de banco por marcar cobros o registrar eventos.
- Las cuentas por cobrar manuales alimentan solo proyeccion futura; no aumentan caja disponible actual.
- Los estados `dueSoon`, `overdue` y `riskLevel` de vales se derivan en servicio, no se persisten.

## Validacion Esperada

```bash
npm run test
npm run typecheck
npm run db:verify:parity
```
