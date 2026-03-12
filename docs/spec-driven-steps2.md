Convenciones base para esta etapa

- Uruguay only en V1.
- IVA only en V1.
- Compra automatizable y venta incluida sin emision.
- Confirmacion final unica; al aprobar se genera `journal_entry.status = draft`.
- OpenAI entra en V1 solo para intake documental y siempre desde servidor.
- La IA nunca recibe toda la normativa DGI; solo snapshots resumidos y aprobados por organizacion.

## 1) AI-INTAKE-001: introducir pipeline OpenAI server-side
Objetivo

Convertir el upload actual en un pipeline documental persistente que:

- descargue el archivo privado desde Supabase Storage,
- lo suba a OpenAI Files,
- ejecute Responses API con `gpt-4o-mini`,
- valide salida estricta en JSON schema,
- persista runs, candidatos y draft inicial.

Resultado esperado

- PDF, JPG y PNG pueden procesarse desde servidor.
- Cada corrida queda trazada en `document_processing_runs`.
- La salida de IA se materializa en `document_extractions`, `document_field_candidates`,
  `document_classification_candidates` y `document_drafts`.
- Si OpenAI falla o responde mal, el documento queda en error auditable, no en silencio.

Subtareas

AI-INTAKE-001.1 Adapter OpenAI

- Crear adapter reusable en `lib/llm/openai-responses.ts`.
- Usar Responses API, no Chat Completions.
- Soportar `input_file` para PDF y `input_image` para imagen.
- Centralizar file upload, structured response y parseo de uso/tokens.

AI-INTAKE-001.2 Contrato de salida estructurada

- Definir schema JSON estricto para:
  - rol documental,
  - tipo documental,
  - categoria operativa candidata,
  - hechos extraidos,
  - importes,
  - warnings,
  - confidence score,
  - explicacion breve.
- Rechazar cualquier respuesta fuera de contrato.

AI-INTAKE-001.3 Orquestacion documental

- Crear modulo server-only para:
  - cargar documento,
  - materializar snapshot de reglas,
  - crear run,
  - descargar archivo,
  - invocar OpenAI,
  - validar salida,
  - persistir artefactos,
  - actualizar estado del documento.

AI-INTAKE-001.4 Integracion con upload actual

- Mantener el flujo de upload actual.
- Al finalizar upload, disparar procesamiento desde la accion server-side.
- Si falta `OPENAI_API_KEY`, no romper el upload; dejar trazabilidad y degradar.

## 2) ORG-RULES-001: versionado de perfil y snapshots por organizacion
Objetivo

Evitar prompts genericos y materializar contexto exacto por tenant.

Resultado esperado

- Cada organizacion tiene versionado de perfil.
- Cada perfil puede materializar un `organization_rule_snapshot`.
- Los documentos guardan que snapshot uso la IA.
- Un cambio de perfil no muta drafts viejos.

Subtareas

ORG-RULES-001.1 Captura base en onboarding

- Requerir `legal_entity_type`, `tax_id` y `tax_regime_code` en onboarding.
- Persistir esos datos en `organizations` como snapshot operativo inicial.

ORG-RULES-001.2 Bootstrap de profile version

- Si no existe `organization_profile_versions`, crear la primera version activa al procesar.
- Usar el onboarding como fuente base.

ORG-RULES-001.3 Materializacion del snapshot

- Cargar reglas VAT activas globales + organization scope.
- Generar `prompt_summary` breve y apto para token budget.
- Guardar refs deterministicas usadas.

## 3) NORM-001: base normativa curada para prompts y motor fiscal
Objetivo

Procesar una sola vez la normativa DGI y exponer solo derivaciones utilizables.

Resultado esperado

- Existen `normative_sources`, `normative_items` y `normative_update_runs`.
- La normativa completa no vive en prompts.
- Los prompts consumen resumenes aprobados por organizacion.

Subtareas

NORM-001.1 Persistencia base

- Registrar fuentes oficiales.
- Segmentar normativa en items consultables.
- Dejar runs de actualizacion manual.

NORM-001.2 Regla de producto

- En V1 la publicacion de reglas sigue siendo human-in-the-loop.
- Solo IVA entra como dominio activo para snapshots usados por IA.

## 4) DOC-REVIEW-001: draft persistente y estados nuevos
Objetivo

Persistir todo output automatico como draft auditable.

Resultado esperado

- Nuevos estados de documento: `draft_ready`, `classified_with_open_revision`.
- Existe `document_drafts`, pasos, revisiones y confirmaciones.
- Todo procesamiento automatico termina en draft o error manejable.

## 5) QA-001: pruebas minimas
Casos obligatorios

- PDF con texto.
- PDF escaneado.
- JPG/PNG legible.
- Falta de config OpenAI.
- Respuesta fuera de schema.
- Snapshot inexistente o perfil incompleto.
- Duplicado por hash.
- Inconsistencia matematica.

Definition of Done de esta etapa

La etapa queda cerrada cuando:

- onboarding captura los campos fiscales minimos,
- el upload dispara procesamiento server-side,
- OpenAI devuelve salida estructurada validada,
- el documento deja run + extraccion + candidatos + draft persistidos,
- el contexto de reglas enviado al modelo sale de snapshots por organizacion,
- y ningun prompt depende de pegar normativa DGI completa.
