# Plataforma fiscal, VAT, FX e importaciones

## Objetivo del modulo

Proveer una arquitectura tributaria modular donde IVA sea la primera vertical plenamente operativa, sin cerrar la puerta a futuros motores fiscales y operativos.

## Estado actual del tax module

Archivos principales:

- `modules/tax/uy-vat-engine.ts`
- `modules/tax/vat-run-preview.ts`
- `modules/tax/vat-runs.ts`
- `modules/tax/dgi-reconciliation.ts`
- `modules/tax/uy-vat-profile.ts`
- `modules/tax/feature-flags.ts`
- `app/app/o/[slug]/tax/page.tsx`
- `app/app/o/[slug]/tax/reconciliation/page.tsx`

## IVA Uruguay como vertical activa

### Cobertura real hoy

- compras y ventas;
- buckets de IVA output e input;
- credito directo, indirecto y no deducible;
- prorrata cuando hay coeficiente;
- import VAT e import VAT advance;
- preview del run;
- run definitivo;
- export;
- baseline y diferencias DGI.

### Guardrails fiscales actuales

- solo Uruguay;
- requiere perfil fiscal versionado;
- solo automatiza IVA con `vat_regime = GENERAL`;
- revisa forma juridica automatizable;
- usa flags para bloquear casos sensibles;
- no automatiza silenciosamente exportaciones/exentas en modos deshabilitados.

### Feature flags activas

- `VAT_UY_MVP_ENABLED`
- `VAT_UY_EXPORT_AUTO_DISABLED`
- `VAT_UY_MIXED_USE_MANUAL_REVIEW`
- `VAT_UY_SIMPLIFIED_REGIME_AUTO_DISABLED`

## Location risk y razonabilidad geografica

El VAT engine ya integra `location-risk-engine` para casos como:

- travel pattern;
- merchant sensible lejos de la base;
- outliers geograficos.

Esto puede:

- agregar warnings;
- exigir nota del usuario;
- bloquear automatizacion segura.

## Runs de IVA

La pantalla `/app/o/[slug]/tax` ya expone:

- metricas del periodo;
- `VatRunPreviewCard`;
- generacion de IVA definitivo desde simulacion;
- acciones de lifecycle:
  - review
  - finalize
  - lock
  - reopen
  - export

## Conciliacion DGI

El repo ya tiene fundaciones para:

- `dgi_reconciliation_runs`
- `dgi_reconciliation_buckets`
- diferencias por bucket
- vista dedicada `/tax/reconciliation`

No es todavia una conciliacion oficial de espectro completo, pero ya existe el carril estructural correcto.

## Importaciones y DUA

Estado real hoy:

- tablas `organization_import_operations`, `organization_import_operation_documents`, `organization_import_operation_taxes`;
- UI en `/app/o/[slug]/imports`;
- alta manual de operacion de importacion;
- vinculacion de documentos;
- agregacion de tributos y warnings;
- uso posterior dentro de VAT/export dataset.

Esto deja operativo un carril inicial para:

- DUA;
- proveedor exterior;
- despachante;
- tributos asociados.

## Multimoneda y FX

El repo ya tiene piezas reales:

- `modules/accounting/bcu-fx-service.ts`
- `modules/accounting/fx-policy.ts`
- `currencyPolicy` en chart;
- campos monetarios en original y UYU en VAT/export.

Pero el rector todavia no esta cumplido al 100% en este punto. Falta una persistencia mas uniforme del snapshot FX fiscal a lo largo de todos los flujos y reportes.

## Otros motores tributarios

Hoy no estan operativos como features cerradas:

- IRAE
- IPAT
- ICOSA
- BPS obligations
- retenciones varias

La arquitectura y el discurso del producto ya los contempla, pero el repo activo sigue teniendo a IVA como motor prioritario real.

## Estado frente al rector

### Implementado

- VAT core;
- preview y definitivo;
- diferencias DGI base;
- carril inicial de importaciones;
- hooks de multimoneda;
- explainability fiscal razonable.

### Parcial

- FX fiscal persistido de punta a punta;
- importaciones profundas con costo capitalizable/no capitalizable completo;
- conciliacion DGI mas exhaustiva.

### Pendiente

- demas familias tributarias;
- reporting integral tributario anual;
- ingestion externa formal de fuentes oficiales.
