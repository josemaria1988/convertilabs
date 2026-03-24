# Specs-driven development — Administración de reglas contables y aprendizaje

Fecha: 2026-03-23  
Estado: propuesto para implementación  
Ámbito: V1.1 sobre el workflow documental ya existente

## 1. Objetivo

Construir una pantalla privada exclusiva para **Reglas contables / Criterios automáticos** que permita al usuario:

- listar reglas reusables activas e inactivas;
- priorizarlas dentro de su scope;
- pausarlas sin borrarlas;
- versionarlas al editarlas;
- auditarlas con trazabilidad completa;
- entender qué documentos entran por cada regla y por qué;
- trabajar con un chat exclusivo de IA para analizar cobertura, conflictos, huecos y propuestas de cambio;
- transformar una intención del usuario en contexto operativo claro para luego crear o modificar reglas manualmente.

Esta pantalla **no reemplaza** el workspace documental. Lo complementa.

## 2. Contexto y norte rector

El repo ya tiene piezas vivas que obligan a diseñar esta superficie con disciplina:

- Convertilabs exige aprendizaje controlado, explainability obligatoria y configuración hacia adelante, sin reescribir historia.
- El workflow documental ya separa extracción, revisión factual, clasificación, aprendizaje y posting.
- Ya existe un motor de reglas con scopes operativos y un orden de precedencia definido.
- La IA en el producto ya está acotada: puede analizar, justificar y sugerir; no debe crear reglas duras sola.

Por lo tanto, esta pantalla debe tratar las reglas como un **activo auditable**, no como un CRUD banal.

## 3. Diagnóstico brutal del problema actual

Hoy el producto ya tiene learning y reglas, pero le falta la superficie correcta para administrarlos como sistema.

Eso genera cinco problemas:

1. **Caja negra operativa**: el usuario ve la regla aplicada en documentos, pero no tiene una vista consolidada de todas las reglas ni de sus choques.
2. **Aprendizaje disperso**: guardar un criterio reusable desde un documento resuelve el caso puntual, pero no da gobernanza posterior.
3. **Edición riesgosa**: si se modifica una regla sin versionado explícito, se destruye trazabilidad y se contamina auditoría.
4. **Sin cola de deuda de aprendizaje**: no hay una superficie donde analizar cobertura, excepciones, documentos afectados y huecos de reglas.
5. **IA mal encuadrada si no la frenás**: si el chat puede crear reglas directamente, te arma deuda invisible y te rompe la promesa de explainability.

Conclusión: esto no es “una pantallita más”. Es el panel de control del aprendizaje contable.

## 4. Principios no negociables

### 4.1 Forward-only

- Editar una regla **no muta** la regla original.
- Editar = crear una nueva versión/regla sucesora.
- La regla anterior queda inactiva con motivo de reemplazo.
- Los documentos históricos siguen anclados a la regla efectivamente usada en su momento.

### 4.2 Pausa en vez de borrado

- Una regla aplicada al menos una vez **nunca se elimina físicamente**.
- Solo se puede desactivar/pausar.
- Solo puede eliminarse una regla que jamás haya clasificado documentos ni haya sido usada en simulación materializada.

### 4.3 IA consultiva, no ejecutora

La IA en esta pantalla:

- explica reglas existentes;
- explica precedencia e impacto;
- muestra ejemplos de documentos cubiertos;
- detecta conflictos, redundancias y huecos;
- interpreta pedidos del usuario en lenguaje natural;
- propone opciones de acción manual.

La IA **no**:

- crea reglas automáticamente;
- activa/desactiva reglas por sí sola;
- edita prioridad por sí sola;
- re-clasifica históricos por detrás;
- toca snapshots ni journals.

### 4.4 Explainability obligatoria

Toda regla visible debe poder responder:

- qué hace;
- con qué condiciones;
- con qué prioridad;
- qué gana y qué pierde frente a reglas competidoras;
- cuántos documentos cubre;
- cuáles fueron los últimos documentos afectados;
- por qué se creó;
- quién la creó/aprobó/pausó/sustituyó.

## 5. Alcance funcional de la pantalla

Ruta sugerida:

- `/app/o/[slug]/settings/accounting-rules`

O, si querés darle entidad propia más fuerte:

- `/app/o/[slug]/rules`
- nombre visible: **Reglas contables / Criterios automáticos**

### 5.1 Módulos dentro de la pantalla

1. **Listado principal de reglas**
2. **Filtros y orden**
3. **Detalle/auditoría de regla**
4. **Editor versionado**
5. **Panel de cobertura e impacto**
6. **Chat exclusivo de análisis con IA**
7. **Timeline/audit trail**
8. **Simulación previa al guardado**

## 6. Casos de uso obligatorios

### 6.1 Listar reglas

El usuario puede ver una lista ordenada de reglas con:

- nombre o label humano;
- scope;
- estado: active / paused / superseded / draft;
- prioridad relativa;
- tipo de origen: manual, learned_from_document, imported, migrated;
- cuenta/resultado esperado;
- condiciones resumidas;
- fecha de última edición;
- cantidad de documentos históricos clasificados;
- cantidad de coincidencias recientes;
- indicador de conflictos.

### 6.2 Pausar regla

Acción directa desde la lista y desde el detalle.

Efecto:

- `status = paused`
- registra actor, timestamp y razón obligatoria
- no toca históricos
- la regla deja de participar en nuevas corridas

### 6.3 Reanudar regla

Solo si no fue superseded por una regla sucesora incompatible.

Efecto:

- vuelve a `active`
- requiere razón de reactivación
- registra evento en timeline

### 6.4 Editar regla

Editar abre un formulario precargado, pero al guardar:

- no se actualiza la fila original;
- se crea una nueva regla con nuevo `id`;
- la regla previa queda `superseded` o `inactive_replaced`;
- se persiste `supersedes_rule_id` en la nueva;
- se persiste `superseded_by_rule_id` en la anterior;
- se exige justificación de cambio.

### 6.5 Eliminar regla

Permitido **solo** cuando:

- `documents_applied_count = 0`
- `assignment_runs_applied_count = 0`
- no tiene descendencia activa

Si no cumple eso, mostrar bloqueo:

- “No se puede eliminar porque ya tiene trazabilidad. Debes pausarla.”

### 6.6 Priorizar regla

El usuario puede mover prioridad dentro del mismo scope/segmento.

Debe existir reordenamiento explícito, idealmente con:

- botones subir/bajar para MVP;
- drag and drop en P2.

Toda modificación de prioridad debe:

- recalcular `priority_rank` dentro del scope;
- registrar auditoría;
- ofrecer simulación de impacto antes de confirmar si cambia el orden efectivo.

### 6.7 Auditar regla

El usuario ve:

- definición completa;
- rationale de creación;
- versión;
- regla predecesora/sucesora;
- documentos recientes afectados;
- contadores históricos;
- ejemplos de match y no-match;
- conflictos detectados;
- eventos de lifecycle.

### 6.8 Chat exclusivo con IA

El usuario puede escribir cosas como:

- “quiero que las facturas de X proveedor vayan por este carril”
- “por qué estas facturas siguen cayendo en compras generales”
- “qué reglas ya tengo para este proveedor”
- “qué pasaría si priorizo esta regla por encima de la otra”

La IA responde con análisis y opciones manuales, por ejemplo:

- qué reglas existentes ya cubren parcial o totalmente ese caso;
- cuál gana hoy por precedencia;
- qué campo del documento está siendo usado;
- si conviene editar una regla existente o crear una nueva;
- qué condiciones mínimas deberían definirse para evitar sobrecaptura.

## 7. UX propuesta

## 7.1 Layout

Pantalla de 3 columnas o 2 paneles principales:

### Panel A — lista de reglas

- buscador
- filtros
- tabs: activas / pausadas / superseded / todas
- tabla o lista densa

### Panel B — detalle de regla seleccionada

- resumen
- condiciones
- resultado contable
- cobertura
- timeline
- acciones

### Rail o panel inferior/derecho — chat IA

- contexto de la regla seleccionada o del filtro actual
- historial del hilo por organización
- respuestas con referencias a reglas/documentos

## 7.2 Lista principal: columnas mínimas

- Estado
- Prioridad
- Nombre
- Scope
- Condiciones resumen
- Resultado / cuenta / carril
- Documentos afectados
- Último uso
- Conflictos
- Acciones

## 7.3 Filtros mínimos

- texto libre
- estado
- scope
- origen
- proveedor
- categoría operativa
- cuenta destino
- solo con conflictos
- solo sin uso
- solo creadas por aprendizaje

## 7.4 Orden sugerido por defecto

1. activas primero
2. dentro de activas, por scope + priority_rank
3. luego pausadas
4. luego superseded

Eso refleja mejor la operación real. Ordenar solo por fecha sería una pavada linda pero inútil.

## 8. Modelo de dominio propuesto

## 8.1 Reusar `accounting_rules` pero endurecerlo

La tabla actual `accounting_rules` debe pasar a representar reglas versionables con lifecycle explícito.

Campos a tener o agregar:

- `id`
- `organization_id`
- `rule_code` o `stable_family_code`
- `version_number`
- `name`
- `description`
- `scope`
- `status` (`draft`, `active`, `paused`, `superseded`, `deleted_if_unused`)
- `priority_rank`
- `conditions_json`
- `result_json`
- `explainability_json`
- `created_from` (`manual`, `learning_approval`, `migration`, `import`, `assistant_draft`)
- `source_document_id` nullable
- `supersedes_rule_id` nullable
- `superseded_by_rule_id` nullable
- `pause_reason`
- `supersession_reason`
- `created_by`
- `approved_by` nullable
- `created_at`
- `activated_at`
- `paused_at`
- `retired_at`
- `last_matched_at`
- `times_matched`
- `times_applied`

### Nota clave

No mezclar “match” con “applied”:

- `matched`: cumplió condiciones;
- `applied`: fue la ganadora final de la precedencia.

Esa diferencia te sirve para explicar conflictos y shadowing.

## 8.2 Nueva tabla: `accounting_rule_events`

Para auditoría granular.

Campos:

- `id`
- `organization_id`
- `rule_id`
- `event_type` (`created`, `activated`, `paused`, `reactivated`, `superseded`, `priority_changed`, `deleted_unused`, `simulation_run`, `ai_analysis_requested`, `ai_analysis_answered`)
- `actor_user_id`
- `reason`
- `payload_json`
- `created_at`

## 8.3 Nueva tabla: `accounting_rule_simulations`

Para guardar simulaciones explícitas antes de confirmar cambios relevantes.

Campos:

- `id`
- `organization_id`
- `base_rule_id` nullable
- `candidate_rule_id` nullable
- `simulation_type` (`create`, `edit_version`, `priority_change`, `pause`)
- `sample_size`
- `affected_documents_count`
- `affected_recent_documents_count`
- `summary_json`
- `created_by`
- `created_at`

## 8.4 Nueva tabla: `accounting_rule_ai_threads`

Chat exclusivo de reglas por organización.

Campos:

- `id`
- `organization_id`
- `title`
- `context_scope` (`global`, `rule`, `vendor`, `concept`, `operation_category`)
- `context_rule_id` nullable
- `created_by`
- `created_at`
- `archived_at` nullable

## 8.5 Nueva tabla: `accounting_rule_ai_messages`

Campos:

- `id`
- `thread_id`
- `organization_id`
- `role` (`user`, `assistant`, `system_context`)
- `message_text`
- `structured_payload_json`
- `referenced_rule_ids` array nullable
- `referenced_document_ids` array nullable
- `provider`
- `model`
- `tokens_input`
- `tokens_output`
- `estimated_cost`
- `created_at`

## 8.6 Opcional P2: `accounting_rule_document_links`

Si querés cachear ejemplos por regla para no recalcular siempre.

## 9. Reglas de lifecycle

## 9.1 Estados válidos

- `draft`
- `active`
- `paused`
- `superseded`
- `deleted_if_unused`

## 9.2 Transiciones válidas

- `draft -> active`
- `active -> paused`
- `paused -> active`
- `active -> superseded`
- `paused -> superseded`
- `draft -> deleted_if_unused`
- `active/paused -> deleted_if_unused` **prohibido** si tuvo uso

## 9.3 Edición

- regla original activa
- usuario edita
- sistema genera versión candidata
- corre simulación comparativa
- si usuario confirma:
  - nueva versión = `active`
  - vieja versión = `superseded`

## 10. Contrato del chat IA

## 10.1 Inputs permitidos al modelo

- listado resumido de reglas relevantes;
- precedencia actual;
- metadata de cobertura;
- ejemplos de documentos anonimizados o minimizados;
- conflictos detectados;
- mensaje del usuario;
- schema estricto de salida.

## 10.2 Outputs obligatorios

La IA debe devolver estructura tipo:

- `user_intent_summary`
- `current_rules_relevant[]`
- `current_winning_logic`
- `coverage_gaps[]`
- `conflicts[]`
- `recommended_manual_actions[]`
- `warnings[]`
- `example_explanations[]`

## 10.3 Acciones recomendadas por IA

No son comandos ejecutables. Son recomendaciones del estilo:

- `modify_existing_rule`
- `create_new_rule`
- `change_priority`
- `pause_rule`
- `no_change_needed`
- `need_more_context`

Cada una con:

- regla objetivo si aplica;
- argumentos a favor;
- riesgos de sobrecaptura;
- campos sugeridos para usar como condición.

## 10.4 Guardrails del chat

- no devolver SQL;
- no devolver “regla creada”;
- no tocar persistencia final;
- no mentir sobre cobertura si no hay datos;
- si el pedido es ambiguo, responder con opciones y faltantes, no inventar.

## 11. Explainability y auditoría

Cada regla necesita una ficha completa:

### Resumen

- nombre
- objetivo
- alcance
- prioridad
- estado

### Qué mira

- proveedor
- concepto
- categoría operativa
- tipo documental
- moneda
- importes
- textos
- overrides

### Qué decide

- cuenta
- template
- tratamiento fiscal relacionado si aplica
- operación contable

### Por qué gana

- scope
- prioridad
- especificidad
- ausencia/presencia de otra regla

### Evidencia histórica

- últimos 10 documentos aplicados
- ejemplos representativos
- cantidad acumulada

### Historia

- creada por
- desde qué documento o acción
- pausada por
- sustituida por
- comentario de negocio

## 12. Integración con workflow documental

## 12.1 Desde documento hacia reglas

En el workspace documental actual ya existe rule explainability. Agregar deep links:

- “Ver esta regla en administración”
- “Ver reglas competidoras”
- “Abrir análisis en chat IA”

## 12.2 Desde reglas hacia documentos

Cada regla debe permitir abrir:

- documentos donde fue aplicada;
- documentos donde matcheó pero perdió;
- documentos recientes sin cobertura clara relacionados con ese proveedor/concepto.

## 12.3 Learning approval service

El guardado de criterio reusable desde documento no debe crear algo invisible.

Nuevo comportamiento:

- genera regla en `draft` o `active` según el flujo actual decidido;
- deja evento de creación;
- queda visible inmediatamente en la pantalla de administración;
- si nace de aprendizaje, marcar `created_from = learning_approval`.

## 13. Simulación de impacto

Antes de confirmar cambios relevantes, correr simulación sobre una muestra reciente.

## 13.1 Cuándo es obligatoria

- nueva regla activa;
- edición versionada;
- cambio de prioridad;
- pausa de regla con mucho uso reciente.

## 13.2 Qué debe informar

- documentos recientes potencialmente afectados;
- diferencias contra la regla ganadora actual;
- cantidad de casos que cambiarían de carril;
- riesgo de captura excesiva;
- ejemplos concretos.

## 13.3 Qué no debe hacer

- no reescribir históricos;
- no regenerar journals;
- no postear nada.

## 14. APIs / server actions propuestas

### Lectura

- `listAccountingRules(filters)`
- `getAccountingRuleDetail(ruleId)`
- `getAccountingRuleAudit(ruleId)`
- `getAccountingRuleCoverage(ruleId)`
- `listAccountingRuleDocuments(ruleId, mode)`
- `listAccountingRuleConflicts(ruleId)`

### Mutación

- `pauseAccountingRule(ruleId, reason)`
- `reactivateAccountingRule(ruleId, reason)`
- `createAccountingRuleDraft(input)`
- `activateAccountingRuleDraft(ruleId, confirmation)`
- `createSupersedingAccountingRule(ruleId, input, reason)`
- `changeAccountingRulePriority(ruleId, newRank, reason)`
- `deleteUnusedAccountingRule(ruleId, reason)`

### Simulación

- `simulateAccountingRuleChange(input)`
- `simulateAccountingRulePriorityChange(ruleId, newRank)`

### Chat IA

- `createAccountingRuleAiThread(context)`
- `sendAccountingRuleAiMessage(threadId, message)`
- `listAccountingRuleAiThreads()`
- `getAccountingRuleAiThread(threadId)`

## 15. Componentes sugeridos

- `components/rules/accounting-rules-page.tsx`
- `components/rules/accounting-rules-table.tsx`
- `components/rules/accounting-rule-filters.tsx`
- `components/rules/accounting-rule-detail-panel.tsx`
- `components/rules/accounting-rule-timeline.tsx`
- `components/rules/accounting-rule-coverage-card.tsx`
- `components/rules/accounting-rule-priority-control.tsx`
- `components/rules/accounting-rule-editor-dialog.tsx`
- `components/rules/accounting-rule-simulation-dialog.tsx`
- `components/rules/accounting-rule-ai-chat-panel.tsx`

## 16. Permisos

Acceso sugerido:

### Ver reglas

- `owner`
- `admin`
- `accountant`
- `reviewer` lectura opcional

### Crear/editar/pausar/priorizar

- `owner`
- `admin`
- `accountant`

### Eliminar unused

- `owner`
- `admin`

### Chat IA

- `owner`
- `admin`
- `accountant`

## 17. Métricas de producto

Medir desde el día 1:

- cantidad de reglas activas por organización;
- cantidad de reglas pausadas;
- porcentaje creadas desde aprendizaje;
- documentos clasificados por regla vs manual review;
- conflictos detectados;
- cambios de prioridad;
- simulaciones corridas;
- prompts de IA por organización;
- sugerencias de IA aceptadas manualmente.

Sin esto no vas a saber si la pantalla aporta valor o es solo una consola linda.

## 18. Riesgos y decisiones duras

## 18.1 Riesgo de sobreingeniería

No armes un motor de reglas “universal” antes de cerrar los scopes reales ya presentes en el producto.

Primero soportá bien:

- `document_override`
- `vendor_concept_operation_category`
- `vendor_concept`
- `concept_global`
- `vendor_default`

Después ves si agregás más granularidad.

## 18.2 Riesgo de chat humo

Si el chat habla lindo pero no referencia reglas y documentos reales, es chamuyo caro.

Por eso cada respuesta debe idealmente citar:

- reglas relevantes;
- ejemplos de documentos;
- conflictos concretos.

## 18.3 Riesgo de edición destructiva

Si permitís update in place por comodidad, arruinás auditoría. No negociar.

## 18.4 Riesgo de prioridad opaca

Si el usuario no entiende por qué gana una regla, el sistema se vuelve “místico”. Malo para contabilidad, peor para auditoría.

## 19. Plan por fases

## Fase 1 — Fundaciones mínimas

- ruta privada nueva;
- listado de reglas;
- filtros básicos;
- detalle de regla;
- pausar/reactivar;
- ver documentos afectados;
- auditoría básica.

## Fase 2 — Versionado correcto

- editar como superseding rule;
- timeline completo;
- motivo obligatorio;
- eliminación solo si unused;
- contadores de match/applied.

## Fase 3 — Simulación y prioridad

- cambio de prioridad con preview;
- simulación de impacto;
- conflictos/shadowing.

## Fase 4 — Chat IA específico

- hilo por organización;
- contexto de reglas/documentos;
- salidas estructuradas;
- recomendaciones manuales no ejecutables;
- deep link desde documentos.

## 20. Criterios de aceptación

### A. Listado

- muestra reglas activas e inactivas con filtros útiles;
- ordena correctamente por estado y prioridad;
- permite abrir detalle sin navegar a otra pantalla si querés mantener UX rápida.

### B. Pausa

- pausar no elimina;
- deja auditoría;
- la regla deja de aplicar en nuevas clasificaciones.

### C. Edición

- editar crea una nueva regla;
- la anterior queda marcada como sustituida;
- históricos siguen mostrando la regla vieja en su trazabilidad.

### D. Eliminación

- solo posible si jamás tuvo uso;
- si tuvo uso, sistema bloquea y explica.

### E. Chat IA

- responde analizando reglas reales;
- no ejecuta cambios;
- propone acciones manuales con argumentos.

### F. Auditoría

- toda regla tiene timeline visible;
- se puede explicar quién, cuándo y por qué la cambió.

## 21. Testing obligatorio

### Unit

- lifecycle transitions;
- delete guard;
- supersession logic;
- priority ranking resolver;
- conflict/shadow detection;
- AI output schema validation.

### Integration

- listado con filtros;
- pausa/reactivación;
- edición versionada;
- simulación de impacto;
- enlace documento -> regla -> documento.

### E2E

- crear criterio reusable desde documento y verlo en administración;
- pausar regla y verificar que nueva clasificación ya no la usa;
- editar regla y verificar supersession;
- intentar borrar una regla usada y recibir bloqueo;
- usar chat IA y obtener recomendación no ejecutable.

## 22. Archivos del repo a tocar con alta probabilidad

### UI/rutas

- nueva ruta privada en `app/app/o/[slug]/...`
- navegación privada
- componentes nuevos bajo `components/rules/*`

### Dominio

- `modules/accounting/rule-engine.ts`
- `modules/accounting/learning-approval-service.ts`
- nuevos servicios `modules/accounting/rules-admin/*`
- explainability helpers

### Persistencia

- migraciones Supabase para lifecycle, events, AI threads/messages, simulations

### Testing

- tests de accounting/rules admin
- tests de workflow ligados a learning

## 23. Recomendación de implementación

No empieces por el chat. Eso es maquillaje caro si antes no existe el modelo bien hecho.

Orden recomendado:

1. lifecycle + auditoría + borrado seguro;
2. listado + detalle + pausa/reactivar;
3. supersession versionada;
4. prioridad + simulación;
5. chat IA consultivo.

## 24. Decisión recomendada

La pantalla debe existir como **superficie de settings operativos con identidad propia**, pero conectada al flujo documental.

Mi recomendación concreta:

- nombre visible: **Reglas contables / Criterios automáticos**
- ubicación: dentro de private app y enlazada tanto desde Settings como desde Document Review
- IA: consultiva y explicativa
- persistencia: append-only para eventos y forward-only para versiones
- eliminación: solo unused

## 25. Qué queda explícitamente fuera de esta iteración

- autocreación de reglas por IA;
- recálculo masivo de históricos;
- edición drag-and-drop compleja desde día 1;
- sistema genérico de DSL súper abstracto;
- chat omnisciente que toque todo el producto.

## 26. Definition of done real

Esto está realmente hecho cuando se cumplan estas tres cosas al mismo tiempo:

1. el usuario puede gobernar reglas sin romper historia;
2. puede entender por qué una factura cayó por cierta regla;
3. puede conversar con la IA sobre reglas reales y salir con una acción manual clara.

Si falta cualquiera de las tres, todavía no es administración de reglas. Es otra consola a medias.
