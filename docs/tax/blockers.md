# Tax Blockers

## Activos

- Hay que ejecutar la migración `supabase/migrations/20260312_tax001_uy_vat_profile_alignment.sql` antes de usar el nuevo perfil fiscal en runtime real.
- Las organizaciones ya creadas quedan con `vat_regime`, `dgi_group` y `cfe_status` en `UNKNOWN` hasta que alguien las complete desde Settings; mientras tanto el motor IVA fuerza `manual review`.
- El visor fiscal V1 sigue siendo conservador: exportación, mixtos, no gravados y casos especiales no se auto-liquidan.

## No bloqueantes para esta iteración

- `vat_runs` ya consume el tratamiento fiscal nuevo sin cambiar su contrato externo.
- El pipeline documental y el draft persistido ya tienen la trazabilidad mínima para ligar documento, snapshot y confirmación.
