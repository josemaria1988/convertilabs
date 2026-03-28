# Convertilabs — Spec de refactor UX/UI guiado por flujo

**Estado actualizado:** Implementacion base realizada en el repo al `2026-03-28`.

- `dashboard` ya funciona como `Inicio`.
- `documents` quedo enfocado en ingreso documental.
- existe `/review` como cola principal.
- `audit` se presenta como `Importacion masiva`.
- `settings` quedo organizado por tabs.
- las superficies expertas se agrupan en `Avanzado`.
- el reviewer actual fue reordenado como flujo guiado, con rail opcional y mas detalle tecnico colapsado.

**Documento:** `convertilabs-ux-ui-spec-driven-refactor.md`  
**Versión:** 1.0  
**Fecha:** 2026-03-28  
**Estado:** Base implemented, seguir refinando polish y microinteracciones  
**Audiencia:** Codex, desarrollo frontend/backend, producto, QA  
**Lenguaje de implementación:** Next.js App Router + React + TypeScript + Supabase  

---

## 1. Propósito del documento

Este documento define, con nivel de detalle de **spec-driven development**, el refactor UX/UI necesario para que Convertilabs pase de ser una consola operativa densa a un **producto guiado, entendible y usable por un contador piloto sin entrenamiento intensivo**.

El objetivo no es reescribir el motor de negocio. El objetivo es **reordenar la experiencia** para que el sistema:

1. guíe al usuario paso a paso;
2. muestre solo la información necesaria para la próxima decisión;
3. separe claramente ingreso, revisión, impuestos, cierre y configuración;
4. deje las superficies expertas fuera del flujo principal;
5. reduzca la sensación actual de “no sé qué hacer ahora”.

Este documento asume como base el estado real del repo, las rutas activas, el workflow documental ya existente, el reviewer actual, la navegación privada actual, los módulos de VAT/cierre y las capturas de UI provistas.

---

## 2. Fuentes de verdad usadas para esta spec

### 2.1 Documentación funcional y técnica vigente

- `README.md`
- `00-foundations/00-vision-rectora-v1.md`
- `00-foundations/01-mapa-del-repo-y-rutas.md`
- `01-identity/auth-tenancy-and-memberships.md`
- `02-organization/business-profile-onboarding-and-settings.md`
- `03-accounting/chart-presets-and-plan-management.md`
- `03-accounting/hybrid-ai-preset-recommendation.md`
- `04-documents/01-document-intake-and-processing.md`
- `04-documents/02-document-review-classification-and-posting.md`
- `06-integrations/spreadsheets-imports-exports-and-bridge.md`
- `07-platform/database-api-background-jobs-and-observability.md`
- `08-quality/testing-rollout-and-roadmap.md`

### 2.2 Superficies actuales del repo inspeccionadas

- `modules/organizations/private-nav.ts`
- `app/app/o/[slug]/dashboard/page.tsx`
- `app/app/o/[slug]/documents/page.tsx`
- `components/documents/documents-workspace-table.tsx`
- `components/documents/upload-dropzone.tsx`
- `app/app/o/[slug]/documents/[documentId]/page.tsx`
- `components/documents/document-review-staged-workspace.tsx`
- `app/app/o/[slug]/audit/page.tsx`
- `components/audit/document-audit-preview-workspace.tsx`
- `app/app/o/[slug]/close/page.tsx`
- `app/app/o/[slug]/tax/page.tsx`
- `app/app/o/[slug]/tax/tax-period-workbench.tsx`
- `app/app/o/[slug]/trial-balance/page.tsx`
- `app/app/o/[slug]/chart-map/page.tsx`
- `app/app/o/[slug]/rules/page.tsx`
- `app/app/o/[slug]/settings/page.tsx`

### 2.3 Observación directa de UI actual

Las capturas actuales muestran un patrón repetido:

- demasiadas tarjetas KPI visibles al mismo tiempo;
- demasiados botones con la misma jerarquía visual;
- mezcla de input, revisión, soporte, auditoría y reporting en una sola vista;
- tablas densas con demasiadas columnas y microestados;
- sidebars con mucho contenido secundario visible de entrada;
- falta de un “siguiente paso” inequívoco.

---

## 3. Diagnóstico del problema actual

### 3.1 Problema principal

Convertilabs ya tiene un motor razonablemente bien separado a nivel de dominio, pero la UX actual **expone la arquitectura interna** en lugar de exponer el trabajo operativo del usuario.

El sistema sabe distinguir:

- intake;
- extracción;
- draft persistido;
- revisión factual;
- clasificación contable;
- contexto manual;
- aprendizaje;
- posting provisional;
- posting final;
- VAT preview;
- VAT run;
- export.

Pero la UI no convierte eso en una experiencia progresiva. En muchas pantallas, todo aparece junto.

### 3.2 Síntomas concretos

1. El usuario entra y no tiene un verdadero centro de trabajo.
2. `dashboard` redirige a `documents`, lo que elimina el punto de orientación inicial.
3. `documents` mezcla carga, filtros, estados, operaciones internacionales, pendientes, aprendizaje visible, FX faltante, paginación y revisión.
4. El reviewer documental ya tiene “etapas” en código, pero visualmente sigue siendo una página larga con demasiadas secciones visibles a la vez.
5. `tax` mezcla workbench fiscal, preview, lifecycle, export, historia, resumen DGI y alertas en una sola pantalla.
6. `settings` concentra demasiadas capacidades para un solo contexto mental.
7. Las superficies expertas (`chart-map`, `rules`, partes de `trial-balance`) compiten visualmente con el flujo principal.
8. El lenguaje visible aún contiene demasiada jerga interna.

### 3.3 Impacto sobre el piloto

Para un contador piloto, la experiencia actual tiene estos riesgos:

- sensación de producto “difícil de aprender”;
- dudas sobre cuál es el orden correcto de uso;
- miedo a tocar botones incorrectos;
- abandono temprano por sobrecarga cognitiva;
- dificultad para generar feedback útil, porque el usuario no entiende el flujo esperado.

---

## 4. Decisión de producto

### 4.1 North star UX

Convertilabs debe sentirse como un sistema que responde esta pregunta en cada momento:

> “¿Qué tengo que hacer ahora?”

Y no como un sistema que obliga al usuario a descubrir manualmente:

> “¿Cuál de todas estas pantallas, botones, tarjetas y tablas se supone que debo usar?”

### 4.2 Decisión central

Se adopta una arquitectura de UX basada en **flujo guiado**.

La estructura funcional target será:

- **Inicio**: centro de trabajo y estado general.
- **Documentos**: solo ingreso documental.
- **Revisión**: cola operativa de decisiones pendientes.
- **Impuestos**: flujo guiado por período.
- **Cierre**: flujo guiado de validación y transición.
- **Configuración**: preparación del sistema.
- **Avanzado**: superficies expertas y de inspección.

### 4.3 Decisión operativa clave

**Documentos deja de ser la bandeja de revisión.**

Documentos pasa a ser exclusivamente el lugar donde el usuario:

- sube archivos originales;
- ve el resultado inmediato de la carga;
- puede saltar a revisión.

La revisión diaria pasa a una superficie separada: **Revisión**.

---

## 5. Objetivos

## 5.1 Objetivos funcionales

1. Hacer obvio el orden de uso del sistema.
2. Reducir la cantidad de información visible por pantalla.
3. Separar claramente “ingresar”, “decidir”, “liquidar” y “cerrar”.
4. Permitir revisión uno a uno y revisión por lote.
5. Hacer visible la diferencia entre:
   - resolver un documento;
   - guardar una regla reusable.
6. Mantener intacta la trazabilidad y el motor contable/fiscal.

## 5.2 Objetivos UX

1. Una sola acción primaria por pantalla.
2. Una sola decisión principal por paso.
3. Todo detalle técnico va detrás de expansión o acción secundaria.
4. El usuario siempre debe ver un siguiente paso claro.
5. Los estados bloqueantes deben explicarse en lenguaje operativo, no técnico.

## 5.3 Objetivos de implementación

1. Reusar al máximo server actions y dominio existentes.
2. Minimizar cambios de schema en las primeras fases.
3. Introducir la nueva UX mediante feature flags cuando convenga.
4. Evitar romper rutas viejas mientras se migra la navegación.

---

## 6. No objetivos

No entra en este refactor:

1. Reescribir el rule engine.
2. Reescribir VAT engine.
3. Cambiar la semántica de posting provisional/final.
4. Cambiar el esquema histórico de auditoría.
5. Implementar módulos nuevos de stock, payroll o centros de costo productivos.
6. Eliminar las superficies expertas; solo se las reubica y simplifica visualmente.

---

## 7. Principios de diseño obligatorios

## 7.1 Mostrar solo lo necesario para la próxima decisión

No mostrar en la misma vista:

- input;
- explicación técnica extensa;
- historial;
- reporting;
- acciones masivas;
- detalles avanzados;
- preview completo;
- navegación cruzada;

salvo que la pantalla esté específicamente diseñada para eso.

## 7.2 Una sola acción primaria por contexto

Cada pantalla y cada paso debe tener exactamente:

- **1 acción primaria**;
- **0 o 1 acciones secundarias visibles**;
- resto de acciones dentro de menús, accordions o estado contextual.

## 7.3 Progresive disclosure

Todo contenido experto o técnico debe estar detrás de:

- `Accordion`
- `Ver detalle`
- `Más opciones`
- `Modo avanzado`
- drawers laterales opcionales
- tabs secundarias

## 7.4 Los modales no reemplazan workflows completos

Los modales se usan solo para:

- confirmar decisiones cortas;
- editar un dato puntual;
- crear una cuenta puntual;
- resolver duplicado;
- elegir si aplicar a lote o a este documento.

No usar modal para un flujo completo de 5 pasos.

## 7.5 El lenguaje debe hablar de trabajo, no de arquitectura

Evitar como copy primaria:

- pending assignment
- read model
- kernel
- lifecycle
- cockpit
- resolution source
- imports assisted
- decision source
- canonical state

Usar en cambio:

- Pendientes de revisión
- Listos para registrar
- Bloqueados
- Estado del período
- Próximo paso
- Cómo se resolvió

## 7.6 La trazabilidad no desaparece, pero deja de dominar la primera capa

Toda trazabilidad actual sigue existiendo, pero:

- no debe ser lo primero que ve el usuario;
- no debe competir con la acción principal;
- debe aparecer como detalle expandible.

---

## 8. Arquitectura de información target

## 8.1 Navegación primaria target

La navegación privada principal debe pasar a:

1. **Inicio**
2. **Documentos**
3. **Revisión**
4. **Impuestos**
5. **Cierre**
6. **Configuración**
7. **Avanzado**

## 8.2 Contenido de “Avanzado”

Dentro de Avanzado deben vivir:

- Contabilidad
- Importación masiva (antes Auditoría)
- Mapa contable
- Reglas contables
- Exportaciones / bridge
- otras superficies expertas futuras

## 8.3 Rutas target

### 8.3.1 Rutas primarias

- `/app/o/[slug]/dashboard` → **Inicio**
- `/app/o/[slug]/documents` → **Documentos**
- `/app/o/[slug]/review` → **Revisión**
- `/app/o/[slug]/tax` → **Impuestos**
- `/app/o/[slug]/close` → **Cierre**
- `/app/o/[slug]/settings` → **Configuración**

### 8.3.2 Rutas expertas / avanzadas

- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/audit` (renombrada visualmente a “Importación masiva”)
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/rules`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/imports`

### 8.3.3 Rutas de revisión documental

Short-term para minimizar riesgo:

- se **mantiene** `/app/o/[slug]/documents/[documentId]` como route funcional;
- se accede a esa ruta desde la nueva cola `/review`;
- opcionalmente se puede agregar alias posterior `/review/[documentId]`.

## 8.4 Política de redirect

### Regla obligatoria

`/app/o/[slug]/dashboard` deja de redirigir a `/documents`.

### Nuevo comportamiento

Debe renderizar una página real de Inicio / Centro de trabajo.

---

## 9. Diccionario de estados UX

## 9.1 Objetivo

No exponer directamente todos los estados técnicos heredados del dominio en la capa principal.

## 9.2 Estados visibles al usuario en la cola de Revisión

La cola principal debe usar estas categorías visibles:

1. **Procesando**
2. **Pendientes de revisión**
3. **Bloqueados**
4. **Listos para provisional**
5. **Listos para final**
6. **Finalizados**

## 9.3 Submotivos bloqueantes visibles

Dentro de “Bloqueados” mostrar chips o tags de motivo:

- Duplicado
- Falta cotización
- Fuera de alcance automático
- Requiere revisión manual
- Importación asistida

## 9.4 Mapping técnico sugerido

Sin cambiar schema inicialmente, la capa de view-model debe mapear estados actuales a labels UX.

### Mapping sugerido

- `uploaded`, `queued`, `extracting`, `processing` → **Procesando**
- `pending_factual_review`, `pending_assignment`, `pending_learning_decision`, `reopened_needs_manual_remap`, `needs_review` → **Pendientes de revisión**
- `blocked_duplicate`, `blocked_missing_fx`, `blocked_scope` y flags equivalentes → **Bloqueados**
- `ready_for_provisional_posting`, `ready_provisional` → **Listos para provisional**
- `ready_for_final_confirmation`, `ready_final`, `posted_provisional_pending_final` → **Listos para final**
- `posted_final`, `approved`, `locked` → **Finalizados**

### Regla

Este mapping debe implementarse en view-model, no como migración destructiva del dominio en la primera fase.

---

## 10. Reglas globales de UI

## 10.1 Jerarquía de botones

### Primario

- color principal
- 1 por pantalla o paso
- representa la siguiente acción recomendada

### Secundario

- 0 o 1 visible en primera capa
- representa una alternativa razonable

### Ghost / texto

- solo para detalle, ayuda, ver original, volver, expandir

### Peligro

- solo para exclusiones, rechazos, borrar, cerrar definitivamente, bloquear

## 10.2 Tarjetas KPI

Regla:

- máximo **4 KPIs** visibles arriba en pantallas operativas primarias;
- cualquier KPI adicional va en sección secundaria o accordion.

## 10.3 Tablas

Regla:

- la tabla principal no puede exceder **6 columnas cognitivas** antes de obligar scroll horizontal;
- si hay más información, moverla a detalle por fila, drawer o segunda vista.

## 10.4 Sidebars

Regla:

- no mostrar sidebars densas por default si la pantalla ya tiene tabla + KPI + filtros;
- el detalle lateral debe abrirse on demand.

## 10.5 Filtros

Regla:

- filtros mínimos visibles por defecto;
- filtros avanzados dentro de `Más filtros`.

## 10.6 Empty states

Cada pantalla debe tener empty state explícito con:

- qué significa el vacío;
- cuál es la acción siguiente;
- un CTA claro.

## 10.7 Error states

Cada pantalla debe tener:

- mensaje entendible;
- botón de reintentar;
- si aplica, link al lugar correcto para resolver el problema.

## 10.8 Guardado

Regla:

- cada paso guardable debe mostrar feedback inmediato;
- si el guardado recalcula algo, decirlo explícitamente;
- no refrescar sin feedback visible.

---

## 11. Spec por módulo

# 11.1 Inicio / Centro de trabajo

## 11.1.1 Problema actual

Hoy `dashboard` no existe como centro de trabajo; redirige a `documents`.

## 11.1.2 Objetivo de la pantalla

Responder en 10 segundos:

- qué entró;
- qué quedó pendiente;
- qué hay que hacer hoy;
- cómo está el período.

## 11.1.3 Título visible

**Inicio**

Subtítulo:

> Estado general de la operación documental, fiscal y de cierre.

## 11.1.4 Layout

### Bloque A — resumen superior

Máximo 4 cards:

1. Documentos pendientes de revisión
2. Bloqueados
3. Neto IVA preview del mes actual
4. Estado del cierre del período actual

### Bloque B — tareas de hoy

Lista priorizada de tareas accionables, por ejemplo:

- Revisar 12 documentos pendientes
- Resolver 3 documentos sin cotización
- Confirmar 2 documentos listos para final
- Revisar IVA de marzo 2026
- Ejecutar validator de cierre

Cada fila con CTA único.

### Bloque C — actividad reciente

- últimos uploads
- últimas confirmaciones
- última corrida IVA
- último validator de cierre

### Bloque D — accesos operativos

Solo 3 botones:

- Cargar documentos
- Abrir revisión
- Abrir impuestos

## 11.1.5 Estados

### Empty state

Si la organización no tiene actividad aún:

- mostrar onboarding operativo corto:
  - “Sube tu primer documento”
  - “Configura tu perfil fiscal”
  - “Revisa el plan contable”

## 11.1.6 Aceptación

- el usuario entiende qué hacer sin entrar a otra pantalla para orientarse;
- no hay scroll largo obligatorio para la información principal;
- existe CTA directo hacia el próximo trabajo.

## 11.1.7 Implementación

### Archivos target

- `app/app/o/[slug]/dashboard/page.tsx`
- nuevo componente `components/dashboard/work-center-page.tsx`
- opcional `modules/dashboard/work-center.ts`

### Regla de implementación

No redirigir más.

---

# 11.2 Documentos = solo ingreso documental

## 11.2.1 Problema actual

La pantalla actual mezcla:

- carriles de trabajo;
- alcance operativo del MVP;
- filtros de bandeja;
- tabla operacional densa;
- paginación;
- upload panel;
- atajos a auditoría;
- pending assignment.

## 11.2.2 Objetivo de la pantalla

Que Documentos sea el lugar más simple del sistema:

> “Acá cargo documentos. Después el sistema me lleva a revisión.”

## 11.2.3 Título visible

**Documentos**

Subtítulo:

> Sube originales y envíalos a revisión.

## 11.2.4 Layout target

### Bloque A — upload principal

Gran dropzone con:

- drag & drop
- botón “Seleccionar archivos”
- toggle “Procesar automáticamente después de subir”
- límite por archivo
- tipos soportados

### Bloque B — resultado del último lote

Card resumen del último lote subido:

- X cargados
- X en procesamiento
- X listos para revisión
- X bloqueados

CTA primario:

- **Ir a revisión**

CTA secundario:

- Seguir cargando

### Bloque C — importación por planilla

No como módulo completo visible. Solo como acceso secundario:

- botón/link: **Importar por planilla**
- abre la superficie `/audit`, pero rotulada visualmente como “Importación masiva”

### Bloque D — últimos archivos subidos

Lista muy simple de últimos 5–10:

- nombre
- fecha
- estado resumido
- acción: ver en revisión / seguir procesando

No mostrar tabla densa con estados por etapa.

## 11.2.5 Lo que se elimina de esta pantalla

Eliminar de primera capa:

- filtros de bandeja;
- paginación operativa;
- tabla densa actual de documentos;
- aprendizaje visible;
- reintento de tasas BCU;
- carril internacional como tab visible de primera capa;
- panel “alcance operativo del MVP”.

## 11.2.6 Política sobre internacional

No exponer “Operaciones internacionales” como tab grande en la primera versión de esta UX.

Opciones permitidas:

- mover a “Avanzado”; o
- dejar como CTA secundaria “Operaciones internacionales” dentro de Documentos.

No debe competir visualmente con el flujo principal.

## 11.2.7 After upload behavior obligatorio

Cuando termina una carga:

- mostrar un resumen de lote con conteos claros;
- no redirigir automáticamente sin contexto;
- ofrecer CTA principal “Ir a revisión”.

### Copy sugerido

> Se subieron 18 documentos. 12 ya están listos para revisión, 4 siguen procesándose y 2 quedaron bloqueados.

## 11.2.8 Aceptación

- un usuario nuevo puede subir documentos sin ver una bandeja compleja;
- la pantalla no requiere entender estados avanzados;
- existe un puente obvio hacia Revisión.

## 11.2.9 Implementación

### Archivos target

- `app/app/o/[slug]/documents/page.tsx`
- `components/documents/upload-dropzone.tsx`
- dejar de renderizar `DocumentsWorkspaceTable` en esta ruta

### Restricción

No romper el upload ni la cola actual de extracción.

---

# 11.3 Revisión = cola operativa principal

## 11.3.1 Decisión

Crear una nueva superficie:

- `/app/o/[slug]/review`

Esta es la nueva bandeja principal de trabajo diario.

## 11.3.2 Objetivo de la pantalla

Mostrar solo lo que requiere una decisión humana o una confirmación operativa.

## 11.3.3 Título visible

**Revisión**

Subtítulo:

> Documentos que necesitan una decisión para avanzar.

## 11.3.4 Layout target

### Bloque A — resumen corto

Máximo 4 cards:

1. Pendientes de revisión
2. Bloqueados
3. Listos para provisional
4. Listos para final

### Bloque B — tabs/categorías simples

Tabs visibles:

- Todos
- Pendientes
- Bloqueados
- Listos para provisional
- Listos para final
- Finalizados

No mostrar de entrada todos los microestados técnicos.

### Bloque C — filtros mínimos

Visibles por defecto:

- Dirección: compras / ventas / todos
- Buscar: proveedor, número, archivo

Dentro de “Más filtros”:

- duplicados
- FX faltante
- importación asistida
- baja confianza
- período

### Bloque D — lista o tabla simplificada

Campos visibles por fila:

1. Documento
2. Contraparte
3. Estado resumido
4. Próximo paso
5. Monto
6. Acción principal

No mostrar simultáneamente:

- 3 estados por etapa
- fuente de decisión
- confidence pill + porcentaje + flags + blockers largos + dos acciones por fila

Todo eso va al detalle.

## 11.3.5 Diseño de fila target

Cada fila debe responder:

- qué documento es;
- quién es la contraparte;
- qué le falta;
- qué botón tengo que tocar.

### Ejemplo de fila

- `A-6411 — Julio Bradford`
- `Venta · USD 96 · 2026-03-12`
- `Bloqueado por cotización`
- `Próximo paso: resolver cotización o revisar manualmente`
- botón: `Abrir revisión`

## 11.3.6 Bulk actions

Las acciones masivas visibles deben ser solo:

- Abrir lote
- Reaplicar criterios
- Confirmar seleccionados
- Excluir seleccionados

Acciones más peligrosas o menos frecuentes deben quedar fuera de primera capa.

## 11.3.7 Lotes por similitud

La cola debe poder sugerir lotes automáticos cuando varios documentos comparten:

- misma contraparte normalizada;
- mismo rol documental;
- mismo tipo documental;
- misma moneda;
- misma categoría operativa sugerida.

### Output UX

Mostrar banners o agrupadores tipo:

> 9 documentos similares de Panadería El León pueden resolverse como lote.

Botón:

- **Revisar lote**

## 11.3.8 Acceso al reviewer

CTA principal por fila:

- **Abrir revisión**

Short-term puede seguir apuntando a `/documents/[documentId]`.

## 11.3.9 Aceptación

- el usuario entiende que esta es su verdadera bandeja de trabajo;
- cada fila tiene un siguiente paso claro;
- la densidad visual es mucho menor que la tabla actual.

## 11.3.10 Implementación

### Archivos target

- nuevo `app/app/o/[slug]/review/page.tsx`
- nuevo `components/review/review-queue-page.tsx`
- nuevo `components/review/review-queue-list.tsx`
- opcional reutilización/refactor de `components/documents/documents-workspace-table.tsx`
- nueva capa `modules/review/review-queue.ts` o equivalente

### Restricción

No cambiar la semántica del workflow state existente en fase 1; solo derivar mejor view-model.

---

# 11.4 Reviewer documental = wizard real

## 11.4.1 Problema actual

El reviewer ya contiene lógica de etapas, pero visualmente sigue siendo una página larga y densa.

## 11.4.2 Decisión

Refactorizar el reviewer a un **wizard real de pasos**.

## 11.4.3 Objetivo del wizard

Hacer que revisar un documento sea equivalente a responder una secuencia pequeña de preguntas.

## 11.4.4 Ruta

Short-term:

- mantener `/app/o/[slug]/documents/[documentId]`

Long-term opcional:

- agregar alias `/app/o/[slug]/review/[documentId]`

## 11.4.5 Layout target del wizard

### Header fijo

Mostrar siempre:

- nombre del archivo
- contraparte
- fecha
- total
- estado resumido
- paso actual / total de pasos

### Columna principal

- solo el paso actual

### Columna secundaria opcional

- original / preview del documento
- visible por toggle “Ver original” o panel lateral colapsable

### Footer fijo

Botones consistentes:

- Atrás
- Guardar borrador (cuando aplique)
- Siguiente / Confirmar paso

## 11.4.6 Estructura de pasos target

### Paso 1 — Validar datos mínimos

#### Objetivo

Confirmar que el documento está mínimamente bien entendido.

#### Mostrar

- emisor / contraparte
- número
- fecha
- moneda
- subtotal
- IVA
- total
- ver original

#### Permitir

- corregir datos extraídos

#### CTA primario

- **Guardar y siguiente**

#### CTA secundario

- Ver detalle técnico

#### Regla

No mostrar preview contable todavía.

---

### Paso 2 — Entender la operación

#### Objetivo

Resolver la naturaleza económica del documento.

#### Pedir

- compra / venta / otro
- tipo documental
- categoría operativa
- factura / nota de crédito / recibo / pago / cobranza
- contado / crédito
- medio de cobro/pago si aplica
- propósito empresarial solo si el caso lo requiere

#### CTA primario

- **Guardar contexto y siguiente**

#### Resultado esperado

El sistema recalcula template y sugerencia contable/fiscal con mejor contexto.

---

### Paso 3 — Elegir cómo clasificar

#### Objetivo

Hacer explícita la decisión que hoy está implícita o dispersa.

#### Pregunta central

> ¿Cómo querés resolver este documento?

#### Opciones visibles

1. **Usar criterio sugerido/existente**
2. **Resolver manualmente este documento**
3. **Resolver este documento y luego guardar un criterio nuevo para similares**

#### Regla UX

No crear una regla inmediatamente al elegir la tercera opción.

La tercera opción significa:

- primero resolver este documento;
- luego, en el paso de aprendizaje, decidir alcance reusable.

#### CTA primario

- **Aplicar y siguiente**

---

### Paso 4 — Ver impacto contable y fiscal

#### Objetivo

Mostrar el resultado real de la decisión.

#### Mostrar

- cuenta principal resuelta
- cuentas por rol si aplica
- preview Debe/Haber
- preview IVA
- warnings/blockers
- tipo de cambio aplicado si corresponde
- motivo principal de bloqueo si existe

#### Acciones permitidas

- cambiar cuenta principal
- abrir modo avanzado de asignación por roles
- crear cuenta nueva puntual
- ir al mapa contable (acción secundaria, no dominante)

#### CTA primario

- **Confirmar asignación y siguiente**

#### CTA secundaria

- Ajustar manualmente

---

### Paso 5 — Decidir aprendizaje

#### Objetivo

Separar claramente:

- resolver este documento;
- enseñar un criterio reusable al sistema.

#### Mostrar opciones de alcance

- No guardar criterio reusable
- Guardar para proveedor + concepto + categoría
- Guardar para proveedor + concepto
- Guardar por concepto global
- Guardar default por proveedor
- Override solo de este documento

#### Mostrar campo opcional

- nombre canónico del criterio

#### CTA primario

- **Guardar decisión y siguiente**

#### Regla

Si el usuario no quiere crear regla, debe poder seguir igual.

---

### Paso 6 — Cerrar documento

#### Objetivo

Mostrar solo las acciones finales viables.

#### Mostrar

- checklist resumido de readiness
- blockers restantes
- estado de provisional
- estado de final

#### CTA primario condicionado

- **Registrar provisional** si solo está listo para provisional
- **Confirmar final** si está listo para final

#### CTA secundaria

- Reabrir / Volver atrás

#### Regla

No mostrar 5 CTAs equivalentes de cierre juntos.

---

## 11.4.7 Modales permitidos dentro del wizard

Solo se permiten estos modales:

1. **Resolver duplicado**
2. **Crear cuenta nueva puntual**
3. **Aplicar esta decisión al lote**
4. **Ver original**
5. **Confirmar exclusión**

No abrir modales de workflow largo.

## 11.4.8 Política de “modo avanzado”

Debe existir un modo avanzado colapsado para:

- corrección completa de facts;
- asignación por roles múltiples;
- assistant rail;
- texto extraído;
- detalle técnico;
- reasoning / explicabilidad extensa.

Pero jamás visible completo de entrada.

## 11.4.9 Assistant rail

El rail del asistente debe pasar a ser:

- colapsado por default;
- accesible como panel lateral o drawer;
- abierto manualmente con “Ver ayuda del asistente”.

No debe competir con la secuencia principal del wizard.

## 11.4.10 Duplicados

Si el documento es posible duplicado:

- interrumpir el flujo con paso/bloque prioritario corto;
- pedir una decisión explícita;
- luego retomar wizard.

No mostrar duplicados como bloque más dentro de una pantalla kilométrica.

## 11.4.11 Regla de persistencia

Cada paso del wizard debe:

- poder guardarse como borrador;
- refrescar el view-model si recalcula algo;
- mantener la revisión actual sin perder contexto.

## 11.4.12 Aceptación

- en ningún paso el usuario ve más de una decisión principal a la vez;
- el reviewer completo ya no se siente como una pantalla infinita;
- sigue existiendo trazabilidad total;
- se puede resolver un documento sin entrar a detalle avanzado.

## 11.4.13 Implementación

### Archivos target

- `app/app/o/[slug]/documents/[documentId]/page.tsx`
- `components/documents/document-review-staged-workspace.tsx`

### Refactor esperado

Extraer componentes por paso, por ejemplo:

- `document-review-wizard.tsx`
- `review-step-validate-minimum.tsx`
- `review-step-operation-context.tsx`
- `review-step-classification-choice.tsx`
- `review-step-impact-preview.tsx`
- `review-step-learning.tsx`
- `review-step-close.tsx`

### Restricción fuerte

No romper server actions actuales; envolverlas en el nuevo wizard.

---

# 11.5 Revisión por lote

## 11.5.1 Objetivo

Permitir acelerar trabajo sin sacrificar control.

## 11.5.2 Regla

El lote no es “confirmar todo a ciegas”.

El lote es:

- tomar una decisión representativa;
- aplicarla a documentos suficientemente similares;
- permitir guardar además criterio reusable si corresponde.

## 11.5.3 Trigger de lote

Se habilita cuando el usuario selecciona varios documentos o entra a un cluster sugerido.

## 11.5.4 Layout del flujo de lote

### Paso 1

Mostrar resumen del lote:

- cuántos documentos
- contraparte/s
- moneda/s
- rangos de fecha
- posibles diferencias relevantes

### Paso 2

Mostrar documento representativo y preguntar:

> ¿Querés aplicar esta decisión solo a este documento o al lote similar?

Opciones:

- Solo este documento
- Todo el lote seleccionado
- Todo el lote y guardar criterio reusable

### Paso 3

Preview del impacto agregado:

- cuántos quedarían listos
- cuántos seguirían bloqueados

### Paso 4

Confirmar aplicación al lote

## 11.5.5 Reglas de seguridad

No permitir batch ciego si el lote mezcla:

- múltiples contrapartes no equivalentes;
- diferentes monedas;
- diferentes tipos documentales;
- diferentes roles compra/venta;
- diferentes categorías operativas sugeridas.

## 11.5.6 Aceptación

- el lote acelera trabajo real;
- no degrada control contable/fiscal;
- la UI deja claro el alcance de la acción.

---

# 11.6 Importación masiva (antes Auditoría)

## 11.6.1 Decisión

La superficie `/audit` se mantiene técnicamente, pero cambia su nombre visible a:

- **Importación masiva** o
- **Lotes por planilla**

Se recomienda **Importación masiva**.

## 11.6.2 Problema actual

La pantalla mezcla upload, histórico y preview masivo en paralelo.

## 11.6.3 Objetivo

Guiar el usuario en 4 pasos:

1. subir planilla;
2. ver detección;
3. resolver excepciones;
4. materializar.

## 11.6.4 Layout target

### Paso 1 — Subir planilla

- tipo: compras / ventas
- formatos soportados
- límite operativo
- CTA: Subir planilla

### Paso 2 — Resumen de detección

Mostrar primero, antes de la tabla completa:

- documentos detectados
- filas con problema
- rango de fechas
- monedas
- posibles warnings fuertes

CTA primario:

- **Revisar excepciones**

### Paso 3 — Excepciones

Mostrar por default solo:

- pendientes
- failed
- warnings relevantes

No mostrar 100% de las filas aceptadas abiertas de entrada.

CTA primario:

- **Aceptar seleccionados y materializar**

CTA secundaria:

- Rechazar seleccionados

### Paso 4 — Resultado

Mostrar:

- X documentos creados
- X pendientes de revisión
- CTA: Ir a revisión

## 11.6.5 Histórico

Mover el histórico a sección secundaria o tab “Historial”.

No debe dominar la primera pantalla del flujo.

## 11.6.6 Aceptación

- un usuario entiende que esto es un flujo de batch import, no auditoría contable general;
- el foco está en materializar correctamente, no en mostrar toda la historia antes de tiempo.

## 11.6.7 Implementación

### Archivos target

- `app/app/o/[slug]/audit/page.tsx`
- `components/audit/document-audit-preview-workspace.tsx`
- `components/audit/document-audit-upload-panel.tsx`

---

# 11.7 Impuestos = flujo guiado por período

## 11.7.1 Problema actual

La pantalla actual mezcla demasiadas capas al mismo tiempo:

- selector de período
- KPIs
- workbench fiscal
- preview/run
- acciones de lifecycle
- historia
- DGI summary
- alertas
- estado lateral
- exportación

## 11.7.2 Objetivo

Que Impuestos sea un flujo secuencial:

1. elegir período;
2. resolver pendientes del período;
3. ver preview;
4. generar definitivo;
5. exportar / bloquear / reabrir.

## 11.7.3 Layout target

### Bloque A — selector de período

Minimalista:

- año
- mes
- estado del período

### Bloque B — resumen del período

Máximo 4 KPIs:

1. Débito fiscal
2. Crédito fiscal
3. Neto IVA
4. Pendientes del período

### Bloque C — paso actual

Step navigation visible:

1. Período
2. Pendientes
3. Preview
4. Definitivo
5. Exportación

## 11.7.4 Paso 1 — Período

- seleccionar mes
- ver estado general
- CTA: Abrir período

## 11.7.5 Paso 2 — Pendientes

Usar una bandeja simplificada del workbench fiscal.

Mostrar por default solo:

- pendientes de revisión fiscal
- excluidos
- FX faltante
- sin posting suficiente
- bloqueados

Ocultar por default:

- métricas excesivas;
- drawer técnico abierto;
- acciones avanzadas en masa demasiado numerosas.

CTA primario:

- **Resolver pendientes**

## 11.7.6 Paso 3 — Preview

Mostrar:

- débito
- crédito
- no deducible
- neto
- resumen de incluidos/excluidos

CTA primario:

- **Generar IVA definitivo**

## 11.7.7 Paso 4 — Definitivo

Solo si existe run.

Mostrar:

- estado del run
- fecha de generación
- diferencias contra preview actual

CTA primario:

- **Finalizar período** o **Exportar** según el estado

## 11.7.8 Paso 5 — Exportación y cierre fiscal

Solo cuando ya existe corrida.

Mostrar:

- export DGI
- export reporte
- bloquear
- reabrir con motivo

## 11.7.9 Elementos a mover a capa secundaria

- historia de declaraciones
- históricos importados
- resumen DGI detallado
- alertas de conciliación extensas

Estos deben estar en tabs secundarias o accordions:

- `Historial`
- `DGI`
- `Diferencias`

## 11.7.10 Aceptación

- el usuario entiende el orden del trabajo del período;
- la pantalla ya no parece una mezcla de cockpit + workbench + reporte + bridge;
- lo histórico aparece cuando corresponde, no antes.

## 11.7.11 Implementación

### Archivos target

- `app/app/o/[slug]/tax/page.tsx`
- `app/app/o/[slug]/tax/tax-period-workbench.tsx`
- `components/tax/vat-run-preview-card.tsx`

---

# 11.8 Cierre = validar y transicionar

## 11.8.1 Precondición crítica

Antes del refactor UX, la pantalla de cierre debe dejar de fallar.

### Requisito bloqueante

Si `/close` hoy arroja excepción server-side, eso se arregla antes de abrir piloto.

## 11.8.2 Objetivo

Que Cierre sea comprensible como flujo:

1. elegir período;
2. correr validator;
3. ver blockers agrupados;
4. resolver o documentar warnings;
5. ejecutar transición de estado.

## 11.8.3 Layout target

### Bloque A — período y estado

- período seleccionado
- estado actual
- CTA: cambiar período

### Bloque B — resultado del validator

Máximo 3 KPIs:

- blockers
- warnings
- asientos/documentos del período

### Bloque C — resultados agrupados

Agrupar checks por origen:

- Documentos
- Impuestos
- Contabilidad / open items
- Soporte / diferencias

No lista plana de checks indistinguibles.

### Bloque D — siguiente transición

Mostrar solo:

- próxima transición disponible
- por qué sí o por qué no
- CTA único de transición

## 11.8.4 Copy target

Evitar “cockpit de cierre” como copy principal.

Usar:

- **Cierre mensual**
- **Validator del período**
- **Próxima transición**
- **Bloqueos a resolver**

## 11.8.5 Acciones

CTA principal según estado:

- Ejecutar validator
- Marcar listo para cerrar
- Hacer soft close
- Bloquear período

No mostrar varias transiciones equivalentes al mismo tiempo sin jerarquía.

## 11.8.6 Aceptación

- el cierre deja de ser una pantalla “conceptualmente técnica”; pasa a ser una secuencia de validación;
- el usuario entiende qué bloquea el cierre y dónde resolverlo.

## 11.8.7 Implementación

### Archivos target

- `app/app/o/[slug]/close/page.tsx`

---

# 11.9 Contabilidad = inspección guiada, no wizard pesado

## 11.9.1 Decisión

Contabilidad sigue siendo una superficie read-only / de inspección.

No debe convertirse en wizard largo.

## 11.9.2 Objetivo

Responder rápidamente:

- ¿está balanceado el set visible?
- ¿qué cuenta debo mirar?
- ¿qué movimiento explica ese saldo?

## 11.9.3 Layout target

### Bloque A — filtros mínimos

- período
- fuente
- tipo de cuenta
- búsqueda

### Bloque B — resumen superior

Máximo 3 KPIs:

- debe
- haber
- diferencia

### Bloque C — tabla de cuentas

Simplificada y con selección clara.

### Bloque D — detalle de cuenta seleccionada

- saldo
- entradas
- mayor resumido

### Bloque E — modo avanzado opcional

- totales balance general
- estado de resultados
- otras agregaciones

## 11.9.4 Regla

No mostrar demasiadas tarjetas secundarias antes de que el usuario elija una cuenta.

## 11.9.5 Aceptación

- la pantalla se entiende como inspección, no como otra consola densa;
- el contador llega más rápido al mayor de la cuenta relevante.

## 11.9.6 Implementación

### Archivos target

- `app/app/o/[slug]/trial-balance/page.tsx`

---

# 11.10 Configuración = preparar el sistema, no mezclar todo

## 11.10.1 Problema actual

Settings concentra demasiadas funciones en una sola página larga:

- datos base
- email CFE
- business profile
- perfil fiscal
- snapshots
- historial
- plan de cuentas
- import/export
- atajos a otros módulos

## 11.10.2 Decisión

Refactorizar Settings a tabs o secciones principales.

## 11.10.3 Tabs target

1. **Empresa**
2. **Perfil fiscal**
3. **Plan contable**
4. **Integraciones**
5. **Avanzado**

## 11.10.4 Contenido por tab

### Empresa

- nombre
- país
- moneda
- locale
- identidad básica

### Perfil fiscal

- forma jurídica
- régimen tributario
- régimen IVA
- grupo DGI
- CFE
- dirección fiscal
- historia versionada

### Plan contable

- preset actual
- aplicar preset
- crear/editar cuentas
- importar plan
- cuentas provisionales

### Integraciones

- email CFE
- importación/exportación relacionada

### Avanzado

- snapshots
- historial técnico
- atajos expertos

## 11.10.5 Aceptación

- el usuario ya no recibe una intranet completa en una sola página;
- cada tab tiene un propósito claro.

## 11.10.6 Implementación

### Archivos target

- `app/app/o/[slug]/settings/page.tsx`

---

# 11.11 Mapa contable y reglas = superficies expertas

## 11.11.1 Decisión

Estas superficies no desaparecen, pero salen del flujo principal.

## 11.11.2 Regla de navegación

No deben estar en primera capa del piloto.

Se acceden desde:

- Avanzado
- links contextuales desde revisión cuando haga falta

## 11.11.3 Mapa contable

Debe seguir existiendo para:

- explicar impacto;
- navegar plan;
- entender documentos reales.

Pero no como entry point principal del usuario piloto.

## 11.11.4 Reglas contables

Debe seguir existiendo para:

- gobernanza;
- conflictos;
- simulación;
- lifecycle.

Pero no debe competir con el reviewer y la cola principal.

---

## 12. Copys y terminología obligatoria

## 12.1 Reemplazos obligatorios

| Copy actual/confuso | Copy target |
|---|---|
| Pending assignment | Pendientes de revisión |
| Cockpit de cierre | Cierre mensual |
| Read model | Vista contable / lectura contable |
| Kernel | Libro / contabilidad |
| Lifecycle | Estado |
| Imports assisted | Importación asistida |
| Resolution source | Cómo se resolvió |
| Operational bucket | Estado de trabajo |
| Draft ready | Listo para revisión |

## 12.2 Títulos recomendados

- Documentos
- Revisión
- Importación masiva
- Impuestos
- Cierre mensual
- Contabilidad
- Configuración
- Avanzado

## 12.3 CTAs recomendados

- Cargar documentos
- Ir a revisión
- Abrir revisión
- Guardar y siguiente
- Confirmar asignación
- Guardar criterio
- Registrar provisional
- Confirmar final
- Generar IVA definitivo
- Ejecutar validator

---

## 13. Restricciones de implementación para evitar errores

## 13.1 No tocar semántica de dominio en fases tempranas

En Fase 1 y Fase 2:

- no cambiar lógica de posting;
- no cambiar scopes del learning;
- no cambiar lógica de VAT;
- no cambiar semántica de reopen;
- no cambiar reglas de RLS.

## 13.2 Implementar view-model antes que migraciones

Cualquier simplificación de estados o labels debe hacerse primero como view-model.

## 13.3 Reusar server actions existentes

Siempre que sea posible, reusar:

- save draft review
- classify
- confirm manual assignment
- create account
- save learning rule
- post provisional
- confirm final
- reopen
- audit preview decisions
- tax workbench actions

## 13.4 Mantener rutas existentes funcionales

Aunque se agreguen nuevas rutas o navegación, las rutas viejas deben seguir funcionando durante la transición.

## 13.5 No usar service role en cliente

Toda nueva UX debe seguir patrón actual de seguridad.

---

## 14. Plan de implementación por fases

# Fase 0 — Estabilización mínima

## Objetivo

Eliminar blockers técnicos antes del refactor UX principal.

## Tareas

1. Arreglar error server-side de `/close`.
2. Verificar que reviewer actual no tenga paths muertos.
3. Verificar que upload + refresh de lista siga estable.
4. Verificar que el mapping de workflow state actual sea suficiente para la nueva cola.

## DoD

- Cierre no rompe;
- Documentos/reviewer siguen operativos;
- tests críticos verdes.

---

# Fase 1 — Nueva IA de navegación y centro de trabajo

## Objetivo

Cambiar la estructura visible del producto sin tocar aún el core del reviewer.

## Tareas

1. Reemplazar redirect de `/dashboard` por Inicio real.
2. Cambiar navegación principal.
3. Agregar `Revisión`.
4. Mover superficies expertas a `Avanzado`.
5. Simplificar `Documents` a input only.

## Archivos target

- `modules/organizations/private-nav.ts`
- `app/app/o/[slug]/dashboard/page.tsx`
- `app/app/o/[slug]/documents/page.tsx`
- nuevo `app/app/o/[slug]/review/page.tsx`
- nuevos componentes de Inicio y Revisión

## DoD

- el usuario tiene centro de trabajo;
- Documentos ya no es bandeja compleja;
- existe cola de revisión separada.

---

# Fase 2 — Reviewer wizard

## Objetivo

Convertir el reviewer documental en flujo real paso a paso.

## Tareas

1. Refactorizar `DocumentReviewStagedWorkspace` en wizard.
2. Ocultar assistant rail y técnico por default.
3. Implementar pasos 1 a 6.
4. Implementar modales puntuales.
5. Implementar aplicar a lote desde revisión.

## Archivos target

- `app/app/o/[slug]/documents/[documentId]/page.tsx`
- `components/documents/document-review-staged-workspace.tsx`
- nuevos componentes de pasos

## DoD

- el reviewer deja de ser pantalla infinita;
- un usuario puede resolver documento sin tocar modo avanzado.

---

# Fase 3 — Impuestos y Cierre guiados

## Objetivo

Secuenciar período fiscal y cierre.

## Tareas

1. Simplificar `tax` por pasos.
2. Reordenar workbench fiscal.
3. Mover historia/DGI a capa secundaria.
4. Simplificar `close` con validator agrupado y transición única visible.

## DoD

- períodos se trabajan secuencialmente;
- cierre se entiende como flujo.

---

# Fase 4 — Settings tabulado + Avanzado consolidado

## Objetivo

Cerrar la simplificación estructural.

## Tareas

1. Partir Settings en tabs.
2. Consolidar surfaces expertas en Avanzado.
3. Revisar copy completa del sistema.

## DoD

- configuración deja de ser una intranet densa;
- el menú principal queda limpio.

---

## 15. Guía archivo por archivo para Codex

# 15.1 `modules/organizations/private-nav.ts`

## Cambios

- reemplazar items actuales por nueva navegación primaria;
- agregar item `review`;
- remover `audit`, `trial-balance`, `chart-map`, `rules` de primera capa;
- agregar item `advanced` o un patrón de “Más / Avanzado”.

## Criterio

La navegación debe expresar flujo, no módulos técnicos.

---

# 15.2 `app/app/o/[slug]/dashboard/page.tsx`

## Cambios

- eliminar redirect;
- renderizar centro de trabajo SSR real;
- agregar consultas agregadas para pendientes, bloqueados, IVA actual, cierre.

## Restricción

No traer demasiada data pesada en primera render.

---

# 15.3 `app/app/o/[slug]/documents/page.tsx`

## Cambios

- remover `DocumentsWorkspaceTable` de esta ruta;
- remover filtros de bandeja;
- remover paginación operacional;
- dejar upload + resumen de último lote + CTA a review;
- mantener acceso secundario a importación masiva.

## Restricción

No romper `DocumentUploadDropzone`.

---

# 15.4 `components/documents/upload-dropzone.tsx`

## Cambios

- agregar estado post-upload amigable;
- agregar CTA `Ir a revisión`;
- agregar resumen de lote claro;
- mantener opción de auto extracción.

## Restricción

No cambiar semántica del upload pipeline.

---

# 15.5 `components/documents/documents-workspace-table.tsx`

## Cambios

- dejar de usar en `/documents`;
- refactorizar o clonar a un nuevo componente de cola de revisión;
- simplificar columnas;
- mostrar next best action de forma dominante.

---

# 15.6 `app/app/o/[slug]/documents/[documentId]/page.tsx`

## Cambios

- mantener server actions actuales;
- envolver reviewer en wizard real;
- ajustar title/description/copy a flujo guiado.

---

# 15.7 `components/documents/document-review-staged-workspace.tsx`

## Cambios

- partir en pasos;
- colapsar técnico;
- mover rail del asistente a panel opcional;
- controlar navegación `Atrás / Siguiente`;
- mantener guardado por pasos.

## Restricción fuerte

No romper:

- `saveDraftReviewAction`
- `confirmFinalDocumentAction`
- `confirmManualAssignmentAction`
- `createReviewAccountAction`
- `saveLearningRuleAction`
- `resolveDuplicateAction`
- `runClassificationAction`
- `reopenDocumentAction`
- `refreshAssistantAction`
- `resolveAssistantSuggestionAction`

---

# 15.8 `app/app/o/[slug]/audit/page.tsx`

## Cambios

- rename visual a Importación masiva;
- estructurar flujo en pasos;
- dejar histórico como tab o sección secundaria.

---

# 15.9 `components/audit/document-audit-preview-workspace.tsx`

## Cambios

- mostrar resumen de detección primero;
- filtrar excepciones primero;
- colapsar aceptados por default.

---

# 15.10 `app/app/o/[slug]/tax/page.tsx`

## Cambios

- stepper por período;
- reducir KPIs visibles;
- mover historia/DGI a secundario;
- jerarquizar CTA de definitivo.

---

# 15.11 `app/app/o/[slug]/tax/tax-period-workbench.tsx`

## Cambios

- simplificar workbench visible;
- dejar foco en pendientes;
- drawer y detalles solo on demand.

---

# 15.12 `app/app/o/[slug]/close/page.tsx`

## Cambios

- estabilizar;
- agrupar validator;
- mostrar transición única dominante.

---

# 15.13 `app/app/o/[slug]/trial-balance/page.tsx`

## Cambios

- reducir densidad;
- mantener lectura;
- esconder parte avanzada inicialmente.

---

# 15.14 `app/app/o/[slug]/settings/page.tsx`

## Cambios

- tabificar;
- mover atajos expertos a Avanzado;
- separar Empresa / Perfil fiscal / Plan contable / Integraciones / Avanzado.

---

## 16. Feature flags recomendadas

Si se quiere rollout gradual, crear flags como:

- `UI_WORK_CENTER_V1`
- `UI_DOCUMENTS_INPUT_ONLY_V1`
- `UI_REVIEW_QUEUE_V1`
- `UI_DOCUMENT_WIZARD_V2`
- `UI_TAX_GUIDED_FLOW_V1`
- `UI_CLOSE_GUIDED_FLOW_V1`
- `UI_SETTINGS_TABBED_V1`

## Regla

No es obligatorio usar todas. Pero si el refactor se hará por etapas, conviene poder activar por superficie.

---

## 17. QA y criterios de aceptación detallados

# 17.1 Inicio

- [ ] `dashboard` ya no redirige.
- [ ] existe CTA a Documentos, Revisión e Impuestos.
- [ ] se entiende qué hacer hoy en menos de 10 segundos.

# 17.2 Documentos

- [ ] subir archivos sigue funcionando.
- [ ] la pantalla ya no muestra bandeja compleja.
- [ ] después de subir existe CTA obvio a Revisión.

# 17.3 Revisión

- [ ] existe cola separada.
- [ ] cada fila muestra siguiente paso claro.
- [ ] los microestados técnicos no dominan la primera capa.

# 17.4 Reviewer wizard

- [ ] un documento puede resolverse paso a paso.
- [ ] no hay pantalla infinita con todo abierto.
- [ ] technical details están colapsados.
- [ ] assistant rail no interfiere con el flujo.
- [ ] el usuario distingue entre resolver y guardar criterio reusable.

# 17.5 Importación masiva

- [ ] la carga por planilla se entiende como flujo.
- [ ] se ven primero resumen y excepciones.
- [ ] el histórico no domina la pantalla.

# 17.6 Impuestos

- [ ] el período se trabaja secuencialmente.
- [ ] la pantalla no mezcla preview/historia/export/DGI sin jerarquía.
- [ ] el CTA principal del período es obvio.

# 17.7 Cierre

- [ ] la pantalla no rompe.
- [ ] se entiende qué bloquea el cierre.
- [ ] existe una siguiente transición clara.

# 17.8 Configuración

- [ ] settings queda organizada en tabs claras.
- [ ] el usuario no recibe una página gigantesca con todo mezclado.

---

## 18. Casos de prueba de usuario obligatorios

## Caso A — contador nuevo, primer día

1. entra al sistema;
2. llega a Inicio;
3. entiende que debe cargar documentos;
4. sube 5 PDFs;
5. ve resumen del lote;
6. va a Revisión;
7. abre un documento;
8. completa wizard;
9. registra provisional;
10. vuelve a cola.

**Resultado esperado:** no necesita descubrir manualmente el flujo.

## Caso B — usuario con 20 documentos similares

1. abre Revisión;
2. ve cluster sugerido;
3. entra a lote;
4. resuelve decisión representativa;
5. aplica al lote;
6. guarda criterio reusable.

**Resultado esperado:** acelera trabajo sin perder control.

## Caso C — período fiscal con pendientes

1. entra a Impuestos;
2. elige período;
3. ve pendientes;
4. resuelve dos documentos;
5. vuelve a preview;
6. genera definitivo.

**Resultado esperado:** entiende secuencia natural del período.

## Caso D — cierre mensual

1. entra a Cierre;
2. ejecuta validator;
3. ve blockers agrupados;
4. entiende que uno es documental y otro fiscal;
5. resuelve cada uno;
6. ejecuta transición.

**Resultado esperado:** el cierre se siente como una secuencia, no como una consola abstracta.

---

## 19. Riesgos y mitigaciones

## Riesgo 1 — romper demasiado de golpe

### Mitigación

- fasear;
- mantener rutas viejas;
- reusar server actions.

## Riesgo 2 — esconder demasiado detalle técnico

### Mitigación

- no eliminarlo;
- moverlo a acordeones, drawers y modo avanzado.

## Riesgo 3 — duplicar lógica existente

### Mitigación

- construir nuevos view-models y componentes sobre el dominio existente;
- no reimplementar motores.

## Riesgo 4 — lote demasiado agresivo

### Mitigación

- solo habilitar lotes cuando la similitud sea alta;
- pedir confirmación explícita de alcance.

---

## 20. Definition of Done global

El refactor se considera exitoso cuando se cumplan simultáneamente estas condiciones:

1. Un usuario nuevo entiende la secuencia principal del sistema sin explicación externa.
2. `Documentos` se percibe como pantalla de ingreso, no como bandeja compleja.
3. Existe una cola separada de `Revisión` que concentra el trabajo diario.
4. El reviewer documental funciona como wizard real.
5. `Impuestos` y `Cierre` se sienten como flujos guiados por período.
6. `Configuración` queda dividida por contexto.
7. Las superficies expertas dejan de competir con el flujo principal.
8. No se pierde trazabilidad ni capacidad técnica del sistema.

---

## 21. Resumen ejecutivo para Codex

### Implementar en este orden

1. Arreglar `/close`.
2. Convertir `/dashboard` en Inicio real.
3. Simplificar `/documents` a input only.
4. Crear `/review` como cola principal.
5. Refactorizar reviewer a wizard.
6. Simplificar `tax` por pasos.
7. Simplificar `close` por validator y transición.
8. Partir `settings` en tabs.
9. Mover expert surfaces a `Avanzado`.

### No hacer en la primera etapa

- no reescribir motores de dominio;
- no romper rutas existentes;
- no migrar estados de DB solo por UX;
- no intentar resolver todo con modales.

### Regla final

Cada pantalla debe responder una sola pregunta:

- **Inicio:** ¿qué tengo que hacer hoy?
- **Documentos:** ¿qué voy a cargar?
- **Revisión:** ¿qué documento necesita una decisión?
- **Reviewer:** ¿qué decisión tengo que tomar ahora?
- **Impuestos:** ¿en qué estado está este período?
- **Cierre:** ¿qué bloquea la transición?
- **Configuración:** ¿qué parte del sistema estoy preparando?

Si una pantalla responde cinco preguntas al mismo tiempo, está mal diseñada y debe seguir simplificándose.
