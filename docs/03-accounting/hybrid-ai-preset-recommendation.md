# Recomendacion hibrida de presets con IA

## Objetivo

Agregar una segunda capa consultiva sobre el motor de reglas sin convertir la recomendacion del plan en una caja negra.

## Activacion

El flujo esta detras de `PRESET_AI_RECOMMENDATION_ENABLED`.

Si la flag esta apagada:

- el sistema sigue funcionando 100% por reglas;
- la UI no debe depender de OpenAI;
- onboarding y settings conservan el flujo deterministico base.

## Principio rector

La IA no inventa composiciones. Solo puede elegir una composicion valida de este set:

- `recommended`
- `alternatives[]`

El recommendation engine por reglas sigue siendo el punto de partida y el fallback obligatorio.

## Servicio central

Archivo: `modules/accounting/presets/ai-recommendation.ts`

Responsabilidades:

- construir snapshot de input;
- calcular `inputHash`;
- armar prompt estructurado;
- llamar a OpenAI con Responses API;
- validar salida contra schema estricto;
- decidir si gana reglas o IA;
- persistir auditoria completa;
- exponer helpers para guardar borrador de centros de costo.

## Modelo de salida IA

La respuesta validada exige:

- `selectedCompositionCode`
- `confidence`
- `targetAudienceFit`
- `keyBenefit`
- `setupTip`
- `observations[]`
- `suggestedCostCenters[]`

Validaciones duras:

- la composicion elegida debe pertenecer al set permitido;
- `targetAudienceFit`, `keyBenefit` y `setupTip` no pueden quedar vacios;
- `observations[]` debe respetar el shape de `HelpHintContent`;
- `suggestedCostCenters[]` debe respetar `{ code, label, rationale, groupingHint }`.

## Combinador hibrido

La decision final hoy sigue esta logica:

- falla IA o falta `OPENAI_API_KEY`: gana reglas;
- IA coincide con reglas y supera umbral: `rules_confirmed_by_ai`;
- IA elige alternativa con `confidence >= 0.75`: `hybrid_ai_recommended`;
- IA con baja confianza: la recomendacion visible se explica, pero no reemplaza la seleccion por reglas.

## UI y explainability

### Superficies

- `components/onboarding/business-profile-configurator.tsx`
- `components/onboarding/preset-ai-recommendation-card.tsx`
- `components/ui/help-hint.tsx`

### Comportamiento

- el usuario debe apretar `Consultar IA`;
- la consulta no corre automaticamente por cada cambio;
- si la confianza es suficiente, el formulario queda listo para `Guardar y aplicar`;
- la recomendacion muestra carta del asistente en Markdown via `react-markdown`;
- las observaciones se mapean a `HelpHintContent` y se muestran como comentarios/tooltips;
- al cambiar actividad, traits o descripcion, el resultado IA se invalida y vuelve el modo por reglas.

## Persistencia

### Tabla nueva

- `organization_preset_ai_runs`

Campos clave:

- contexto organizacional y de perfil;
- `input_hash`;
- snapshot del request;
- recomendacion por reglas;
- candidatos;
- composicion elegida;
- confianza y textos explicativos;
- observaciones y centros de costo sugeridos;
- proveedor, modelo, tokens y costo estimado;
- estado, error y timestamps.

### Vinculo con la aplicacion del preset

`organization_preset_applications` ahora admite `ai_run_id`.

Si el usuario guarda con `hybrid_ai_recommended`:

- el server valida que el `aiRunId` exista;
- valida que pertenezca al usuario/contexto;
- valida que su `input_hash` coincida con el estado actual del formulario;
- luego lo vincula a la aplicacion real del preset.

## Seguridad y consumo

### Endpoint

- `POST /api/preset-ai-recommendation`
- `POST /api/preset-ai-recommendation/cost-center-draft`

### Guardrails

- requiere sesion;
- para `scope=settings`, exige acceso real a la organizacion;
- rate limit:
  - 5 consultas por `requested_by` en 10 minutos
  - 12 consultas por `ip_hash` en 10 minutos
- `429` devuelve `retry_after_seconds`.

## Modelo y provider

La resolucion toma `OPENAI_RULES_MODEL`, con default efectivo heredado desde `lib/env.ts`. Si no hay override, el repo cae en `gpt-4o` como modelo primario por defecto.

## Centros de costo sugeridos

Estado actual:

- no existen entidades reales de `cost_centers`;
- la IA puede sugerir borradores;
- el usuario puede marcar el borrador como guardado;
- eso solo actualiza `cost_center_draft_saved` en la corrida IA.

Este diseno deja preparado el siguiente paso sin inventar entidades antes de tiempo.

## Estado actual frente al rector

### Implementado

- consulta explicita;
- salida estructurada;
- carta del asistente;
- explainability via observations;
- autoseleccion por confianza;
- auditoria completa.

### Pendiente

- cost centers reales;
- seguimiento mas rico del valor comercial de esta capa en reporting o upsell;
- analitica comparativa entre reglas puras y decisiones hibridas.
