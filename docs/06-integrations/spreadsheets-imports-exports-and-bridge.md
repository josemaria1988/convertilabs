# Spreadsheets, imports, exports y bridge externo

## Objetivo del modulo

Permitir que Convertilabs consuma planillas y exporte resultados sin forzar migracion de ERP.

## Spreadsheet intake

Archivos principales:

- `modules/spreadsheets/parser.ts`
- `modules/spreadsheets/interpreter.ts`
- `modules/spreadsheets/direct-chart-import.ts`
- `modules/spreadsheets/persistence.ts`
- `app/app/o/[slug]/imports/page.tsx`

## Tipos de import soportados hoy

Definidos en `modules/spreadsheets/types.ts`:

- `historical_vat_liquidation`
- `journal_template_import`
- `chart_of_accounts_import`
- `mixed`
- `unsupported`

Modos de corrida:

- `interactive`
- `batch`

Estados:

- `preview_ready`
- `queued`
- `in_progress`
- `completed`
- `failed`
- `cancelled`

## Flujo real de planillas

1. usuario sube `.csv`, `.tsv`, `.xlsx` o `.xls`;
2. el parser arma preview estructurada;
3. el interpreter decide intencion por hoja con heuristica o OpenAI;
4. se genera JSON canonico;
5. el usuario confirma la vista previa o solo algunas secciones;
6. el sistema materializa lo confirmado.

## Casos de uso visibles hoy

- importacion de historicos IVA;
- importacion de plan de cuentas;
- importacion de templates contables;
- alta y seguimiento de operaciones de importacion.

## Import operations

La pantalla `/imports` tambien funciona como carril operativo para importaciones aduaneras:

- crear operacion;
- adjuntar documentos;
- ver warnings;
- aprobar o bloquear la operacion;
- consolidar tributos detectados.

## Export bridge

Archivos principales:

- `modules/exports/repository.ts`
- `modules/exports/accounting-adapters.ts`
- `modules/exports/external-system-layouts.ts`
- `modules/exports/jobs.ts`
- `app/app/o/[slug]/exports/page.tsx`

## Exportaciones activas

### Export contable por periodo

- scope `all_posted`, `posted_final` o `posted_provisional`
- layouts actuales:
  - `generic_csv`
  - `generic_excel_xml`
- usa `externalCode` cuando existe en el plan
- deja archivo firmado en storage privado

### Export fiscal de IVA

- dataset por VAT run;
- workbook / XML;
- resumen mapeado a formulario;
- soporte para trazabilidad, imports y journal entries.

## Canonical model interno

El bridge funciona con una regla sana: primero se arma un modelo canonico interno y despues se adapta al layout externo.

Esto evita que la logica de negocio quede pegada a un ERP especifico.

## Estado frente al rector

### Implementado

- ingestion de planillas heterogeneas;
- preview y confirmacion;
- bridge contable exportable;
- export fiscal IVA;
- metadata suficiente para integracion sin migracion.

### Parcial

- adapters especificos por ERP o estudio;
- APIs publicas o webhooks para terceros;
- mas estrategias de import batch y reproceso operativo.

### Pendiente

- ecosystem bridge mas amplio;
- external mappings persistentes por destino;
- importacion profunda de ventas externas, payroll y otros universos.
