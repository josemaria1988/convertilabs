# 01 - Workflows, UX and surfaces

## Para que existe este documento

Este es el mapa de como fluye el trabajo real del usuario y como debe traducirse a UX, especialmente en el refactor mobile-first actual.

Leelo si vas a tocar:

- navegacion privada;
- reviewer documental;
- buckets y estados;
- pantallas mobile;
- copy y CTAs;
- flujo de intake, review, posting o auditoria documental.

## 1. Reglas UX oficiales

### Mobile first obligatorio

Toda nueva UI debe pensarse primero para mobile.

Reglas activas:

- ancho mental base `375px`;
- bottom navigation fija en mobile;
- maximo 5 items visibles;
- desktop deriva de mobile, no al reves.

### Navegacion mobile oficial

Bottom nav fija con:

- Inicio
- Documentos
- Revisar
- IVA
- Ajustes

Las superficies avanzadas pueden entrar por:

- accesos contextuales;
- acciones secundarias;
- cards internas;
- desktop o hub experto.

### Filosofia de pantalla

Cada pantalla debe:

- tener una accion principal;
- pedir un tipo de decision por vez;
- ocultar complejidad innecesaria;
- mostrar defaults inteligentes y motivos de bloqueo visibles.

### Patrones prohibidos

No hacer:

- tablas complejas como experiencia mobile principal;
- UI tipo ERP con demasiadas columnas;
- mezclar revision factual, decision contable, fiscalidad, aprendizaje y posting en una sola etapa visual;
- mostrar internals como narrativa de producto;
- usar metricas sinteticas para llenar huecos.

## 2. Superficies privadas activas

### Superficies core

- `Inicio`
- `Documentos`
- `Revisar`
- `IVA / Impuestos`
- `Ajustes`

### Superficies expertas o secundarias

- `Cierre`
- `Auditoria`
- `Importaciones`
- `Exportaciones`
- `Mapa contable`
- `Reglas contables`
- `Libro diario`
- `Balance`
- `Open items`
- `Avanzado`

### Rutas privadas clave

- `/app/o/[slug]/dashboard`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/review`
- `/app/o/[slug]/documents/pending-assignment`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/tax/reconciliation`
- `/app/o/[slug]/close`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/rules`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/advanced`

Regla practica:

La app ya no gira alrededor de un dashboard decorativo. Gira alrededor de:

1. ingreso;
2. revision;
3. posting;
4. IVA y cierre;
5. bridge externo.

## 3. Pantalla de inicio

La home correcta debe responder:

> que esta pasando y que hago ahora

Bloques recomendados:

1. resumen breve de estado operativo;
2. CTA `Agregar documentos`;
3. CTA `Revisar pendientes`;
4. historial corto de trabajo reciente;
5. alertas relevantes.

No hacer:

- charts inventados;
- KPIs sin historia real;
- tablas gigantes;
- navegacion tipo ERP.

## 4. Carriles de entrada documental

Convertilabs tiene dos carriles de entrada y un carril humano principal.

### A. Documentos

Para carga binaria:

- PDF
- JPG
- PNG

Flujo:

1. upload;
2. validacion temprana de duplicado exacto por hash cuando el cliente puede calcularlo;
3. storage privado;
4. procesamiento IA;
5. rechazo duro si ya existe la misma factura por proveedor o emisor + numero + monto total;
6. draft persistido solo si el caso sigue siendo valido;
7. derivacion a revision.

Regla dura de intake:

- no aceptar como documento operativo normal un archivo ya cargado;
- no aceptar como documento operativo normal una factura ya existente aunque el archivo sea distinto;
- `mismo nombre de archivo` no es criterio suficiente;
- el criterio de identidad fuerte es proveedor o emisor normalizado + numero normalizado + monto total + moneda;
- duplicados exactos se rechazan antes de entrar al reviewer;
- duplicados difusos o sospechosos pueden seguir existiendo como bloqueo revisable.

### B. Auditoria / Importacion masiva

Para planillas mensuales:

- `.csv`
- `.tsv`
- `.xlsx`
- `.xls`

Flujo:

1. upload de planilla;
2. preflight;
3. deteccion de layout;
4. preview o staging auditable;
5. aceptar o rechazar filas;
6. materializar documentos;
7. esos documentos vuelven a review.

### C. Review

Es la cola humana principal. `Documentos` no debe cargar con toda la narrativa de revision diaria.

## 5. Buckets operativos del reviewer

La superficie `Review` debe priorizar buckets accionables:

- Por revisar factual
- Por asignar o clasificar
- Bloqueados
- Listos para provisional
- Listos para final

`Procesando` y `Finalizados` pueden existir, pero no deben competir visualmente con el trabajo diario.

Importante:

- un documento rechazado por duplicado exacto no debe comportarse como `pendiente`;
- debe verse como bloqueado o descartado, con motivo explicito y referencia al documento existente cuando sea posible.

## 6. Estados canonicos visibles

La UI principal debe apoyarse en esta semantica:

- `pending_factual_review`
- `pending_assignment`
- `pending_learning_decision`
- `ready_for_provisional_posting`
- `posted_provisional`
- `ready_for_final_confirmation`
- `posted_final`
- `reopened_needs_manual_remap`
- `locked`

Traduccion recomendada para UI:

- Pendiente de revision factual
- Pendiente de asignacion
- Pendiente de aprendizaje
- Listo para provisional
- Posteado provisional
- Listo para final
- Confirmado final
- Reabierto para remap
- Bloqueado

Anti-regla:

No inventar estados nuevos si uno canonico ya explica la situacion.

## 7. Flujo correcto del documento

### Capa logica real del workflow

1. revision factual;
2. contexto contable;
3. seleccion de regla o plantilla;
4. tratamiento fiscal;
5. preview;
6. aprendizaje;
7. posting;
8. reapertura si hace falta.

### Traduccion UX recomendada

La UX no tiene que mostrar todas esas capas como un monstruo tecnico. Debe mostrarlas como un flujo guiado.

## 8. Reviewer mobile: flujo oficial

### Objetivo

Pedir solo lo necesario en cada paso, sin exponer el motor interno.

### Paso visible 1 - Confirmar datos crudos

Campos visibles prioritarios:

- proveedor;
- numero de factura;
- fecha;
- moneda;
- subtotal;
- IVA;
- total;
- concepto.

Esto corresponde a los datos que la IA ya extrajo. La accion principal es confirmar o corregir.

### Paso visible 2 - Resolver asignacion contable

La UX debe priorizar la seleccion de:

- plantilla contable;
- familia operativa;
- asiento tipo reutilizable;

antes que una experiencia de buscar cuentas sueltas, salvo casos avanzados o de rescate.

Ejemplos de nombres visibles:

- Venta plaza contado banco pesos
- Venta plaza credito dolares
- Compra gasto operativo
- Compra activo fijo

### Que puede pasar internamente

El sistema puede terminar resolviendo:

- regla ganadora;
- template;
- cuentas por rol;
- preview multi-linea;
- readiness fiscal.

Pero la UX no necesita mostrar ese motor completo de entrada.

## 9. Fast lane

Si el documento ya esta suficientemente resuelto y no hay blockers:

- mostrar confirmacion rapida;
- CTA principales: `Confirmar` y `Editar`;
- no obligar a un usuario experto a atravesar pasos que no agregan valor.

## 10. Settlement y posting multi-linea

Una factura no va a una cuenta.

El modelo correcto es:

- linea principal;
- contrapartida de cobro o pago, o cuenta a cobrar o pagar;
- linea fiscal;
- eventualmente settlement posterior.

Implicancia UX:

No disenar la UI como si siempre alcanzara con elegir una cuenta unica.

Regla importante:

Si el medio de cobro o pago no esta probado por el documento:

- no inventarlo;
- usar cuenta puente o dejar contexto pendiente;
- no vender falsa precision.

## 11. Aprendizaje visible pero separado

El usuario debe poder decidir:

- resolver solo este documento;
- guardar como criterio reusable.

La decision de aprendizaje no debe mezclarse con el posting principal como si fuera obligatoria.

## 12. Explainability y asistente

La explainability es obligatoria, pero debe estar bien dosificada.

### Mostrar en simple

- regla aplicada;
- fuente de resolucion;
- warning o blocker relevante;
- readiness de provisional y final.

### Colapsar o reservar para vista avanzada

- corridas tecnicas;
- threads internos;
- detalles de artefactos;
- semantica interna de tablas o flags.

### Asistente contable

Existe y puede ayudar, pero:

- no reemplaza la decision humana;
- no bypassa reglas;
- no debe dominar la UX simple.

## 13. Copy y CTAs oficiales

### Reviewer documental

- Guardar contexto documental
- Guardar y recalcular sugerencia
- Guardar cuentas seleccionadas
- Confirmar asignacion manual
- Recalcular clasificacion con este contexto
- Postear provisional
- Confirmar final
- Reabrir revision

### Tax

- Ver preview operativo
- Generar corrida oficial
- Reabrir corrida
- Exportar reporte

### Reglas de copy

- no usar `confirmar` para un simple save;
- no usar `final` para un recalculo;
- un boton deshabilitado debe tener motivo visible;
- no usar `conciliacion DGI` como si fuera filing automatico completo;
- `IVA` es correcto como label mobile; `Impuestos` puede usarse en vistas mas amplias.

## 14. Componentes y modulos que mandan en esta capa

### Componentes

- `components/dashboard/private-dashboard-shell.tsx`
- `components/dashboard/organization-work-center.tsx`
- `components/documents/document-review-queue.tsx`
- `components/documents/document-review-workspace.tsx`
- `components/documents/document-review-staged-workspace.tsx`
- `components/documents/document-accounting-assistant-rail.tsx`
- `components/documents/accounting-impact-preview.tsx`
- `components/documents/rule-application-card.tsx`
- `components/documents/upload-dropzone.tsx`
- `components/audit/document-audit-upload-panel.tsx`
- `components/audit/document-audit-preview-workspace.tsx`
- `components/mobile/mobile-wizard.tsx`
- `components/mobile/accounting-template-card.tsx`
- `components/mobile/status-badge.tsx`
- `components/mobile/cta-button.tsx`

### Modulos

- `modules/documents/upload.ts`
- `modules/documents/processing.ts`
- `modules/documents/review.ts`
- `modules/documents/review-queue.ts`
- `modules/documents/workflow-state.ts`
- `modules/documents/post-provisional-service.ts`
- `modules/documents/confirm-final-service.ts`
- `modules/documents/reopen-remap-service.ts`
- `modules/accounting/classification-runner.ts`
- `modules/accounting/learning-approval-service.ts`
- `modules/assistant/document-assistant.ts`

## 15. Estado actual del rollout UX

Estado implementado hoy:

- shell privado mobile-first con header compacto y bottom nav;
- home con resumen, CTAs y alertas;
- review queue con buckets accionables;
- reviewer mobile con fast lane y wizard de 2 pasos;
- acceso contextual a superficies expertas desde desktop y hub avanzado.

Estado parcial o a seguir afinando:

- homogenizacion visual de todas las superficies expertas en mobile;
- consistencia completa de copy y contraste en vistas legacy;
- unificacion de explainability en todas las pantallas de soporte.
