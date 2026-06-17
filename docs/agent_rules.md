# Agent Rules - Convertilabs 2.0

## 0. Proposito

Este archivo es la guia operativa para Codex dentro de Convertilabs 2.0.

Convertilabs ya no se define como un producto centrado solo en documentos, contabilidad e IVA. Desde la refundacion, Convertilabs es el sistema operativo integral de gestion y continuidad de la empresa: un super ERP personalizado, conectado, gradual y trazable.

## 1. Fuentes De Verdad

Orden oficial de lectura antes de cambios importantes:

1. `docs/documento-refundacional-convertilabs.md`
2. `docs/plan-maestro-version1.md`
3. `docs/agent_rules.md`
4. `docs/00-core-product-and-organization.md`
5. `docs/01-workflows-ux-and-surfaces.md`
6. `docs/02-accounting-tax-and-integrations.md`
7. `docs/03-platform-quality-and-roadmap.md`

Los documentos historicos o de integraciones quedan subordinados a esta verdad 2.0. Si un documento viejo contradice la refundacion, gana la refundacion.

## 2. Tesis Del Producto

Convertilabs 2.0 es el super ERP personalizado y sistema operativo integral de la empresa.

Toda decision de producto o ingenieria debe reforzar al menos uno de estos objetivos:

1. capturar hechos reales de la empresa;
2. conectar esos hechos con personas, trabajos, documentos, dinero, impuestos, tareas y evidencia;
3. reducir dependencia de memoria humana no documentada;
4. mostrar estado operativo claro;
5. preservar trazabilidad y evidencia;
6. ayudar a decidir que hacer ahora;
7. convertir decisiones repetibles en memoria reusable.

Convertilabs no debe copiar un ERP generico, pesado y desconectado. Si debe construir un modelo integral donde la empresa quede conectada y entendible.

## 3. Principios No Negociables

- Modelo madre conectado antes que modulos isla.
- Pantallas enfocadas antes que superficies gigantes.
- Datos reales antes que dashboards decorativos.
- Trazabilidad antes que magia.
- IA asistente, no autoridad.
- Estados canonicos antes que texto libre gobernando logica.
- Estructura para ordenar la realidad, no para copiar el caos.
- No conservar codigo, schema, navegacion o documentacion anterior por nostalgia si bloquea la vision nueva.

## 4. Entidades Madre

El modelo nuevo debe converger hacia estas entidades:

- `organizations`, `organization_members`, `profiles`;
- `parties`, `party_roles`, `contacts`, `party_contacts`, `party_identifiers`;
- `work_units`;
- `documents`;
- `business_events`;
- `entity_links`;
- `evidence_refs`;
- `ledger_open_items`, pagos, cobros y settlements como base de dinero;
- `tasks`, `processes`, `obligations` y `capture_notes`;
- `interactions` e historial de comunicaciones;
- contabilidad, IVA, cierre e integraciones como consecuencias conectadas.

Codigo nuevo no debe depender directamente de `vendors`, `customers` u `organization_cost_centers` como fuente primaria cuando exista entidad canonica nueva. Esas piezas pueden sobrevivir como puente legacy hasta migracion controlada.

## 5. Prioridades De Trabajo

Optimizar en este orden:

1. visibilidad real del estado de la empresa;
2. conexion entre hechos, personas, trabajos, documentos, dinero, impuestos y tareas;
3. continuidad administrativa y transferencia de conocimiento;
4. trazabilidad funcional, contable y fiscal;
5. reduccion de carga mental;
6. automatizacion futura segura;
7. simplicidad de UX.

Si una iniciativa no mejora la vision integral de empresa conectada, no entra.

## 6. Arquitectura Esperada

- `app/`: rutas, page shells, server actions y composicion.
- `components/`: UI y presentacion.
- `modules/`: logica de dominio.
- `db/schema/`: referencia canonica consolidada.
- `supabase/migrations/`: historial aplicable real.
- `db/rls/`: politicas de seguridad.
- `tests/`: evidencia de comportamiento.

No esconder logica de negocio en componentes. Si una pantalla necesita narrar estado operativo, crear un presenter o servicio en `modules/`.

## 7. Persistencia Y RLS

Si una tarea toca persistencia:

1. actualizar schema canonico;
2. crear migracion;
3. agregar o revisar RLS;
4. crear servicios de dominio;
5. agregar tests de tenancy;
6. verificar paridad cuando corresponda.

Ninguna tabla nueva multi-tenant puede quedar sin `organization_id`, indices minimos y politica de acceso por membresia.

## 8. UX Y Superficies

La navegacion objetivo inicial es:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Mas
```

`Mas` agrupa Contactos, Contabilidad, IVA, Cierre, Procesos, Continuidad, Integraciones, Auditoria y Ajustes.

Reglas UX:

- una pantalla debe tener una intencion principal;
- no usar tablas gigantes como experiencia mobile principal;
- mostrar bloqueos con motivos visibles;
- mostrar relaciones relevantes en contexto;
- usar empty states honestos;
- Inicio debe responder que esta pasando y que tengo que hacer ahora.

La navegacion real del producto se cambiara por etapas. No introducir cambios visuales grandes antes de que el modelo madre lo soporte.

## 9. Documentos, Contabilidad E IVA

El motor documental, el kernel contable multilinea, las reglas, IVA Uruguay, cierre, open items, import/export y Zeta se conservan como piezas valiosas.

Pero ya no son islas ni centro unico del producto.

Regla:

```text
hecho operativo
-> party
-> work_unit
-> document
-> money
-> accounting
-> tax
-> task
-> evidence
-> Inicio
```

Una factura no va simplemente a una cuenta. La logica sigue siendo:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> cuentas por rol
-> preview multilinea
-> asiento
-> open item / settlement cuando aplica
```

## 10. IA

La IA puede:

- extraer datos;
- sugerir clasificacion;
- proponer party o work unit probable;
- resumir historial;
- detectar bloqueos;
- proponer tareas;
- convertir notas crudas en procesos;
- explicar impacto contable, fiscal u operativo;
- sugerir reglas reutilizables.

La IA no puede:

- inventar datos;
- confirmar operaciones criticas sin revision;
- crear reglas duras sin aprobacion;
- postear contabilidad irreversible sin controles;
- cerrar periodos;
- saltarse RLS;
- fingir certeza cuando faltan datos.

Toda sugerencia accionable debe poder aceptarse, rechazarse y auditarse.

## 11. Testing Y Cierre

No cerrar una tarea sin evidencia proporcional.

- Docs-only: validar busquedas y links relevantes.
- UI: smoke manual y estados principales.
- Dominio/backend: tests del modulo tocado.
- Schema/API: migracion, RLS, contrato y smoke.
- Contabilidad/IVA/dinero: caso positivo y caso bloqueado.
- Workflow integral: happy path mas bloqueo visible.

Comandos habituales segun alcance:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:verify:parity
```

Si no se corren comandos relevantes, explicarlo.

## 12. Antipatrones

No crear:

- modulos aislados que no conecten con entidades madre;
- dashboards con datos inventados;
- estados libres que gobiernen logica;
- duplicados de clientes/proveedores/trabajos;
- reglas IA sin aprobacion;
- configuradores sin retorno operativo;
- rutas o copy que devuelvan el producto a la tesis vieja;
- nuevas abstracciones por si acaso.

## 13. Regla Final

Cuando haya varias opciones razonables, elegir la que mas ayude a ver y operar la empresa real con trazabilidad, continuidad y menor carga mental.
