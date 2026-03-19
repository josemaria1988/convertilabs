# Document intake y procesamiento

## Objetivo del modulo

Capturar documentos reales, guardarlos en storage privado, extraer hechos estructurados y dejar un draft persistido listo para revision humana.

## Superficies activas

### Rutas y UI

- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/audit`
- `components/documents/upload-button.tsx`
- `components/documents/upload-dropzone.tsx`
- `components/documents/documents-workspace-table.tsx`
- `components/audit/document-audit-upload-panel.tsx`
- `components/audit/document-audit-preview-workspace.tsx`

### Backend y jobs

- `modules/documents/upload.ts`
- `modules/documents/processing.ts`
- `modules/documents/spreadsheet-batch-import.ts`
- `modules/documents/spreadsheet-import-background.ts`
- `modules/documents/inngest-function.ts`
- `app/api/inngest/route.ts`
- `app/api/v1/documents/[documentId]/processing-status/route.ts`

## Tipos de archivo y entrada

Estado real hoy:

- PDF
- JPG / PNG
- planillas mensuales `.csv`, `.tsv`, `.xlsx` y `.xls` para auditoria documental batch
- cargas individuales
- lotes auditados con preview e historico propio

La arquitectura visible hoy ya separa dos carriles:

- `Documentos` para upload privado de comprobantes binarios e intake IA clasico;
- `Auditoria` para planillas mensuales que primero generan staging auditable y solo despues materializan documentos sinteticos.

## Flujos operativos

### Upload binario clasico

1. el usuario sube archivo desde UI privada;
2. el server prepara metadata y ruta segura de storage;
3. se completa upload y se crea/actualiza `documents`;
4. Inngest toma el trabajo;
5. OpenAI procesa el archivo y devuelve `DocumentIntakeOutput`;
6. el sistema persiste:
   - facts;
   - amount breakdown;
   - line items;
   - warnings;
   - confidence;
   - candidatos y contexto de extraccion;
7. se crea `document_draft` y sus pasos;
8. el documento queda listo para revision.

### Auditoria documental por planilla

1. el usuario entra a `/app/o/[slug]/audit`, elige compras o ventas y sube una planilla mensual;
2. el sistema hace preflight, valida limite del flujo estandar y encola un `document_batch_import`;
3. la corrida de background detecta headers, aplica normalizadores deterministas cuando reconoce layouts como Zetasoftware compras o ventas, extrae filas importables y deja la corrida en `preview_ready` dentro de `organization_spreadsheet_import_runs`;
4. el usuario revisa el preview, acepta o rechaza todo o subconjuntos del batch;
5. solo las filas aceptadas materializan documentos `source_type = spreadsheet_import`;
6. esos documentos vuelven al workspace de `Documentos` para revision, clasificacion y posting;
7. el historico de `Auditoria` conserva archivo, usuario, fechas y documentos creados por la corrida.

## Contrato IA de intake

Archivo central: `modules/ai/document-intake-contract.ts`

Campos principales del contrato:

- identidad de emisor y receptor;
- documento, serie, moneda, fechas;
- subtotal, impuesto y total;
- candidatos de categoria de compra/venta;
- lineas y breakdown de montos;
- explicaciones cortas;
- `certainty_breakdown_json`.

## Persistencia relevante

### Tablas base

- `documents`
- `document_processing_runs`
- `document_drafts`
- `document_draft_steps`
- `document_field_candidates`
- `document_classification_candidates`
- `document_line_items`
- `document_extractions`

### Artefactos auxiliares

- `document_invoice_identities`
- `document_accounting_contexts`
- `ai_decision_logs`

## Estados visibles

### Estados `documents.status`

El repo hoy usa, entre otros:

- `uploading`
- `uploaded`
- `queued`
- `extracting`
- `extracted`
- `draft_ready`
- `classified`
- `classified_with_open_revision`
- `needs_review`
- `approved`
- `rejected`
- `duplicate`
- `archived`
- `error`

### Nota editorial importante

El rector propone un pipeline mas expresivo (`ready_for_assignment`, `posted_provisional`, `posted_final`, etc.). El repo ya modela parte de esa separacion con `posting_status`, `document_assignment_runs` y `workflow-state`, pero `documents.status` todavia conserva nomenclatura heredada de etapas previas.

`processing` sigue existiendo en el proyecto, pero como estado de `document_processing_runs` y como etiqueta derivada en algunas vistas; no es parte del enum canonico actual de `documents.status`.

## Lo que ya esta bien alineado al rector

- extraccion y revision no viven en el mismo prompt;
- el output IA es estructurado y persistido;
- la organizacion y el draft quedan versionados;
- el documento original sigue inmutable;
- hay trazabilidad de corrida, proveedor, modelo y latencia;
- la importacion documental masiva ya tiene staging previo y no escribe `documents` a ciegas.

## Lo que sigue parcial

- aun no existe una cola dedicada y explicitamente nombrada como "Procesados pendientes de asignacion";
- la separacion operativa ya existe entre `Documentos` y `Auditoria`, pero todavia faltan colas y vistas especializadas equivalentes para otros canales de entrada;
- faltan mas conectores externos de entrada ademas del upload y las planillas;
- el flujo auditado ya existe, pero todavia faltan herramientas mas finas para reproceso, diff entre preview y materializado y operaciones sobre subconjuntos mas complejos;
- la auditoria expandida hoy se concentra en imports documentales por planilla, no en todas las superficies del producto.

## Regla de lectura del siguiente documento

Este archivo termina cuando el draft ya existe. Desde ahi en adelante, todo lo relativo a revision, clasificacion, aprendizaje y posting vive en `02-document-review-classification-and-posting.md`.
