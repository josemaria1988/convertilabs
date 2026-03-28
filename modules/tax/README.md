# tax

Responsable de calendarios, validaciones y procesos fiscales conectados al core.

Estado actual:
- IVA Uruguay como vertical productiva activa
- preview y corrida oficial por periodo
- workbench fiscal con universo, bloqueos y resoluciones manuales
- conciliacion DGI base por buckets
- export fiscal y compatibilidad con imports historicos
- feature flags conservadoras para el perimetro MVP

Archivos clave:
- `modules/tax/uy-vat-engine.ts`
- `modules/tax/vat-run-preview.ts`
- `modules/tax/vat-runs.ts`
- `modules/tax/tax-period-workbench.ts`
- `modules/tax/dgi-reconciliation.ts`
- `modules/tax/feature-flags.ts`
