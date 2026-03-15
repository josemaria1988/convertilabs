# Chart of accounts, presets y gestion del plan

## Objetivo del modulo

Dar una estructura contable inicial util, explicable y versionable sin obligar al usuario a inventar un plan completo desde cero.

## Superficies activas

- `modules/accounting/chart-admin.ts`
- `modules/accounting/presets/*`
- `modules/accounting/preset-apply-service.ts`
- `app/app/o/[slug]/settings/page.tsx`
- `components/onboarding/*preset*`

## Catalogo de presets actual

### Base

- `uy-base-sa-general.v1`

### Overlays por actividad

- `ciiu-01-03-agro.v1`
- `ciiu-28-light-manufacturing.v1`
- `ciiu-33-repair-installation.v1`
- `ciiu-46-wholesale-equipment.v1`
- `ciiu-47-retail.v1`

### Overlays por traits

- `importer.v1`
- `exporter.v1`
- `mixed-vat.v1`
- `multi-currency.v1`
- `recurring-services.v1`
- `tenders-public-sector.v1`

## Modelo de composicion

La arquitectura sigue el modelo correcto del rector:

- `basePresetCode`
- `overlayCodes`
- `PresetComposition`

Una composicion efectiva incluye:

- cuentas
- journal templates
- tax profiles
- ui hints
- razones
- capacidades

No hay una biblioteca plana de "un plan por rubro". Hay composicion de base + overlays.

## Recommendation engine por reglas

Archivo central: `modules/accounting/presets/recommendation-engine.ts`

Entradas:

- actividad principal
- actividades secundarias
- traits
- descripcion corta

Salida:

- composicion recomendada
- alternativas
- `DecisionComment`
- `scoreBreakdown`

El motor sigue siendo deterministico y sincronico. Es la capa base obligatoria incluso cuando luego se usa IA.

## Aplicacion del preset

`applyPresetComposition(...)`:

- inserta solo cuentas que aun no existen;
- conserva metadatos de origen;
- guarda modo de aplicacion en metadata;
- permite fuentes:
  - `recommended`
  - `manual_pick`
  - `minimal_temp_only`
  - `external_import`
  - `hybrid_ai_recommended`

## Gestion del chart en settings

La pantalla de settings hoy permite:

- ver resumen del plan actual;
- exportar CSV del chart;
- aplicar un preset sobre el plan vigente;
- importar una planilla;
- crear cuentas manualmente;
- editar cuentas existentes;
- marcar cuentas provisionales;
- cargar `externalCode`, `taxProfileHint`, tags y `currencyPolicy`.

## Cuentas provisionales

El flujo usa cuentas temporales o provisionales como fallback preferido antes que bloquear por completo. Esto esta alineado al rector.

Se observan en:

- metadata de cuentas con `is_provisional`
- prefijos `TEMP-*` o equivalentes
- resumen de cuentas provisionales en settings

## Importacion de plan externo

Hay dos entradas reales:

### Importacion rapida desde settings

- recibe archivo
- interpreta la planilla
- genera preview
- deriva al workspace de importaciones

### Importacion avanzada

En `/app/o/[slug]/imports` se revisan y confirman secciones como:

- `chart_of_accounts_import`
- `journal_template_import`
- `historical_vat_liquidation`

## Estado actual frente al rector

### Implementado

- base + overlays;
- recomendacion por actividad y traits;
- aplicacion inicial del preset;
- importacion inteligente de planillas;
- cuentas temporales y metadata rica para bridge ERP.

### Parcial

- falta una capa mas profunda de merge inteligente contra planes externos heterogeneos;
- journal templates existen como concepto y se importan, pero su explotacion aun no cubre todos los flujos.

### Pendiente

- snapshot formal `effective_chart_snapshot` como artefacto dedicado visible en UI;
- asistente mas avanzado de consolidacion entre plan importado y plan del sistema;
- cobertura por mas industrias y mas overlays.
