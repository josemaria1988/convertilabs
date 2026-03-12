# Spec 02 - Pipeline de extraccion documental

**Estado:** Approved with follow-up  
**Prioridad:** P0  
**Dependencias:** `01`

---

## 1. Decision cerrada

El pipeline V1 usa:

- upload a bucket privado
- procesamiento server-side
- OpenAI Responses API
- `gpt-4o-mini`
- PDF e imagen (`jpg`, `png`)
- salida estructurada con `json_schema`

La IA recibe:

- instrucciones fijas
- snapshot resumido de reglas de la organizacion
- archivo del documento

La IA no recibe la normativa DGI completa.

---

## 2. Persistencia obligatoria

Cada corrida deja trazabilidad en:

- `document_processing_runs`
- `document_extractions`
- `document_field_candidates`
- `document_classification_candidates`
- `document_drafts`

El pipeline nunca deja un documento directamente en `classified`.

---

## 3. Estados aprobados

Estados relevantes del documento:

- `uploaded`
- `queued`
- `extracting`
- `draft_ready`
- `needs_review`
- `classified`
- `classified_with_open_revision`
- `error`

Estados relevantes del run:

- `queued`
- `processing`
- `completed`
- `error`

---

## 4. Politicas V1

- duplicados por hash: warning, no bloqueo
- si OpenAI falla: el documento queda trazado y pasa a `error`
- si el schema no valida: error manejable y auditable
- si falta perfil suficiente: el draft igual existe, pero con pasos bloqueados

---

## 5. Estado real de implementacion

Implementado:

- upload privado
- disparo de procesamiento desde la server action
- subida del archivo a OpenAI Files
- llamada a Responses API
- validacion estricta del JSON
- persistencia de runs, candidatos y draft

Pendiente de hardening:

- cola/worker real; hoy el procesamiento corre inline despues del upload
- politicas cuantitativas de calidad OCR/texto
- preview con highlights de origen
- reintento manual de procesamiento desde UI

---

## 6. No objetivos de este spec

- emision de comprobantes
- decision contable final
- decision fiscal final
- posting definitivo
