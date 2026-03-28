# accounting

Nucleo contable reusable del flujo documental.

Responsabilidades actuales:

- normalizacion y parsing de drafts contables,
- identidad de factura y dedupe de negocio,
- resolucion inicial de vendor y conceptos,
- motor de sugerencia contable y armado de blockers,
- persistencia de artifacts contables aprobados,
- reglas contables reutilizables con learning, lifecycle y simulacion,
- chart admin, presets y read models,
- open items, exports y soporte de bridge externo.

Archivos clave:
- `modules/accounting/runtime.ts`
- `modules/accounting/rule-engine.ts`
- `modules/accounting/rules-admin.ts`
- `modules/accounting/chart-admin.ts`
- `modules/accounting/read-models.ts`
- `modules/accounting/open-items.ts`
- `modules/accounting/preset-apply-service.ts`
