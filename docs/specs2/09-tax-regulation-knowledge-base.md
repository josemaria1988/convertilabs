# Spec 09 - Base normativa tributaria viva

**Estado:** Draft / Blocked  
**Prioridad:** P1  
**Dependencias:** decisión de alcance fiscal del V1  
**Objetivo:** mantener una base normativa actualizada, versionada y consumible por usuarios, reglas e IA

---

## 1. Propósito

Definir el subsistema que permitirá:

- ingerir normativa tributaria relevante,
- versionarla,
- detectar cambios,
- curar reglas derivadas,
- exponerla a usuarios,
- exponerla a motores internos.

---

## 2. Problema que resuelve

Sin una base normativa interna versionada, el sistema termina dependiendo de:
- prompts frágiles,
- conocimiento tácito,
- PDFs sueltos,
- y memoria humana, ese repositorio notoriamente poco confiable.

---

## 3. Principio rector

La IA y los motores de reglas NO deben consultar “internet” para decidir tratamiento fiscal en runtime.  
Deben consultar una **capa normativa interna curada, versionada y aprobada**.

Adicionalmente, si se usa LLM en intake o explicación, el runtime SHOULD consumir
solo snapshots resumidos y relevantes por organizacion, nunca el corpus
normativo completo.

---

## 4. Alcance

### Incluido
- registro de fuentes oficiales,
- ingesta periódica,
- snapshot y hash,
- diff entre versiones,
- segmentación en items normativos,
- reglas derivadas versionadas,
- búsqueda por usuarios y por motores internos.

### Excluido
- interpretación normativa autónoma sin revisión,
- publicación automática de nuevas reglas en producción sin aprobación humana.

---

## 5. Fuentes a modelar

### Fuentes oficiales primarias
- DGI
- portal e-Factura DGI
- IMPO

### Fuentes oficiales complementarias
- GUB.UY / MEF / DGR cuando impacten catalogación societaria o contexto operativo

### Fuentes internas
- criterios aprobados por contador / asesor
- reglas derivadas del producto
- notas de interpretación internas

---

## 6. Modelo de datos propuesto

### `normative_sources`
Campos:
- `id`
- `code`
- `name`
- `source_type` (`official`, `internal`)
- `base_url`
- `active`

### `normative_documents`
Campos:
- `id`
- `source_id`
- `document_type`
- `title`
- `official_reference`
- `url`
- `published_at`
- `effective_from`
- `effective_to`
- `status` (`active`, `superseded`, `obsolete`)
- `content_hash`
- `raw_content`
- `parsed_content`
- `last_checked_at`

### `normative_items`
Unidad mínima consultable.

Campos:
- `id`
- `document_id`
- `item_code`
- `topic_codes_json`
- `text`
- `summary`
- `effective_from`
- `effective_to`
- `supersedes_item_id`
- `embedding_status`

### `normative_update_runs`
Campos:
- `id`
- `started_at`
- `finished_at`
- `status`
- `sources_checked_json`
- `changes_detected_json`
- `review_required`

### `derived_tax_rules`
Campos:
- `id`
- `rule_code`
- `version`
- `status`
- `jurisdiction_code`
- `scope_code`
- `conditions_json`
- `output_json`
- `derived_from_normative_items_json`
- `approved_by`
- `approved_at`
- `effective_from`
- `effective_to`

### `normative_change_reviews`
Campos:
- `id`
- `update_run_id`
- `change_type`
- `impact_assessment`
- `decision`
- `reviewed_by`
- `reviewed_at`

---

## 7. Flujo operativo

### 7.1 Ingesta
Proceso scheduled o manual que:
- descarga o lee fuente,
- normaliza formato,
- calcula hash,
- compara con snapshot anterior.

### 7.2 Detección de cambios
Clasifica cambios como:
- nuevo documento,
- cambio editorial menor,
- cambio sustantivo,
- sustitución,
- derogación,
- posible impacto en reglas.

### 7.3 Segmentación
Divide documento en items consultables.

### 7.4 Curación
Humano revisa y decide:
- si cambia reglas,
- si solo actualiza base informativa,
- si necesita análisis.

### 7.4.1 Derivación para prompts
La curación SHOULD producir también un resumen corto y estable apto para prompt,
vinculado a reglas determinísticas y materializable por organizacion.

### 7.5 Publicación
Solo reglas aprobadas pasan a `active`.

---

## 8. UX requerida

### Para usuarios
Debe existir una sección consultable que permita:
- buscar por tema,
- filtrar por vigencia,
- ver resumen,
- ver fuente oficial,
- ver qué reglas del sistema se apoyan en esa norma.

### Para administradores
Debe existir backoffice para:
- ver diffs,
- revisar impacto,
- aprobar reglas,
- desactivar reglas,
- versionar interpretaciones internas.

---

## 9. API sugerida

### `POST /api/normative/update-run`
Dispara una actualización manual.

### `GET /api/normative/search?q=...`
Busca items normativos.

### `GET /api/normative/documents/:id`
Devuelve documento y fragmentos.

### `GET /api/normative/rules/:rule_code`
Devuelve regla derivada vigente y sus soportes.

### `POST /api/normative/rules/:rule_code/activate`
Activa una versión aprobada.

---

## 10. Reglas de gobierno

1. Ningún cambio normativo detectado debe activar reglas productivas sin revisión humana.
2. Toda regla activa MUST poder trazarse a una o más fuentes normativas.
3. Toda regla SHOULD tener vigencia temporal.
4. Toda consulta de IA SHOULD registrar qué items normativos usó.
5. Si no hay base normativa suficiente para un caso, el sistema debe degradar a revisión humana.

---

## 11. Integración con motores

### Motor fiscal
Debe consultar reglas derivadas + refs normativas.

### Motor contable
Puede usar reglas derivadas para mapping tributario que impacte cuentas.

### Asistente / IA futura
Debe consultar:
- base normativa interna,
- reglas activas,
- interpretaciones aprobadas,
pero no responder como si estuviera improvisando criterio legal.

---

## 12. Escenarios de aceptación

### Escenario A - Cambio en fuente oficial
**Given** una fuente oficial cambia su contenido  
**When** corre la actualización  
**Then** se detecta diff  
**And** se crea revisión pendiente

### Escenario B - Regla derivada aprobada
**Given** un cambio revisado  
**When** se aprueba una nueva regla  
**Then** queda versionada con vigencia y soporte normativo

### Escenario C - Búsqueda por usuario
**Given** un usuario busca una operación fiscal  
**When** consulta la base  
**Then** puede ver resumen, vigencia y fuente oficial

---

## 13. Fuentes sugeridas iniciales

Las URLs exactas deben vivir luego en configuración, pero el seed inicial debería registrar al menos:

- DGI: https://www.dgi.gub.uy/
- e-Factura DGI: https://www.efactura.dgi.gub.uy/
- IMPO: https://www.impo.com.uy/
- GUB/MEF empresas y sociedades: https://www.gub.uy/ministerio-economia-finanzas/institucional/empresas

---

## 14. Preguntas bloqueantes

1. ¿Qué temas tributarios cubrirá primero la base normativa?
2. ¿Quién aprueba cambios de reglas?
3. ¿Cada cuánto corre la actualización?
4. ¿Se almacenará texto completo, HTML, PDF o todo lo anterior?
5. ¿Se generarán embeddings desde el inicio?
6. ¿Qué ve el usuario final: norma completa, resumen o ambos?
7. ¿Cómo se versionan interpretaciones internas frente a cambios oficiales?

---
