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
- `app/app/o/[slug]/audit/page.tsx`
- `app/app/o/[slug]/audit/actions.ts`
- `modules/audit/document-import-audit.ts`
- `modules/documents/spreadsheet-batch-import.ts`
- `modules/documents/spreadsheet-import-background.ts`
- `components/audit/document-audit-upload-panel.tsx`
- `components/audit/document-audit-preview-workspace.tsx`

## Tipos de import soportados hoy

Definidos en `modules/spreadsheets/types.ts`:

- `historical_vat_liquidation`
- `journal_template_import`
- `chart_of_accounts_import`
- `document_batch_import`
- `mixed`
- `unsupported`

Modos de corrida:

- `interactive`
- `batch`

Nota real hoy:

- los imports documentales auditados usan `document_batch_import` con corrida en background, pero terminan en `preview_ready` antes de materializar;
- el `batch` sigue existiendo como modo soportado del modelo general, aunque el flujo documental actual se comporta como staging interactivo con trabajo durable en segundo plano.

Estados:

- `preview_ready`
- `queued`
- `in_progress`
- `completed`
- `failed`
- `cancelled`

## Flujos reales de planillas

### Carril interactivo en `/imports`

1. usuario sube `.csv`, `.tsv`, `.xlsx` o `.xls`;
2. el parser arma preview estructurada;
3. el interpreter decide intencion por hoja con heuristica o OpenAI;
4. se genera JSON canonico;
5. el usuario confirma la vista previa o solo algunas secciones;
6. el sistema materializa lo confirmado.

### Carril documental auditado en `/audit`

1. usuario selecciona compras o ventas y sube una planilla mensual;
2. el sistema hace preflight deterministico y valida limites del flujo estandar;
3. si pasa el control, se encola una corrida `document_batch_import`;
4. el background detecta layout, normaliza filas y deja un preview estructurado en `preview_ready`;
5. el usuario acepta o rechaza todo o parte del batch;
6. solo las filas aceptadas crean documentos sinteticos y vuelven al workspace de `Documentos`.

## Dos carriles activos hoy

### `/imports`

Carril interactivo para imports con preview y confirmacion selectiva:

- historicos IVA;
- plan de cuentas;
- templates contables;
- seguimiento operativo de corridas visibles en la pantalla de imports.

### `/audit`

Carril auditado orientado a intake documental desde planilla mensual:

- compras o ventas del periodo;
- layout deterministico de Zetasoftware para compras y ventas, con consolidacion por factura, contraparte correcta y cotizacion documental preservada;
- deteccion de layout legacy;
- importacion `document_batch_import` en background;
- preview paginado con aceptar/rechazar todo o subconjuntos;
- historico con usuario, fecha y documentos materializados por corrida;
- cancelacion del trabajo en segundo plano mientras aun se esta preparando el preview.

## Casos de uso visibles hoy

- importacion de historicos IVA;
- importacion de plan de cuentas;
- importacion de templates contables;
- auditoria mensual de documentos de compras o ventas desde planilla;
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
- intake documental auditado desde `Auditoria` con staging previo;
- aceptacion/rechazo total o parcial antes de materializar;
- historico trazable por corrida, usuario y batch materializado;
- cancelacion de corridas con estado `cancelled` mientras el preview aun se esta preparando;
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
