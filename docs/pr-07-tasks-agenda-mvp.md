# PR-07 - Tasks y Agenda MVP

## Objetivo

Materializar el dominio operativo de tareas dentro de Convertilabs 2.0 para que Agenda deje de ser un placeholder y pase a mostrar acciones reales conectadas al modelo madre.

## Entregado

- Schema `tasks` con estados canonicos: `pending`, `in_progress`, `blocked`, `done`, `cancelled`.
- RLS para lectura por miembros y escritura por roles operativos.
- Modulo `modules/operations` con builders, repositorio y permisos.
- Ruta privada `/app/o/[slug]/agenda`.
- Formulario de alta de tarea.
- Vinculos opcionales a `party`, `work_unit` y `document`.
- Resumen de tareas abiertas, bloqueadas, semana y sin vinculo.
- Inicio conectado a senales reales de tareas.

## Criterios cubiertos

- Crear una tarea manual.
- Asociar tarea con trabajo, documento y party.
- Mostrar vencimientos simples por fecha.
- Degradar si el schema aun no existe.
- Mantener multi-tenant via `organization_id` y RLS.

## Tests

- `tests/operations-mvp.test.cjs`

