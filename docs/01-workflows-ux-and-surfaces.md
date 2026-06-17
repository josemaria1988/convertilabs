# 01 - Workflows, UX And Surfaces

## Para Que Existe Este Documento

Este documento define como debe sentirse y organizarse Convertilabs 2.0 por fuera: grande por dentro, simple por fuera, con pantallas enfocadas y modelo conectado.

Leerlo si vas a tocar:

- navegacion privada;
- Inicio;
- Trabajos;
- Documentos;
- Dinero;
- Agenda;
- Continuidad;
- copy, CTAs y estados visibles.

## 1. Principio UX Principal

La UI debe responder:

> que esta pasando y que tengo que hacer ahora.

No debe mostrar complejidad por mostrarla. El usuario debe poder abrir Convertilabs y entender estado, bloqueos, proximos pasos y entidades relacionadas.

## 2. Navegacion Objetivo

Navegacion principal inicial:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Mas
```

`Mas` agrupa:

```text
Contactos
Contabilidad
IVA
Cierre
Procesos
Continuidad
Integraciones
Auditoria
Ajustes
Avanzado
```

La navegacion real se actualizara por etapas. Hasta que existan los dominios canonicos, las rutas legacy pueden sobrevivir como accesos contextuales.

## 3. Reglas De Pantalla

- Una pantalla debe tener una intencion principal.
- Cada pantalla debe tener un CTA principal claro o un empty state honesto.
- No mostrar tablas gigantes como experiencia mobile principal.
- No inventar KPIs para llenar espacio.
- Mostrar bloqueos con motivo y proxima accion.
- Mostrar relaciones relevantes: party, trabajo, documento, dinero, tarea, evidencia.
- Permitir profundidad sin obligar a ver todo a la vez.

## 4. Inicio

Inicio es el centro de mando.

Debe mostrar, cuando existan datos:

- trabajos activos;
- documentos pendientes;
- tareas de hoy;
- vencimientos;
- deudores y acreedores;
- pagos y cobros proximos;
- IVA y cierre;
- procesos criticos;
- bloqueos;
- riesgos de continuidad.

Si no hay datos, debe guiar a crear el primer trabajo, party, documento, tarea o proceso. Nunca debe mostrar datos falsos.

## 5. Trabajos

`Trabajos` es el nombre visible inicial para `work_units`.

Un trabajo debe mostrar:

- cliente o party relacionada;
- estado;
- documentos;
- ventas;
- costos;
- margen basico;
- tareas;
- open items;
- eventos;
- evidencia;
- notas o interacciones relevantes.

El caso fundacional es `Trabajo Nueva Palmira`.

## 6. Documentos

Documentos sigue siendo una superficie fuerte, pero ya no es el centro unico del producto.

Debe servir para:

- cargar archivos;
- revisar extraccion;
- asociar party;
- asociar work unit;
- resolver tratamiento contable y fiscal;
- generar evidencia;
- alimentar dinero, IVA, contabilidad, tareas e Inicio.

La revision documental puede mantener carriles existentes, siempre que consuman estado canonico y no creen una segunda verdad.

## 7. Dinero

Dinero debe responder:

- quien me debe;
- a quien debo;
- que vence;
- que se cobro;
- que se pago;
- que open items siguen abiertos;
- que afecta a un trabajo.

V1 puede apoyarse en `ledger_open_items`, pagos, cobros y settlements manuales o semiautomatizados.

## 8. Agenda

Agenda agrupa:

- tareas;
- obligaciones;
- vencimientos;
- bloqueos;
- pasos de procesos;
- recordatorios administrativos;
- acciones derivadas de documentos, trabajos, dinero, IVA o cierre.

Cada tarea debe poder vincularse a entidades reales.

## 9. Continuidad

Continuidad responde:

> Si manana tengo que hacerme cargo de la empresa, que necesito saber?

Debe mostrar:

- procesos criticos;
- procesos no documentados;
- dependencias humanas;
- vencimientos proximos;
- contactos esenciales;
- documentos importantes;
- tareas sin responsable;
- decisiones recurrentes no convertidas en regla;
- riesgos operativos.

## 10. Mobile Y Desktop

Mobile sirve especialmente para:

- capturar documentos;
- sacar fotos;
- consultar trabajos;
- revisar tareas;
- ver alertas;
- cargar notas rapidas;
- registrar interacciones simples.

Desktop sirve especialmente para:

- revision profunda;
- contabilidad;
- IVA;
- cierre;
- reportes;
- administracion de procesos;
- gestion de trabajos;
- analisis financiero;
- configuracion.

## 11. Estados Visibles

Los estados deben ser canonicos y explicables.

Ejemplos iniciales:

- work unit: `planned`, `active`, `blocked`, `completed`, `cancelled`, `archived`;
- task: `pending`, `in_progress`, `blocked`, `done`, `cancelled`;
- process: `draft`, `active`, `archived`;
- process run: `pending`, `in_progress`, `blocked`, `completed`, `cancelled`;
- document: mantener estados existentes hasta migracion, pero traducirlos con copy claro.

Todo bloqueo debe decir por que esta bloqueado y que accion lo destraba.

## 12. Copy

Usar lenguaje operativo:

- Inicio
- Trabajos
- Documentos
- Dinero
- Agenda
- Contactos
- Continuidad
- Contabilidad
- IVA
- Cierre
- Auditoria
- Ajustes

Evitar copy que reduzca Convertilabs a documentos, IVA o automatizacion contable aislada.
