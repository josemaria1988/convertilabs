# Convertilabs 2.0 - Lenguaje, navegacion y dominios

## Estado

Documento de PR 2. Define lenguaje visible y frontera inicial de dominios.

## Navegacion principal

La navegacion principal de Convertilabs 2.0 es:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Mas
```

## Frontera de dominios

Inicio:

- centro de mando operativo;
- muestra que esta pasando y que hay que hacer ahora;
- no es un tablero decorativo.

Trabajos:

- nombre visible de `work_units`;
- agrupa trabajos, proyectos, operaciones y centros de costo operativos;
- debe conectar cliente, documentos, dinero, tareas, margen e historial.
- contiene la bandeja de `work_intake_items` para solicitudes/cotizaciones antes de convertirlas en trabajo.

Documentos:

- ingesta, revision y trazabilidad documental;
- no es el centro unico del producto;
- un documento debe terminar conectado a party, trabajo, dinero, contabilidad e IVA cuando aplique.

Dinero:

- dominio principal visible para deudores, acreedores, cobros, pagos, vencimientos y open items;
- responde quien debe, a quien se debe, que vence y que afecta a cada trabajo;
- contiene Tesoreria como subdominio.

Tesoreria:

- subdominio de Dinero;
- cubre bancos, caja, vales, saldos, proyecciones y movimientos financieros;
- no reemplaza el concepto general de Dinero.

Agenda:

- tareas, vencimientos, obligaciones y bloqueos operativos;
- debe mostrar acciones pendientes, no solo calendario.

Mas:

- superficies expertas o secundarias;
- Directorio, Procesos, Continuidad, Contabilidad, IVA, Cierre, Integraciones, Auditoria, Ajustes y Avanzado.

## Rutas actuales

Core:

- `/app/o/[slug]/dashboard`
- `/app/o/[slug]/work`
- `/app/o/[slug]/work#work-intake`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/money`
- `/app/o/[slug]/agenda`
- `/app/o/[slug]/advanced`

Expertas:

- `/app/o/[slug]/directory`
- `/app/o/[slug]/processes`
- `/app/o/[slug]/continuity`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/close`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/settings`

Aliases legacy mantenidos:

- `/treasury` y `/tesoreria` redirigen a `/money`;
- `/app/o/[slug]/treasury` y `/app/o/[slug]/tesoreria` redirigen a `/app/o/[slug]/money`.

## Regla

No crear pantallas nuevas con nombres que vuelvan a separar documentos, dinero, trabajos y procesos como productos aislados. Cada superficie debe conectarse al modelo madre.
