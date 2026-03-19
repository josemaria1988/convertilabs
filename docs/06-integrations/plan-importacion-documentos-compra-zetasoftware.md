Rectificación final del documento plan-importacion-documentos-compra-zetasoftware.md
Resumen
No editar todavía en este modo; preparar una revisión documental completa para que el archivo quede alineado con el modelo real de Convertilabs.
Mantener lo bueno de la versión actual: flujo determinístico, fallback de agrupación por proveedor, bloqueo por FX en draft, re-derivación tras resolver tasa, banner y acción masiva.
Reincorporar las piezas que se perdieron o quedaron demasiado fuertes: mapeo de comprobantes, persistencia definitiva del RUT normalizado, contrato completo de flags FX, y aclaración de que resolver FX no garantiza por sí solo postabilidad total.
Cambios exactos al documento
Reescribir el título y guardar el archivo en UTF-8 real para eliminar el mojibake.
En el resumen, mantener que la IA es auxiliar y configurable por getOpenAIModelConfig().openAiDocumentModel, no un requisito central del flujo Zeta.
Agregar una sección breve de “Tipos e interfaces” con:
ColumnKey: lineConcept, fxRate, vatLabel
DocumentSpreadsheetImportRow: documento consolidado con sourceRows, sourceRowNumbers, consolidationKey, isCreditNote
DocumentSpreadsheetPreflightResult: métricas extendidas
DocumentSpreadsheetImportRunProgress: fxPendingCount, fxResolvedCount, fxFailedCount
AccountingContextReasonCode: missing_fx_rate
En consolidación, dejar explícito:
clave: Fecha + Comprobante + Serie + Numero + Moneda + (RUT normalizado si existe; si no, Proveedor normalizado)
RUT normalizado también se usa en el guardado definitivo de facts.issuer_tax_id
valor crudo del RUT sólo queda en metadata/audit trail
Reincorporar el mapeo determinístico de comprobantes:
Compra Contado y Compra Crédito => purchase_invoice con hint de mercadería
Compra Contado Gastos y Compra Crédito Gastos => purchase_invoice con hint de gasto
variantes con Nota de Crédito, Devolución o total consolidado negativo => purchase_credit_note
Agregar que Concepto se preserva por línea en line_items.concept_description, no en cabecera.
Mantener la validación dura de totales y la tolerancia residual, pero aclarar que el grupo bloqueado no se importa.
Ajustes clave de FX y workflow
En la sección de FX, restaurar el contrato completo del bloqueo defensivo cuando no hay tasa:
posting_status = 'draft'
metadata.review_required = true
metadata.validation_errors = ["MISSING_FX_RATE"]
metadata.is_postable = false
propagación del error a warnings/blockers/contexto contable
Aclarar que resolveMissingFxRates corre:
automáticamente al final del import en background
y también por acción masiva desde la bandeja
Reescribir la frase de éxito de FX:
no decir “posteable inmediatamente”
decir “elimina el bloqueo específico de FX y re-deriva artifacts; la postabilidad final sigue dependiendo del resto de validaciones”
En la re-derivación, enumerar al menos:
monetarySnapshot
journal_suggestion_json
tax_treatment_json
blockers/warnings/estado derivado del draft
En cancelación, reemplazar step.stop() por una formulación implementable:
“recargar el run antes de cada chunk o llamada costosa y salir temprano si status === 'cancelled'”
no introducir cancel_requested_at si no se va a implementar en esta iteración
Cierre del documento
Mantener el banner y el botón masivo, pero aclarar que el reintento actúa sobre todos los documentos con MISSING_FX_RATE, no sólo los visibles en la página.
Recuperar las pruebas de aceptación del dataset de febrero:
~179 filas crudas
~124 documentos consolidados
~46 casos USD sin FX en origen
~8 filas residuales ignoradas
Cerrar con una instrucción final de implementación menos prescriptiva que la actual:
dividir en 5 tareas
no romper el importador genérico
documentar cambios al terminar
sugerir nombre de commit
sin exigir “posteabilidad inmediata” tras resolver FX
Supuestos
La fuente de verdad para bloqueo/postabilidad sigue siendo el modelo actual de draft + derived validation + warnings/blockers, con metadata como resumen persistido.
Esta iteración cubre compras Zeta; ventas y otros layouts quedan fuera.
El documento debe reflejar el proyecto real, no inventar columnas o contratos nuevos si no están incluidos en el plan de implementación.
## Estado de implementacion - 2026-03-19

Implementado en codigo:
- Perfil deterministico para layout Zeta Compras con consolidacion por factura, RUT normalizado, notas de credito por texto o total negativo, y `Concepto` preservado por linea.
- Preflight y extraccion con metricas extendidas: filas crudas, documentos consolidados, grupos bloqueados, residuos ignorados, USD sin FX y rango de fechas.
- Persistencia defensiva de FX faltante usando `metadata + warnings + document_accounting_contexts`, manteniendo `posting_status = draft` y `validation_errors = ["MISSING_FX_RATE"]`.
- Resolucion automatica `resolveMissingFxRates` con jerarquia `Excel > BCU > bloqueo`, rederivacion de artifacts y limpieza automatica del bloqueo cuando BCU resuelve.
- Integracion en background import runs con etapa `resolving_fx`, progreso dedicado y salida temprana cuando la corrida fue cancelada.
- UI en Documentos con banner de documentos USD sin cotizacion y accion masiva `Reintentar tasas BCU`.
- Review UI con distincion visible entre FX `document_import`, `bcu`, `manual_override` y `document_default`.

Verificacion tecnica:
- `next build` ejecutado con exito despues de los cambios.
- `npm run lint` sigue fallando solo por errores preexistentes en `modules/accounting/repository.ts` ajenos a esta implementacion.
