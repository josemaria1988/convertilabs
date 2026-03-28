# documents

Responsable de captura, clasificacion, extraccion y aprobacion documental.

Estado actual:
- `Documentos` enfocado en upload privado de PDF/JPG/PNG con storage y metadata seguras
- procesamiento durable con Inngest y salida estructurada
- `Revision` como cola principal por buckets operativos
- intake auditado por planilla en `Importacion masiva` con preview previo a materializar
- reviewer por etapas con posting provisional/final, rail opcional y reapertura controlada
- cola `pending-assignment` y soporte de operaciones internacionales
- preservacion del original y trazabilidad por corrida, draft y revision

Archivos clave:
- `modules/documents/upload.ts`
- `modules/documents/processing.ts`
- `modules/documents/review.ts`
- `modules/documents/review-queue.ts`
- `modules/documents/workflow-state.ts`
- `modules/documents/post-provisional-service.ts`
- `modules/documents/confirm-final-service.ts`
- `modules/documents/reopen-remap-service.ts`
- `modules/documents/spreadsheet-batch-import.ts`
