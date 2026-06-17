# Convertilabs 2.0 — Documento refundacional

**Estado:** documento rector inicial  
**Fecha:** 2026-06-17  
**Tipo:** refundación total de producto, arquitectura y alcance  
**Nombre conservado:** Convertilabs  
**Dominio y hosting:** se conservan como activos existentes  
**Destino inicial:** sistema personalizado de gestión integral para la empresa propia  

---

## 0. Declaración refundacional

Convertilabs entra en una refundación total.

La versión anterior de Convertilabs nació como un sistema vendible hacia afuera, centrado principalmente en documentos, automatización contable, IVA, reglas y trazabilidad. Esa visión produjo ideas y piezas útiles, pero ya no representa el problema principal que el sistema debe resolver.

La nueva necesidad es más profunda, más concreta y más personal:

> Necesito poder ver la empresa en un tablero, saber dónde estoy parado, saber qué falta hacer, saber hacia dónde tengo que ir y poder hacerme cargo de la administración sin depender de memoria, papeles sueltos ni conocimiento concentrado en otra persona.

Por lo tanto, Convertilabs deja de pensarse primero como un producto SaaS para vender y pasa a pensarse como el sistema operativo integral de la empresa.

Convertilabs 2.0 será el lugar donde se gestione toda la empresa: operaciones, trabajos, clientes, proveedores, documentos, facturación, gastos, contabilidad, IVA, bancos, caja, cobros, pagos, deudores, acreedores, trámites, procesos, tareas, historial de contactos, decisiones, evidencia y memoria administrativa.

No se conserva el producto anterior por obligación. Se conserva solamente lo que realmente sirva.

Se conservan:

- el nombre Convertilabs;
- el dominio ya comprado;
- el hosting existente;
- la experiencia técnica acumulada;
- el stack que sea útil;
- las piezas de autenticación, Supabase, documentos, contabilidad, IVA, reglas, trazabilidad o integraciones que convenga reutilizar;
- el aprendizaje conceptual de la primera etapa.

Se descarta, reescribe o redefine todo lo que limite la nueva visión.

La regla madre de esta refundación es:

> Convertilabs no se adapta tímidamente a una idea más grande. Convertilabs se refunda para convertirse en el super ERP personalizado de la empresa.

---

## 1. Nueva tesis del producto

### 1.1 Tesis corta

> Convertilabs es el sistema operativo integral de gestión y continuidad de la empresa.

### 1.2 Tesis extendida

Convertilabs es un super ERP personalizado que captura todo hecho relevante de la empresa y lo conecta con su impacto operativo, documental, financiero, contable, fiscal, humano y administrativo.

Su objetivo no es solamente registrar información. Su objetivo es convertir la empresa en un sistema visible, ordenado, trazable y accionable.

Convertilabs debe responder todos los días:

1. Qué está pasando en la empresa.
2. Dónde estoy parado.
3. Qué trabajos están en curso.
4. Qué documentos entraron.
5. Qué compras y ventas ocurrieron.
6. Qué tengo que cobrar.
7. Qué tengo que pagar.
8. Qué clientes y proveedores requieren atención.
9. Qué trámites o vencimientos se acercan.
10. Qué falta para cerrar IVA, contabilidad o procesos administrativos.
11. Qué cosas están bloqueadas.
12. Qué decisiones se tomaron antes y por qué.
13. Qué tareas dependen de mí, de mi madre, del contador, de un proveedor, de un cliente o de otra persona.
14. Qué conocimiento administrativo todavía está en la cabeza de alguien y debe pasar al sistema.

### 1.3 Frase rectora

> Toda la empresa, conectada y entendible.

### 1.4 Frase personal

> Convertilabs es el tablero que me permite hacerme cargo de la empresa sin depender de memoria, papeles sueltos ni conocimiento invisible.

---

## 2. Cambio respecto a la visión anterior

La visión anterior decía, explícita o implícitamente:

> Convertilabs no es un ERP.

Esa frase ya no sirve como tesis principal.

La nueva frase correcta es:

> Convertilabs no es un ERP genérico. Convertilabs es un super ERP personalizado y un sistema operativo integral de empresa.

La diferencia es importante.

Un ERP genérico suele estar organizado como una suma de módulos:

- ventas;
- compras;
- stock;
- clientes;
- proveedores;
- caja;
- bancos;
- contabilidad;
- reportes;
- recursos humanos;
- producción;
- proyectos.

Convertilabs no debe copiar esa lógica como módulos aislados y pesados.

Convertilabs debe modelar la empresa como una red de hechos conectados:

```text
hecho operativo
-> personas involucradas
-> trabajo/proyecto/centro de costo
-> documentos
-> dinero
-> contabilidad
-> impuestos
-> tareas
-> procesos
-> evidencia
-> historial
-> tablero
```

La ambición es mayor que la de un ERP estándar, porque no se trata solo de registrar operaciones. Se trata de transformar la operación diaria, el conocimiento administrativo y la memoria de la empresa en un sistema claro, navegable y accionable.

---

## 3. Por qué se refunda Convertilabs

La razón profunda de la refundación no es técnica. Es operativa y humana.

Existe un miedo real:

> El día en que mi madre no esté o no pueda hacerse cargo, ¿cómo voy a llevar yo las cuentas, los papeles, los trámites y toda la administración de la empresa?

Ese miedo revela que el problema no es simplemente contable.

El problema es:

- dependencia de conocimiento concentrado en una persona;
- papeles dispersos;
- trámites que alguien sabe hacer pero no están documentados;
- vencimientos que dependen de memoria;
- cuentas, pagos y cobros que no están visibles en un solo lugar;
- falta de tablero general;
- falta de continuidad administrativa;
- dificultad para entender el estado real de la empresa;
- dificultad para saber qué hacer después.

Convertilabs 2.0 existe para resolver eso.

No es una herramienta para “subir facturas” solamente. Tampoco es solo un sistema fiscal. Tampoco es solo un CRM. Tampoco es solo gestión de tareas.

Es el sistema donde la empresa se vuelve visible.

---

## 4. Qué significa “super ERP personalizado”

La expresión “super ERP personalizado” no significa crear una suite inflada con mil pantallas.

Significa crear un sistema que combina, de forma integrada:

- ERP;
- contabilidad;
- gestión de documentos;
- gestión de trabajos/proyectos;
- centros de costo;
- seguimiento de ventas;
- seguimiento de compras;
- cuentas corrientes;
- cobros;
- pagos;
- deudores;
- acreedores;
- caja;
- bancos;
- impuestos;
- vencimientos;
- trámites;
- procesos internos;
- manual vivo de administración;
- tareas;
- contactos;
- historial con clientes y proveedores;
- memoria de decisiones;
- inteligencia asistida;
- tablero de control.

Pero todo eso debe estar conectado por un mismo modelo.

No se deben crear módulos que funcionen como islas.

La regla es:

> Grande en visión, ordenado en arquitectura, gradual en implementación.

---

## 5. Principios fundacionales

### 5.1 Toda la empresa debe entrar en Convertilabs

Convertilabs debe ser la herramienta principal para gestionar la empresa.

Eso implica que deben entrar:

- clientes;
- proveedores;
- contactos;
- trabajos;
- proyectos;
- centros de costo;
- ventas;
- compras;
- gastos;
- facturas;
- recibos;
- comprobantes;
- contratos;
- certificados;
- trámites;
- documentos físicos digitalizados;
- documentos digitales;
- pagos;
- cobros;
- bancos;
- caja;
- cuentas corrientes;
- IVA;
- cierres;
- obligaciones;
- procesos;
- tareas;
- comunicaciones;
- decisiones;
- evidencia.

### 5.2 Un dato entra una vez y alimenta muchas vistas

Una factura de gasto no debe ser solo una factura.

Debe poder alimentar simultáneamente:

- contabilidad;
- IVA;
- cuenta corriente del proveedor;
- caja o banco;
- costo de un trabajo;
- margen de un proyecto;
- vencimiento de pago;
- tablero principal;
- historial del proveedor;
- evidencia documental;
- reglas futuras.

Una venta no debe ser solo una factura de venta.

Debe alimentar:

- ingresos;
- IVA ventas;
- cuenta a cobrar;
- cliente;
- trabajo asociado;
- margen;
- cobranza;
- historial comercial;
- tablero.

### 5.3 Modelo conectado, pantallas enfocadas

El modelo de datos debe conectar todo.

La interfaz no debe mostrar todo junto todo el tiempo.

La fórmula correcta es:

```text
modelo profundo y conectado
+
pantallas simples y enfocadas
```

Ejemplo:

- en la vista de un trabajo se ven ventas, costos, margen, documentos y pendientes;
- en la vista de una factura se revisan datos, asignación, IVA y pago;
- en la vista de un cliente se ve historial, trabajos, saldos, contactos y comunicaciones;
- en la vista de Inicio se ve lo importante para decidir qué hacer ahora.

### 5.4 No replicar el caos existente en la base de datos

El sistema no puede convertirse en una copia digital del desorden actual.

Por eso:

- no se deben crear tablas dinámicas por cada proceso;
- no se deben crear estados libres inventados por el usuario;
- no se deben guardar bloques gigantes de texto como única verdad operativa;
- no se deben crear módulos sin relación con el resto;
- no se deben duplicar clientes/proveedores/trabajos en varias partes del sistema;
- no se deben usar notas sueltas como sustituto de estructura.

La estructura debe ordenar la realidad, no copiar el desorden.

### 5.5 Lo libre puede entrar, pero debe transformarse en estructura

La empresa puede traer información desordenada:

- texto libre;
- notas;
- audios transcritos;
- conversaciones;
- fotos;
- PDFs;
- planillas;
- correos;
- capturas;
- comentarios de mi madre;
- decisiones del contador;
- indicaciones de clientes.

Pero esa información no debe quedar como un basurero de texto.

Debe pasar por un flujo:

```text
captura cruda
-> propuesta estructurada
-> revisión humana
-> entidad ordenada
-> relaciones
-> estado
-> próximo paso
-> evidencia
```

### 5.6 La IA asiste, no gobierna

La IA puede ayudar a:

- extraer datos;
- sugerir clasificación;
- resumir una conversación;
- convertir texto libre en pasos;
- detectar posibles relaciones;
- proponer tareas;
- explicar bloqueos;
- sugerir reglas.

Pero no debe:

- inventar datos;
- confirmar operaciones críticas sin revisión cuando falte información;
- crear reglas duras sin aprobación;
- postear contabilidad irreversible sin controles;
- cerrar períodos sin evidencia;
- fingir que algo está claro cuando está incompleto.

La IA debe reducir carga mental, no crear falsa seguridad.

### 5.7 Trazabilidad antes que magia

Cada dato importante debe poder responder:

- de dónde salió;
- quién lo cargó;
- quién lo confirmó;
- cuándo cambió;
- qué cambió;
- a qué afecta;
- qué evidencia lo respalda.

La magia sin trazabilidad queda prohibida.

### 5.8 No conservar por nostalgia

Como Convertilabs no tuvo uso real operativo, no hay obligación de conservar compatibilidad histórica si eso empeora la nueva arquitectura.

La regla es:

> Se conserva lo que sirve. Se cambia lo que conviene cambiar. Se elimina lo que estorba.

---

## 6. Lo que se conserva de Convertilabs anterior

Aunque la refundación sea total, hay piezas valiosas.

### 6.1 Nombre y activos externos

Se conserva:

- nombre Convertilabs;
- dominio ya comprado;
- hosting actual;
- repositorio y experiencia acumulada como base de trabajo;
- identidad general del proyecto.

### 6.2 Stack técnico potencialmente útil

Se evalúa conservar:

- Next.js;
- React;
- TypeScript;
- Supabase Auth;
- Supabase Postgres;
- Supabase Storage;
- RLS por organización;
- OpenAI para salidas estructuradas;
- Inngest si aporta a procesos durables;
- Tailwind;
- estructura `app/`, `components/`, `modules/`, `db/`, `supabase/migrations/`, `tests/`.

Nada de esto es sagrado. Pero si funciona, se reutiliza.

### 6.3 Auth, organizaciones y permisos

La lógica multi-tenant por organización sigue siendo útil.

Aunque inicialmente el sistema sea para la empresa propia, conviene conservar una estructura por organización porque permite:

- separar ambientes;
- tener usuarios con roles;
- permitir acceso a contador, operadores o familiares;
- mantener permisos;
- auditar acciones por persona;
- eventualmente abrir otras empresas si hiciera falta.

### 6.4 Motor documental

Se conserva como idea y posiblemente como implementación parcial:

```text
upload
-> storage privado
-> extracción
-> revisión
-> documento canónico
-> relaciones
-> impacto operativo/contable/fiscal
```

Pero deja de ser el centro único del producto.

El documento pasa a ser una entidad importante dentro de un sistema mayor.

### 6.5 Modelo contable multilínea

Se conserva la idea de que una factura no va simplemente “a una cuenta”.

La lógica correcta sigue siendo:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> cuentas por rol
-> preview multilínea
-> asiento
-> open item / settlement cuando aplica
```

Esto es fundamental para el nuevo Convertilabs.

Una factura de combustible asociada a un trabajo debe afectar:

- gasto;
- IVA compras;
- proveedor o banco;
- centro de costo;
- margen del trabajo;
- posible cuenta a pagar;
- evidencia.

### 6.6 Motor IVA y fiscalidad conservadora

Se conserva:

- IVA Uruguay como vertical inicial;
- preview operativo separado de corrida oficial;
- bloqueo cuando faltan datos críticos;
- trazabilidad fiscal;
- exportaciones o integraciones que sirvan.

Pero IVA deja de ser una superficie aislada. Pasa a ser parte del tablero integral de obligaciones, documentos, cierres y vencimientos.

### 6.7 Reglas y aprendizaje

Se conserva la idea de convertir decisiones humanas en reglas reutilizables.

Pero se amplía.

Antes:

```text
la decisión contable puede convertirse en regla contable
```

Ahora:

```text
cualquier decisión operativa repetible puede convertirse en memoria reusable
```

Ejemplos:

- cómo se clasifica una factura de determinado proveedor;
- cómo se paga a cierto proveedor;
- a qué trabajo se suelen asociar ciertos gastos;
- qué hacer cuando llega un certificado;
- qué documentos pide el contador;
- cómo se prepara un trámite;
- cuándo bloquear una operación por falta de información.

---

## 7. Lo que se elimina o redefine

### 7.1 Se elimina la frase “Convertilabs no es un ERP” como tesis

Esa frase solo puede sobrevivir reformulada:

> Convertilabs no es un ERP genérico, pesado y desconectado.

Pero sí será:

> un super ERP personalizado, integral, conectado y diseñado para la empresa real.

### 7.2 Se elimina el alcance chico centrado solo en documentos/contabilidad/IVA

La nueva versión incluye esos dominios, pero no se limita a ellos.

### 7.3 Se elimina la idea de que trabajos, centros de costo y rentabilidad son “más adelante”

En Convertilabs 2.0, trabajos/proyectos/centros de costo son centrales desde el inicio.

El caso “Trabajo Nueva Palmira” no es un módulo futuro. Es un caso fundacional.

### 7.4 Se elimina la navegación heredada como restricción

La navegación anterior puede inspirar, pero no manda.

La nueva navegación debe responder a la empresa completa, no solo al flujo documental.

### 7.5 Se elimina la compatibilidad histórica como prioridad artificial

Si no hay datos reales que preservar, se prioriza un schema limpio y coherente.

---

## 8. Objeto central: el hecho operativo de empresa

Convertilabs 2.0 no debe girar solamente alrededor de documentos.

Debe girar alrededor de hechos operativos.

Un hecho operativo es cualquier cosa relevante que ocurre o debe ocurrir en la empresa.

Ejemplos:

- se inició un trabajo;
- se cargó una factura de compra;
- se emitió una factura de venta;
- se pagó a un proveedor;
- se cobró a un cliente;
- se recibió una llamada;
- se envió documentación al contador;
- vence IVA;
- se abrió un trámite;
- se bloqueó un documento;
- se resolvió una asignación contable;
- se hizo una transferencia;
- se prometió un pago;
- se reclamó un cobro;
- se cerró un proceso;
- se tomó una decisión administrativa.

Cada hecho debe poder conectarse con:

```text
quién
qué
cuándo
dónde
por qué
con qué documento
con qué trabajo
con qué impacto financiero
con qué impacto contable
con qué impacto fiscal
con qué tarea
con qué evidencia
```

---

## 9. Cinco preguntas que todo dato debe responder

Cada cosa que entra a Convertilabs debería intentar responder estas cinco preguntas:

### 9.1 Qué pasó

Ejemplos:

- compra;
- venta;
- gasto;
- cobro;
- pago;
- llamada;
- trámite;
- vencimiento;
- tarea;
- proceso;
- decisión.

### 9.2 A quién involucra

Puede involucrar:

- cliente;
- proveedor;
- contacto;
- contador;
- banco;
- organismo;
- empleado;
- familiar;
- usuario interno.

### 9.3 A qué trabajo, proyecto, operación o centro de costo pertenece

Ejemplos:

- Trabajo Nueva Palmira;
- Administración interna;
- Obra Cliente X;
- Importación equipo Y;
- Servicio mensual Z.

### 9.4 Cómo impacta en dinero, contabilidad e impuestos

Ejemplos:

- ingreso;
- gasto;
- costo;
- margen;
- IVA compras;
- IVA ventas;
- cuenta a cobrar;
- cuenta a pagar;
- banco;
- caja;
- asiento;
- open item;
- settlement.

### 9.5 Qué hay que hacer ahora

Ejemplos:

- revisar;
- pagar;
- cobrar;
- reclamar;
- asociar a trabajo;
- pedir documento;
- confirmar con contador;
- resolver bloqueo;
- cerrar proceso;
- archivar evidencia.

Si alguna respuesta no se sabe, el sistema debe decirlo.

No debe inventar.

---

## 10. Entidades madre del sistema

Para que el sistema sea grande sin volverse caótico, necesita pocas entidades madre.

### 10.1 Organización

Representa la empresa o tenant.

Tablas candidatas:

```text
organizations
organization_members
profiles
```

Debe sostener:

- datos legales;
- RUT;
- razón social;
- usuarios;
- permisos;
- configuración;
- perfil fiscal;
- integraciones;
- reglas.

### 10.2 Personas y entidades: `parties`

Una `party` representa cualquier actor externo o interno relevante.

Puede ser:

- cliente;
- proveedor;
- banco;
- contador;
- organismo;
- contacto;
- transportista;
- socio;
- empleado;
- institución.

No conviene duplicar tablas separadas rígidas desde el principio como si una entidad solo pudiera ser una cosa.

Una misma party puede tener varios roles.

Tablas candidatas:

```text
parties
party_roles
contacts
party_contacts
party_identifiers
```

Ejemplo:

```text
Party: Empresa ABC
Roles: cliente, proveedor
Contactos: Juan, María
Identificadores: RUT, email, teléfono
```

### 10.3 Trabajos, proyectos, operaciones y centros de costo: `work_units`

Esta es una entidad central.

Una `work_unit` representa una unidad de trabajo, proyecto, operación o centro de costo.

Ejemplos:

- Trabajo Nueva Palmira;
- Obra Cliente X;
- Servicio técnico junio;
- Administración;
- Importación máquina Y;
- Mantenimiento interno;
- Departamento comercial;
- Proyecto especial.

Campos candidatos:

```text
id
organization_id
code
name
kind
status
customer_party_id
owner_member_id
start_date
end_date
estimated_revenue
estimated_cost
actual_revenue
actual_cost
margin_status
description
created_at
updated_at
```

`kind` podría ser:

```text
job
project
operation
department
internal_cost_center
service
maintenance
administration
```

Producto visible:

- Trabajo;
- Proyecto;
- Operación;
- Centro de costo.

Técnicamente, una entidad unificada.

### 10.4 Documentos

Representan evidencia documental.

Tipos:

- factura de compra;
- factura de venta;
- recibo;
- comprobante de pago;
- contrato;
- certificado;
- constancia;
- mail exportado;
- archivo subido;
- foto;
- PDF;
- planilla;
- documento de trámite.

Tablas candidatas:

```text
documents
document_lines
document_source_refs
document_invoice_identities
document_processing_runs
document_reviews
```

El documento debe poder asociarse a:

- party emisora;
- party receptora;
- proveedor;
- cliente;
- trabajo;
- período fiscal;
- pago;
- cobro;
- asiento;
- proceso;
- tarea;
- evidencia.

### 10.5 Hechos de negocio: `business_events`

Representan eventos reales o relevantes de la empresa.

Ejemplos:

```text
purchase_invoice_received
sales_invoice_issued
payment_made
collection_received
job_started
job_completed
tax_due
client_called
supplier_claimed
process_run_completed
document_blocked
administrative_decision_recorded
```

Campos candidatos:

```text
id
organization_id
event_type
event_date
occurred_at
summary
status
source_entity_type
source_entity_id
created_by
created_at
metadata_json
```

Los eventos permiten que Convertilabs no sea solo una base de documentos, sino una historia estructurada de la empresa.

### 10.6 Dinero y finanzas

Incluye:

- caja;
- bancos;
- cuentas financieras;
- pagos;
- cobros;
- deudores;
- acreedores;
- vencimientos;
- medios de pago;
- movimientos;
- saldos;
- cuentas corrientes.

Tablas candidatas:

```text
financial_accounts
financial_events
payments
collections
open_items
settlements
cash_movements
bank_movements
```

### 10.7 Contabilidad

Incluye:

- plan de cuentas;
- plantillas contables;
- reglas;
- propuestas;
- asientos;
- líneas de asiento;
- cuentas abiertas;
- settlements;
- cierres.

Tablas candidatas:

```text
chart_of_accounts
accounting_templates
accounting_rules
posting_proposals
journal_entries
journal_entry_lines
ledger_open_items
ledger_settlement_links
fiscal_periods
close_check_runs
close_check_results
```

### 10.8 Impuestos y cumplimiento

Incluye:

- IVA;
- períodos fiscales;
- obligaciones fiscales;
- vencimientos;
- trámites;
- corridas;
- conciliaciones;
- exports;
- certificados.

Tablas candidatas:

```text
tax_periods
tax_events
tax_obligations
vat_runs
compliance_obligations
compliance_cases
compliance_evidence
```

### 10.9 Procesos, tareas y continuidad

Incluye:

- procesos internos;
- manual vivo;
- pasos;
- versiones;
- ejecuciones;
- tareas;
- obligaciones recurrentes;
- bloqueos;
- responsables;
- evidencia;
- conocimiento capturado de mi madre.

Tablas candidatas:

```text
processes
process_versions
process_steps
process_runs
process_run_steps
tasks
obligations
capture_notes
```

### 10.10 Comunicaciones e historial

Incluye:

- llamadas;
- mails;
- WhatsApp resumido manualmente o importado en el futuro;
- reuniones;
- notas;
- promesas;
- reclamos;
- acuerdos;
- interacciones con clientes, proveedores, contador, bancos u organismos.

Tablas candidatas:

```text
interactions
interaction_participants
interaction_links
notes
```

### 10.11 Evidencia y vínculos

Incluye relaciones y prueba.

Tablas candidatas:

```text
entity_links
evidence_refs
source_refs
audit_log
ai_decision_logs
```

---

## 11. Relación universal controlada: `entity_links`

Para que todo pueda estar relacionado con todo sin generar caos, se necesita una tabla de vínculos tipados.

Ejemplo conceptual:

```sql
entity_links (
  id uuid primary key,
  organization_id uuid not null,

  source_entity_type text not null,
  source_entity_id uuid not null,

  target_entity_type text not null,
  target_entity_id uuid not null,

  relation_type text not null,

  created_at timestamptz not null,
  created_by uuid,
  metadata_json jsonb not null default '{}'
);
```

Ejemplos de relaciones:

```text
document -> work_unit -> belongs_to
document -> party -> issued_by
document -> tax_period -> affects
journal_entry -> document -> posted_from
payment -> open_item -> settles
collection -> open_item -> settles
interaction -> party -> involved_party
interaction -> work_unit -> discussed
process_run -> task -> generated
task -> work_unit -> blocks
source_ref -> document -> imported_as
```

Regla:

> Todo puede relacionarse con todo, pero solo mediante relaciones tipadas, auditables y con propósito.

No se permite que la relación viva solamente como texto libre:

```text
“Creo que esta factura era de Nueva Palmira”
```

Debe convertirse en una relación real:

```text
document belongs_to work_unit: Trabajo Nueva Palmira
```

---

## 12. Columnas reales vs `jsonb`

Postgres permite `jsonb`, pero no debe usarse como basurero.

### 12.1 Regla

> Lo que se filtra, ordena, audita, relaciona o aparece en el tablero debe ser columna real.

Ejemplos de columnas reales:

- `status`;
- `due_date`;
- `party_id`;
- `work_unit_id`;
- `document_id`;
- `amount`;
- `currency`;
- `tax_period_id`;
- `assigned_to_member_id`;
- `criticality`;
- `source_entity_type`;
- `relation_type`.

### 12.2 Uso correcto de `jsonb`

`jsonb` puede usarse para:

- metadata secundaria;
- datos de integración externa;
- configuración flexible;
- resultados de IA;
- detalles que no gobiernan el flujo principal;
- payloads crudos preservados.

Ejemplo correcto:

```json
{
  "usual_folder": "Administración/Proveedores/2026",
  "requires_bank_access": true,
  "approval_threshold_amount": 50000,
  "notes_from_mother": "Priorizar este proveedor si hay poco saldo."
}
```

Pero el estado principal, vencimiento, responsable y relación al trabajo deben ser columnas reales.

---

## 13. Caso fundacional: Trabajo Nueva Palmira

Este caso debe guiar la arquitectura.

### 13.1 Situación

Me voy a hacer un trabajo a Nueva Palmira.

Necesito poder crear ese trabajo en Convertilabs y luego asociarle todo:

- cliente;
- presupuesto;
- ventas;
- facturas de gasto;
- combustible;
- alojamiento;
- materiales;
- horas;
- pagos;
- cobros;
- documentos;
- tareas;
- comunicaciones;
- margen;
- IVA;
- contabilidad;
- evidencia.

### 13.2 Crear trabajo

```text
work_unit
name: Trabajo Nueva Palmira
kind: job
status: in_progress
customer_party_id: Cliente X
start_date: 2026-06-17
code: NP-2026-001
```

### 13.3 Cargar factura de gasto

Factura de combustible:

```text
Documento: Factura estación de servicio
Proveedor: Estación X
Fecha: 2026-06-17
Total: $ 4.800
IVA: incluido
Trabajo: Nueva Palmira
```

El sistema debe conectarla con:

```text
documento
-> proveedor
-> work_unit Nueva Palmira
-> línea de gasto
-> IVA compras
-> cuenta a pagar o banco/caja
-> asiento contable
-> costo del trabajo
-> tablero
-> evidencia
```

### 13.4 Cargar factura de venta

```text
Documento: Factura venta servicio
Cliente: Cliente X
Trabajo: Nueva Palmira
Total: $ X
IVA: ventas
Condición: crédito o contado
```

El sistema debe conectarla con:

```text
documento
-> cliente
-> work_unit Nueva Palmira
-> ingreso del trabajo
-> IVA ventas
-> cuenta a cobrar o cobro
-> asiento contable
-> margen del trabajo
-> tablero
```

### 13.5 Vista del trabajo

La vista de Trabajo Nueva Palmira debe mostrar:

```text
Estado: En proceso
Cliente: Cliente X
Inicio: fecha
Responsable: usuario

Ventas asociadas
Gastos asociados
Margen bruto estimado
Cobros pendientes
Pagos pendientes
Documentos sin revisar
Tareas abiertas
Comunicaciones recientes
Bloqueos
Evidencia
```

### 13.6 Resultado esperado

Con una sola vista debería poder responder:

- cuánto facturé por este trabajo;
- cuánto gasté;
- qué margen estimado tengo;
- qué documentos faltan revisar;
- qué tengo pendiente de cobrar;
- qué proveedores debo pagar;
- qué se habló con el cliente;
- qué tareas quedan;
- qué impacto tuvo en IVA;
- qué asiento contable generó.

---

## 14. Pantalla principal: centro de mando de la empresa

La pantalla principal no debe ser un dashboard decorativo.

Debe responder:

> qué está pasando y qué hago ahora.

### 14.1 Bloques principales

La home debería mostrar, como mínimo:

```text
Hoy
- tareas críticas
- documentos pendientes
- vencimientos próximos
- pagos por vencer
- cobros esperados
- bloqueos
```

```text
Trabajos activos
- nombre
- cliente
- estado
- ventas
- costos
- margen estimado
- pendientes
```

```text
Dinero
- deudores
- acreedores
- pagos próximos
- cobros atrasados
- caja/bancos si hay datos
```

```text
Impuestos y trámites
- IVA
- vencimientos fiscales
- trámites abiertos
- certificados
- bloqueos
```

```text
Administración
- procesos pendientes
- procesos críticos no documentados
- cosas que dependen de mi madre
- tareas sin responsable
```

```text
Actividad reciente
- documentos cargados
- pagos registrados
- cobros registrados
- tareas completadas
- comunicaciones importantes
```

### 14.2 Ejemplo de home

```text
Hoy tenés 9 cosas que requieren atención:

- IVA junio vence en 7 días.
- 4 documentos requieren revisión.
- Trabajo Nueva Palmira tiene 2 gastos sin asociar.
- Cliente ABC tiene saldo vencido.
- Proveedor XYZ vence mañana.
- Trámite DGI está bloqueado por falta de certificado.
- Proceso "Pago a proveedores" depende de mamá y no está completamente documentado.
```

### 14.3 Qué no hacer

No hacer:

- gráficos inventados;
- KPIs sin datos reales;
- tablas gigantes como experiencia principal;
- métricas decorativas;
- home vacía que solo diga “subir documentos”;
- navegación tipo ERP con todo al mismo nivel.

---

## 15. Dominios funcionales de Convertilabs 2.0

### 15.1 Inicio / Centro de mando

Responsabilidad:

- mostrar estado general;
- priorizar acciones;
- mostrar alertas;
- conectar con trabajos, documentos, dinero, impuestos, tareas y procesos;
- decir qué hacer ahora.

### 15.2 Directorio

Incluye:

- clientes;
- proveedores;
- contactos;
- bancos;
- contador;
- organismos;
- instituciones.

Debe permitir ver para cada party:

- datos;
- roles;
- documentos asociados;
- trabajos asociados;
- cuentas corrientes;
- historial de comunicaciones;
- tareas;
- notas;
- evidencia.

### 15.3 Trabajos / proyectos / operaciones

Incluye:

- creación de trabajos;
- estado;
- cliente;
- costos;
- ventas;
- margen;
- documentos;
- tareas;
- comunicaciones;
- cobranzas;
- pagos;
- evidencia.

Este dominio es central desde el inicio.

### 15.4 Documentos

Incluye:

- ingreso manual;
- upload;
- foto;
- PDF;
- planilla;
- importaciones;
- extracción;
- revisión;
- asignación a party;
- asignación a trabajo;
- impacto contable;
- impacto fiscal;
- pagos/cobros;
- evidencia.

### 15.5 Ventas

Incluye:

- facturas de venta;
- clientes;
- trabajos asociados;
- ingresos;
- IVA ventas;
- cuentas a cobrar;
- cobros;
- margen;
- historial comercial.

### 15.6 Compras y gastos

Incluye:

- facturas de compra;
- proveedores;
- gastos;
- materiales;
- costos de trabajo;
- IVA compras;
- cuentas a pagar;
- pagos;
- comprobantes.

### 15.7 Dinero

Incluye:

- caja;
- bancos;
- cobros;
- pagos;
- deudores;
- acreedores;
- vencimientos;
- conciliaciones futuras;
- flujo de fondos operativo.

### 15.8 Contabilidad

Incluye:

- plan de cuentas;
- plantillas;
- reglas;
- asientos;
- libro diario;
- balance;
- open items;
- settlements;
- cierres;
- exportaciones.

La contabilidad no debe ser una isla. Debe ser consecuencia de hechos operativos.

### 15.9 Impuestos y trámites

Incluye:

- IVA;
- vencimientos;
- DGI;
- BPS si entra luego;
- certificados;
- trámites;
- obligaciones recurrentes;
- evidencia;
- relación con contador.

### 15.10 Procesos y continuidad

Incluye:

- manual vivo;
- procesos que hoy hace mi madre;
- pasos;
- frecuencia;
- responsable;
- vencimientos;
- tareas;
- evidencia;
- riesgos;
- modo continuidad.

### 15.11 Comunicaciones / historial

Incluye:

- llamadas;
- mails;
- notas;
- reuniones;
- seguimiento a clientes;
- seguimiento a proveedores;
- reclamos;
- promesas;
- acuerdos.

Debe conectar con parties, trabajos, documentos y tareas.

### 15.12 Integraciones

Incluye:

- ZetaSoftware;
- email;
- planillas;
- bancos futuros;
- DGI/BPS futuros;
- imports/exports;
- APIs externas.

Las integraciones no deben gobernar el modelo. Deben alimentar o consumir el modelo canónico de Convertilabs.

### 15.13 Inteligencia y memoria

Incluye:

- asistente;
- reglas;
- sugerencias;
- resúmenes;
- criterios aprendidos;
- explicaciones;
- detección de bloqueos;
- propuesta de próximos pasos.

---

## 16. Procesos internos: manual vivo de la empresa

Uno de los módulos más importantes será el de procesos administrativos.

Este módulo debe capturar el conocimiento que hoy está en la cabeza de mi madre o disperso en la práctica diaria.

### 16.1 No crear una tabla por proceso

No hacer:

```text
tabla_pago_a_proveedores
tabla_iva_mensual
tabla_renovar_certificado_dgi
```

Hacer:

```text
processes
process_versions
process_steps
process_runs
process_run_steps
tasks
obligations
capture_notes
```

El proceso es una fila, no una tabla.

### 16.2 Estructura

Un proceso tiene:

- nombre;
- categoría;
- descripción;
- criticidad;
- responsable actual;
- responsable futuro;
- estado;
- frecuencia;
- pasos;
- documentos necesarios;
- contactos involucrados;
- sistemas usados;
- evidencia requerida;
- riesgos;
- próxima ejecución;
- historial.

### 16.3 Separar definición de ejecución

Definición:

```text
Cómo se paga a proveedores normalmente.
```

Ejecución:

```text
Pago a proveedores semana del 17 de junio de 2026.
```

Tablas conceptuales:

```text
processes              -> ficha general
process_versions       -> versión del procedimiento
process_steps          -> pasos de una versión
process_runs           -> ejecución concreta
process_run_steps      -> estado de cada paso en una ejecución
tasks                  -> tareas derivadas o sueltas
obligations            -> recurrencias y vencimientos
capture_notes          -> texto crudo antes de estructurar
```

### 16.4 Ejemplo: Pago a proveedores

Proceso:

```text
Nombre: Pago a proveedores
Categoría: dinero / administración
Criticidad: alta
Responsable actual: mamá
Responsable futuro: yo
Frecuencia: semanal
```

Pasos:

```text
1. Revisar facturas pendientes.
2. Identificar vencimientos.
3. Verificar saldo de caja/banco.
4. Priorizar proveedores críticos.
5. Decidir pagos de la semana.
6. Preparar transferencias.
7. Guardar comprobantes.
8. Asociar comprobantes a facturas.
9. Marcar pagos como completados.
```

Ejecución:

```text
Pago a proveedores - semana 2026-06-17
Estado: bloqueado
Motivo: falta saldo bancario actualizado
Próximo paso: verificar saldo
```

### 16.5 Ejemplo: Preparación de IVA mensual

Proceso:

```text
Nombre: Preparación IVA mensual
Categoría: impuestos
Criticidad: crítica
Frecuencia: mensual
```

Pasos:

```text
1. Verificar compras del período.
2. Verificar ventas del período.
3. Revisar documentos bloqueados.
4. Resolver documentos sin asignación.
5. Generar preview operativo.
6. Revisar diferencias.
7. Consultar contador si corresponde.
8. Generar corrida oficial.
9. Guardar reporte y constancias.
```

### 16.6 Ejemplo: Renovar certificado DGI

Proceso:

```text
Nombre: Renovación certificado DGI
Categoría: trámites
Criticidad: alta
Frecuencia: anual o según vencimiento
```

Pasos:

```text
1. Revisar fecha de vencimiento actual.
2. Confirmar requisitos con contador.
3. Reunir documentación.
4. Enviar documentación.
5. Confirmar renovación.
6. Guardar certificado.
7. Actualizar próximo vencimiento.
```

### 16.7 Niveles de madurez de procesos

No todo proceso nace perfecto.

Niveles:

```text
Nivel 0: capturado como nota cruda
Nivel 1: borrador estructurado
Nivel 2: pasos revisados
Nivel 3: responsable y frecuencia definidos
Nivel 4: activo y genera tareas
Nivel 5: tiene evidencia histórica y reglas aprendidas
```

El tablero debe mostrar:

```text
Procesos críticos:
- 5 activos
- 3 incompletos
- 2 dependen de mamá
- 1 sin responsable futuro
```

---

## 17. Estados canónicos

Para evitar caos, los estados deben ser controlados.

### 17.1 Estados de trabajos

```text
draft
planned
in_progress
paused
blocked
completed
cancelled
archived
```

### 17.2 Estados de documentos

```text
uploaded
processing
pending_review
pending_assignment
blocked
ready_to_post
posted_provisional
posted_final
cancelled
archived
```

### 17.3 Estados de tareas

```text
pending
in_progress
blocked
done
cancelled
```

### 17.4 Estados de procesos

```text
draft
active
archived
```

### 17.5 Estados de ejecuciones de proceso

```text
pending
in_progress
blocked
completed
cancelled
```

### 17.6 Regla de bloqueo

Todo bloqueo debe tener motivo visible.

No alcanza:

```text
Bloqueado
```

Debe decir:

```text
Bloqueado porque falta documento.
Bloqueado porque falta aprobación.
Bloqueado porque falta saldo bancario.
Bloqueado porque hay que consultar al contador.
Bloqueado porque falta asignar trabajo.
```

---

## 18. Modelo técnico inicial sugerido

Este no es el schema final, pero sí un mapa conceptual para la refundación.

```text
core
  profiles
  organizations
  organization_members
  organization_settings

identity / directory
  parties
  party_roles
  contacts
  party_contacts
  party_identifiers

work
  work_units
  work_unit_status_events
  work_unit_financial_snapshots

documents
  documents
  document_lines
  document_source_refs
  document_invoice_identities
  document_processing_runs
  document_reviews

business events
  business_events
  entity_links
  evidence_refs
  source_refs

money
  financial_accounts
  financial_events
  open_items
  payments
  collections
  settlements
  bank_movements
  cash_movements

accounting
  chart_of_accounts
  accounting_templates
  accounting_rules
  posting_proposals
  journal_entries
  journal_entry_lines
  ledger_open_items
  ledger_settlement_links

tax / compliance
  tax_periods
  tax_events
  tax_obligations
  vat_runs
  compliance_cases
  compliance_evidence

operations
  processes
  process_versions
  process_steps
  process_runs
  process_run_steps
  tasks
  obligations
  capture_notes

communications
  interactions
  interaction_participants
  interaction_links
  notes

integrations
  integration_connections
  integration_raw_records
  integration_entity_links
  exports
  imports

audit / intelligence
  audit_log
  ai_decision_logs
  assistant_runs
  assistant_messages
  assistant_suggestions
```

---

## 19. Arquitectura de módulos sugerida

Estructura conceptual:

```text
modules/
  core/
  directory/
  work/
  documents/
  commerce/
  money/
  accounting/
  tax/
  operations/
  communications/
  integrations/
  intelligence/
  presentation/
```

### 19.1 `core`

- organización;
- usuarios;
- permisos;
- settings;
- roles;
- tenancy.

### 19.2 `directory`

- parties;
- roles de party;
- contactos;
- identidad fiscal;
- datos de clientes/proveedores/bancos/organismos.

### 19.3 `work`

- trabajos;
- proyectos;
- centros de costo;
- estados;
- margen;
- asociación de documentos;
- resumen operativo.

### 19.4 `documents`

- intake;
- extracción;
- revisión;
- líneas;
- fuentes;
- identidad documental;
- deduplicación;
- evidencia.

### 19.5 `commerce`

- ventas;
- compras;
- presupuestos futuros;
- comprobantes;
- relación con clientes/proveedores.

### 19.6 `money`

- caja;
- bancos;
- pagos;
- cobros;
- deudores;
- acreedores;
- vencimientos financieros.

### 19.7 `accounting`

- plan de cuentas;
- reglas;
- plantillas;
- asientos;
- open items;
- settlements;
- reportes contables.

### 19.8 `tax`

- IVA;
- períodos;
- vencimientos;
- trámites fiscales;
- exportaciones;
- bloqueos fiscales.

### 19.9 `operations`

- procesos;
- tareas;
- obligaciones;
- checklists;
- continuidad administrativa;
- manual vivo.

### 19.10 `communications`

- interacciones;
- notas;
- historial con clientes/proveedores;
- links a trabajos y tareas.

### 19.11 `integrations`

- ZetaSoftware;
- planillas;
- email;
- bancos futuros;
- imports/exports;
- raw records.

### 19.12 `intelligence`

- asistente;
- propuestas;
- resúmenes;
- aprendizaje;
- reglas sugeridas;
- explicaciones.

### 19.13 `presentation`

- read models;
- home;
- tarjetas;
- estados visibles;
- textos;
- navegación;
- dashboards operativos.

---

## 20. Navegación inicial sugerida

La navegación debe ser simple aunque el sistema sea grande.

Opciones posibles:

### Opción A

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Más
```

### Opción B

```text
Inicio
Operación
Documentos
Dinero
Contactos
Más
```

### Opción C

```text
Inicio
Trabajos
Ventas/Compras
Dinero
Agenda
Más
```

`Más` puede incluir:

- Contabilidad;
- IVA / Impuestos;
- Procesos;
- Trámites;
- Contactos;
- Integraciones;
- Auditoría;
- Ajustes.

La decisión final debe salir de la pregunta:

> ¿Qué necesito ver primero cuando abro Convertilabs para saber dónde estoy parado?

---

## 21. UX: grande por dentro, simple por fuera

Convertilabs 2.0 puede ser enorme por dentro, pero debe sentirse claro por fuera.

### 21.1 Reglas UX

- una pantalla debe tener una intención principal;
- no mostrar tablas gigantes como experiencia principal;
- usar vistas enfocadas;
- mostrar bloqueos con motivos;
- usar CTAs claros;
- permitir profundizar sin obligar a ver todo;
- mostrar relaciones relevantes en contexto;
- evitar dashboards decorativos;
- priorizar “qué hago ahora”.

### 21.2 Mobile y desktop

Mobile debe servir especialmente para:

- capturar documentos;
- sacar fotos;
- revisar tareas;
- ver alertas;
- cargar notas rápidas;
- consultar trabajos;
- registrar interacciones simples.

Desktop debe servir especialmente para:

- revisión profunda;
- contabilidad;
- IVA;
- reportes;
- administración de procesos;
- gestión de trabajos;
- análisis financiero;
- configuración.

---

## 22. Regla de implementación: pensar grande, construir por cortes

No se debe cometer el error de pensar chico.

Pero tampoco se debe intentar implementar todo de golpe.

La regla es:

> El modelo debe nacer grande. La implementación debe avanzar por cortes operativos completos.

Un corte operativo completo significa que una funcionalidad entra conectada al sistema, no como isla.

Mal:

```text
crear módulo de tareas aislado
crear módulo de clientes aislado
crear módulo de trabajos aislado
crear módulo de documentos aislado
```

Bien:

```text
crear work_unit
conectarla a party
conectarla a documentos
conectarla a dinero
conectarla a tareas
mostrarla en Inicio
```

---

## 23. Roadmap refundacional

### Fase 0 — Documento rector y alineación

Objetivo:

- crear este documento refundacional;
- declarar que Convertilabs 2.0 reemplaza la tesis anterior;
- identificar qué docs viejos quedan obsoletos;
- actualizar reglas para Codex/agentes;
- decidir estructura inicial del nuevo roadmap.

Entregables:

```text
docs/00-refundacion-convertilabs.md
agent_rules.md actualizado
roadmap 2.0
mapa de dominios
```

### Fase 1 — Modelo madre

Objetivo:

Crear las entidades base que permitan que todo se conecte.

Incluye:

- parties;
- party_roles;
- contacts;
- work_units;
- documents con relación a party y work_unit;
- business_events;
- entity_links;
- evidence_refs;
- read model inicial para Inicio.

### Fase 2 — Caso Nueva Palmira

Objetivo:

Hacer funcionar el primer caso real de punta a punta.

Incluye:

- crear trabajo;
- asociar cliente;
- cargar factura de gasto;
- asociar gasto al trabajo;
- cargar venta;
- asociar venta al trabajo;
- ver margen básico;
- ver documentos;
- ver tareas;
- ver impacto en IVA/contabilidad cuando aplique.

### Fase 3 — Deudores, acreedores y dinero

Objetivo:

Saber quién debe, a quién debo y qué vence.

Incluye:

- open items;
- cuentas a cobrar;
- cuentas a pagar;
- cobros;
- pagos;
- vencimientos;
- tablero financiero básico.

### Fase 4 — Procesos y continuidad administrativa

Objetivo:

Capturar lo que hoy sabe mi madre.

Incluye:

- procesos;
- versiones;
- pasos;
- tareas;
- obligaciones recurrentes;
- notas crudas;
- conversión a estructura;
- vista de riesgos de continuidad.

### Fase 5 — Historial de contactos

Objetivo:

Que cada cliente/proveedor tenga memoria.

Incluye:

- interacciones;
- notas;
- llamadas;
- mails resumidos;
- promesas;
- reclamos;
- links a trabajos, documentos y tareas.

### Fase 6 — IVA, trámites y cierre integrados al tablero

Objetivo:

Que impuestos y administración no sean una pantalla aislada.

Incluye:

- vencimientos fiscales;
- estado del período;
- documentos faltantes;
- bloqueos;
- tareas asociadas;
- evidencia;
- relación con contador.

### Fase 7 — Integraciones

Objetivo:

Usar sistemas externos como fuentes o destinos, no como centro conceptual.

Incluye:

- ZetaSoftware;
- CFE recibidos;
- centros de costo;
- asientos;
- comprobantes;
- planillas;
- imports/exports;
- raw records auditables.

### Fase 8 — Inteligencia operativa

Objetivo:

Que Convertilabs sugiera, explique y ayude a decidir.

Incluye:

- resúmenes;
- alertas;
- detección de bloqueos;
- reglas sugeridas;
- próximos pasos;
- aprendizaje de decisiones;
- modo continuidad.

---

## 24. MVP real: primer corte operativo, no producto chico

En esta refundación, MVP no significa “hacer poco sin pensar el resto”.

MVP significa:

> primer corte operativo que prueba la arquitectura grande.

El MVP debería demostrar:

1. crear una empresa/organización;
2. crear clientes/proveedores;
3. crear un trabajo;
4. cargar documentos;
5. asociar documentos a trabajo y party;
6. ver ventas/gastos del trabajo;
7. ver margen básico;
8. ver deudores/acreedores básicos;
9. ver vencimientos/tareas;
10. ver todo en Inicio.

El caso de prueba principal:

```text
Trabajo Nueva Palmira
```

Si ese caso funciona, la refundación va por buen camino.

---

## 25. Reglas para evitar que el super ERP se vuelva monstruo

### 25.1 No módulos isla

Toda nueva feature debe conectarse a entidades madre.

### 25.2 No estados libres

Los estados deben ser canónicos.

### 25.3 No texto libre como fuente principal

El texto libre puede existir, pero subordinado a estructura.

### 25.4 No duplicar entidades

Un cliente no debe existir como cliente en ventas, como contacto en CRM y como party en documentos sin conexión.

Debe existir una party con roles y relaciones.

### 25.5 No crear tablas dinámicas por cada realidad

Los procesos, trabajos, trámites y documentos son filas dentro de estructuras estables.

### 25.6 No dashboards decorativos

La home debe mostrar estado real y próximas acciones.

### 25.7 No falsa precisión

Si falta un dato, se marca como pendiente, asistido o bloqueado.

### 25.8 No automatización sin evidencia

Toda automatización importante debe tener explicación y trazabilidad.

### 25.9 No conservar deuda por compatibilidad inexistente

Si no hay uso real ni datos reales que preservar, se puede reescribir.

### 25.10 No construir por miedo a que sea grande

El sistema debe ser grande en diseño. Lo importante es que esté bien estructurado.

---

## 26. Nueva regla para agentes/Codex

El archivo de reglas para agentes debe cambiar radicalmente.

Propuesta:

```text
Convertilabs 2.0 ya no es solo un motor documental, contable y fiscal.

Convertilabs 2.0 es el sistema operativo integral de gestión de la empresa.

Toda feature debe reforzar al menos uno de estos objetivos:

1. capturar hechos reales de la empresa;
2. conectar esos hechos con personas, trabajos, documentos, dinero, impuestos, tareas y evidencia;
3. reducir dependencia de memoria humana no documentada;
4. mostrar estado operativo claro;
5. preservar trazabilidad;
6. ayudar a decidir qué hacer ahora;
7. convertir decisiones repetibles en memoria reusable.

No conservar código, schema, navegación o documentación anterior por compatibilidad si no hay datos reales ni uso operativo que proteger.

No construir módulos aislados. Toda nueva entidad debe integrarse al modelo madre o justificar claramente por qué existe.
```

---

## 27. Documentos heredados a actualizar

Los documentos anteriores deben ser revisados y probablemente reemplazados o marcados como legacy.

### 27.1 Documentos a reescribir

- `agent_rules.md`
- `00-core-product-and-organization.md`
- `01-workflows-ux-and-surfaces.md`
- `02-accounting-tax-and-integrations.md`
- `03-platform-quality-and-roadmap.md`

### 27.2 Nueva documentación sugerida

```text
docs/00-refundacion-convertilabs.md
docs/01-modelo-empresa-conectada.md
docs/02-dominios-y-entidades-madre.md
docs/03-ux-centro-de-mando.md
docs/04-work-units-trabajos-centros-costo.md
docs/05-procesos-continuidad-administrativa.md
docs/06-contabilidad-impuestos-dinero.md
docs/07-integraciones-zeta-y-fuentes-externas.md
docs/08-roadmap-convertilabs-2.md
```

---

## 28. Relación con ZetaSoftware

Zeta puede seguir siendo importante, pero debe ubicarse correctamente.

Zeta no debe definir el modelo interno de Convertilabs.

Zeta debe ser:

- fuente externa;
- destino de exportación;
- sistema contable/operativo interoperable;
- proveedor de datos;
- puente para asientos, CFEs, centros de costo, comprobantes o contactos si conviene.

Convertilabs debe mantener su modelo canónico propio.

Ejemplo:

```text
Convertilabs work_unit -> Zeta CentroCostos
Convertilabs party -> Zeta Contacto / Cliente / Proveedor
Convertilabs journal_entry -> Zeta Bandeja Entrada Asientos
Convertilabs document -> Zeta CFE / comprobante / referencia
```

Pero internamente, la verdad de Convertilabs debe ser:

```text
party
work_unit
document
business_event
journal_entry
tax_event
payment
collection
task
process
entity_link
```

---

## 29. Ejemplo completo de flujo integral

### 29.1 Se crea un trabajo

```text
Trabajo: Nueva Palmira
Cliente: Cliente X
Estado: En proceso
```

Impacta:

- lista de trabajos activos;
- tablero principal;
- futuro centro de costo;
- posibles tareas iniciales.

### 29.2 Se carga gasto de combustible

```text
Factura combustible
Proveedor: Estación X
Total: $ 4.800
Trabajo: Nueva Palmira
```

Impacta:

- documentos;
- proveedor;
- gasto;
- IVA compras;
- costo del trabajo;
- cuenta a pagar o pago;
- contabilidad;
- tablero.

### 29.3 Se emite venta

```text
Factura Cliente X
Trabajo: Nueva Palmira
Total: $ 25.000
```

Impacta:

- documentos;
- cliente;
- ingresos;
- IVA ventas;
- cuenta a cobrar;
- margen del trabajo;
- contabilidad;
- tablero.

### 29.4 Se registra cobro

```text
Cobro Cliente X
Medio: banco
Monto: $ 25.000
```

Impacta:

- cuenta corriente del cliente;
- banco;
- open item;
- settlement;
- trabajo;
- tablero financiero.

### 29.5 Se revisa home

La home muestra:

```text
Trabajo Nueva Palmira
Ventas: $ 25.000
Costos: $ 4.800
Margen bruto estimado: $ 20.200
Cobrado: sí
Documentos pendientes: 0
Tareas abiertas: 1
```

Esto es Convertilabs 2.0.

---

## 30. Modo continuidad

Debe existir una vista especial:

```text
Modo continuidad
```

Pregunta que responde:

> Si mañana tengo que hacerme cargo de la empresa, ¿qué necesito saber?

Debe mostrar:

- procesos críticos;
- procesos no documentados;
- procesos que dependen de mi madre;
- próximos vencimientos;
- trámites abiertos;
- accesos/sistemas involucrados;
- contactos esenciales;
- documentos importantes;
- tareas sin responsable;
- decisiones recurrentes no convertidas en regla;
- riesgos operativos.

Ejemplo:

```text
Riesgos de continuidad

Alto:
- Pago a proveedores depende de mamá y no tiene pasos completos.
- Renovación certificado DGI tiene vencimiento cargado pero no evidencia requerida.
- Control bancario no tiene responsable futuro.

Medio:
- Envío mensual al contador está documentado parcialmente.
- Clasificación de gastos de importación requiere criterio de mamá.
```

Este modo es una de las razones profundas de Convertilabs 2.0.

---

## 31. Criterios de éxito

Convertilabs 2.0 será exitoso si permite:

1. abrir la app y entender el estado real de la empresa;
2. ver trabajos activos y su rentabilidad básica;
3. asociar compras y ventas a trabajos;
4. saber qué debo y qué me deben;
5. ver vencimientos fiscales y administrativos;
6. capturar procesos que hoy dependen de memoria;
7. relacionar clientes/proveedores con documentos, trabajos, comunicaciones y saldos;
8. evitar duplicidad y caos documental;
9. mantener trazabilidad contable y fiscal;
10. reducir ansiedad administrativa;
11. transferir conocimiento de mi madre al sistema;
12. permitir tomar decisiones con información suficiente.

---

## 32. Decisiones abiertas

Estas decisiones deben resolverse en próximas etapas.

### 32.1 Nombre visible de `work_units`

Opciones:

- Trabajos;
- Proyectos;
- Operaciones;
- Centros de costo;
- Trabajos y proyectos.

Para la empresa actual, probablemente “Trabajos” sea el mejor nombre visible inicial.

### 32.2 Navegación principal

Definir si la nav principal será:

```text
Inicio / Trabajos / Documentos / Dinero / Agenda / Más
```

u otra variante.

### 32.3 Alcance inicial de dinero

Definir si el primer corte incluye:

- open items básicos;
- pagos/cobros manuales;
- bancos;
- caja;
- conciliación posterior.

### 32.4 Estrategia de migración

Definir si se hará:

- migración limpia;
- reset del schema;
- rama nueva;
- conservación parcial;
- extracción selectiva de módulos.

### 32.5 Rol de Zeta en la primera etapa

Definir si Zeta entra:

- desde el inicio;
- después del modelo canónico;
- solo como export;
- como import/export bidireccional.

---

## 33. Próximo paso recomendado

El próximo paso no debería ser programar una pantalla aislada.

El próximo paso debería ser:

1. guardar este documento como rector de la refundación;
2. marcar documentación anterior como legacy o subordinada;
3. actualizar `agent_rules.md`;
4. definir el schema conceptual mínimo;
5. diseñar el caso Nueva Palmira de punta a punta;
6. auditar el repo con etiquetas `KEEP`, `REWRITE`, `DELETE`;
7. crear roadmap técnico de Fase 1.

---

## 34. Auditoría del repo: KEEP / REWRITE / DELETE

### 34.1 KEEP candidato

- auth si está sano;
- organizations y memberships;
- Supabase Storage;
- RLS;
- estructura modular;
- motor documental aprovechable;
- motor contable multilínea;
- IVA Uruguay;
- reglas contables;
- audit log;
- OpenAI structured outputs;
- integraciones si están bien diseñadas.

### 34.2 REWRITE candidato

- tesis del producto;
- agent rules;
- dashboard;
- navegación;
- home;
- modelo de trabajos;
- modelo de clientes/proveedores/contactos;
- procesos administrativos;
- continuidad;
- historial de comunicaciones;
- documentación oficial;
- roadmap.

### 34.3 DELETE candidato

- restricciones “no ERP”;
- pantallas que respondan solo a la beta documental;
- rutas legacy sin utilidad;
- features preparadas para vender afuera antes de servir internamente;
- configuraciones sin retorno operativo;
- cualquier schema que fuerce la tesis anterior.

---

## 35. Resumen final

Convertilabs 2.0 no es una ampliación menor.

Es una refundación.

La nueva dirección es:

> Convertir Convertilabs en el super ERP personalizado de la empresa: una herramienta integral donde toda la operación, administración, contabilidad, dinero, impuestos, trabajos, clientes, proveedores, procesos, trámites, comunicaciones y decisiones queden conectados en un solo sistema.

El objetivo final no es tener más software.

El objetivo final es tener más control, más claridad y más continuidad.

Convertilabs debe permitir mirar la empresa y entender:

```text
qué está pasando
qué falta
qué vence
qué se debe
qué me deben
qué trabajo está en curso
qué margen tiene
qué documento falta
qué proceso está bloqueado
qué decisión se tomó
qué hizo mamá antes
qué tengo que hacer ahora
```

Ese es el Convertilabs que hay que construir.

