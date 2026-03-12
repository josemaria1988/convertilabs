# Scope map - Corte V1 aprobado

**Estado:** Approved  
**Objetivo:** dejar trazado el alcance real del V1 despues de las decisiones cerradas

---

## 1. Corte comercial aprobado

El V1 aprobado es:

- Uruguay only
- IVA only
- compra automatizable
- venta incluida dentro de V1
- sin emision ni pre-emision
- confirmacion final unica
- `journal_entry` generado en estado `draft`

No existe ya decision abierta entre `V1A`, `V1B` o `V1C`.

---

## 2. Bases del producto

El sistema queda dividido en estas bases:

1. Perfil organizacional versionado
2. Pipeline documental con IA acotada por snapshot
3. Compra V1
4. Venta V1
5. Draft editable persistente
6. Sugerencia contable
7. Sugerencia fiscal IVA
8. Confirmacion y reapertura
9. Base normativa interna curada

---

## 3. Decision de ventas

La venta entra en V1, pero solo bajo este modelo:

- Convertilabs procesa PDFs o imagenes ya emitidos por otro sistema
- tambien soporta carga/import manual resumida para ventas
- no emite comprobantes
- no pre-emite comprobantes
- no integra CFE en runtime

---

## 4. Decision de IA

OpenAI entra en V1 solo para intake documental.

Reglas obligatorias:

- siempre server-side
- `gpt-4o-mini`
- Responses API
- salida estructurada con `json_schema`
- la IA nunca recibe toda la normativa DGI
- en runtime solo recibe el snapshot resumido y aprobado para esa organizacion

---

## 5. Limites de alcance

Fuera del alcance automatizado de V1:

- IRAE
- IP
- retenciones
- BPS
- prorrata compleja
- emision CFE
- importaciones
- servicios del exterior
- monotributo puro
- cooperativas, asociaciones civiles y otras formas fuera del set soportado

---

## 6. Estado actual de implementacion

Ya implementado:

- onboarding fiscal minimo
- upload privado
- intake documental con OpenAI
- `document_processing_runs`
- `document_drafts`
- snapshots por organizacion

Pendiente de hardening:

- worker/cola real para ejecutar el pipeline fuera de la server action
- highlights de origen
- backoffice normativo completo
