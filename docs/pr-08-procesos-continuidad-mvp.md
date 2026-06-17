# PR-08 - Procesos y Continuidad MVP

## Objetivo

Crear la base operativa para documentar procesos criticos, obligaciones recurrentes y conocimiento crudo, y exponer un modo Continuidad que detecte riesgos accionables.

## Entregado

- Tablas `processes`, `process_versions`, `process_steps`.
- Tablas de ejecucion `process_runs`, `process_run_steps`.
- Tablas `obligations`, `obligation_occurrences`.
- Tabla `capture_notes`.
- Tabla `continuity_risks` para riesgos persistibles.
- RLS para tablas nuevas de operaciones.
- Ruta privada `/app/o/[slug]/processes`.
- Ruta privada `/app/o/[slug]/continuity`.
- Alta de proceso con primera version publicada y pasos.
- Inicio de corrida de proceso desde la version publicada.
- Alta de obligacion con primera ocurrencia.
- Captura manual de notas crudas.
- Continuidad derivada de procesos criticos sin sucesor, procesos sin receta, tareas bloqueadas y capturas pendientes.

## Criterios cubiertos

- Crear proceso.
- Publicar version inicial.
- Crear pasos.
- Crear corrida de proceso.
- Crear obligacion y occurrence.
- Capturar conocimiento crudo.
- Detectar proceso critico sin futuro responsable.
- Mostrar riesgos sin inventar datos.

## Tests

- `tests/operations-mvp.test.cjs`

