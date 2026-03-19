# Document intake y procesamiento

## Objetivo del modulo

Capturar documentos reales, guardarlos en storage privado, extraer hechos estructurados y dejar un draft persistido listo para revision humana.

## Superficies activas

### Rutas y UI

- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `components/documents/upload-button.tsx`
- `components/documents/upload-dropzone.tsx`
- `components/documents/documents-workspace-table.tsx`

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
- planillas mensuales `.csv`, `.tsv`, `.xlsx` y `.xls` para importacion documental batch
- cargas individuales
- lotes visibles desde la bandeja documental

La arquitectura visible hoy ya tiene dos carriles en `Documentos`:

- upload privado de comprobantes binarios para intake IA clasico;
- importacion mensual por planilla que crea documentos sinteticos y los deja listos para revision.

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

### Importacion documental por planilla

1. el usuario elige compras o ventas y sube una planilla mensual;
2. el sistema hace preflight, valida limite del flujo estandar y encola un `document_batch_import`;
3. la corrida de background detecta headers, extrae filas importables y persiste documentos `source_type = spreadsheet_import`;
4. si faltan cotizaciones USD, corre la resolucion automatica contra BCU y re-deriva los artifacts necesarios;
5. el seguimiento visible se hace desde la misma bandeja documental con progreso y toast final.

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
- hay trazabilidad de corrida, proveedor, modelo y latencia.

## Lo que sigue parcial

- aun no existe una cola dedicada y explicitamente nombrada como "Procesados pendientes de asignacion";
- la separacion conceptual ya existe en dominio y review workspace, pero no en una vista operativa independiente de punta a punta;
- faltan mas conectores externos de entrada ademas del upload y las planillas;
- la importacion documental por planilla ya tiene progreso, cierre y cancelacion visibles desde la misma UI de `Documentos`;
- todavia faltan mas herramientas operativas para reintento fino, auditoria expandida y reproceso por subconjuntos.

## Regla de lectura del siguiente documento

Este archivo termina cuando el draft ya existe. Desde ahi en adelante, todo lo relativo a revision, clasificacion, aprendizaje y posting vive en `02-document-review-classification-and-posting.md`.
