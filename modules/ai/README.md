# ai

Responsable de extraccion asistida, sugerencias y automatizaciones contextuales.

Estado actual:
- contrato estructurado de intake documental en `document-intake-contract.ts`
- orquestacion real compartida con `lib/llm/openai-responses.ts`
- soporte para extraction, spreadsheet mapping y recomendacion IA en carriles controlados
- IA siempre acotada por schemas y por el dominio; no es fuente de verdad por si sola
