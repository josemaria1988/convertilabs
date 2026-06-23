# Playbook Nueva Palmira - Acceptance test operativo

## Estado

Documento de PR 4. Define el corte minimo para validar Convertilabs 2.0 sin depender de Zeta real.

## Flujo esperado

```text
solicitud/cotizacion
-> party cliente
-> work_unit Nueva Palmira
-> venta
-> gastos
-> margen
-> open items
-> tareas
-> Inicio
```

## Datos minimos

- Cliente creado como `party`.
- Contacto asociado si existe dato de contacto.
- Trabajo creado como `work_unit`.
- Solicitud inicial registrada como `work_intake_item`, por carga manual o endpoint web.
- Documento de venta asociado al trabajo.
- Documento de compra/gasto asociado al trabajo.
- Open item a cobrar.
- Open item a pagar.
- Margen documental estimado calculable.
- Tarea pendiente asociada.
- Senal accionable visible en Inicio.

## Criterios

- El flujo no depende de Zeta real.
- No hay KPIs inventados.
- Todo dato visible viene de entidad real o fixture explicito.
- El test debe fallar si no aparecen margen, pendientes o relacion con trabajo.
- La IA no crea ventas finales ni confirma datos ambiguos.

## Verificacion local

Usar tests de dominio:

- `tests/work-mvp.test.cjs`
- `tests/work-intake.test.cjs`
- `tests/work-intake-schema.test.cjs`
- `tests/money-mvp.test.cjs`
- `tests/company-home-dashboard.test.cjs`

## Corte operativo minimo en UI

1. Cargar una solicitud "Nueva Palmira" en Trabajos -> Solicitudes y cotizaciones.
2. Asociarla a un `party` cliente.
3. Convertirla o asociarla al `work_unit` Nueva Palmira.
4. Crear tarea de seguimiento si falta confirmacion.
5. Asociar documento de venta y gasto al trabajo.
6. Revisar margen documental estimado y saldos vivos en Dinero.
7. Confirmar que Inicio muestra solicitud pendiente, trabajo activo, dinero pendiente o tarea segun corresponda.

Comando:

```bash
npm test
```
