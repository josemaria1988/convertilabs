# 00 - Core Product And Organization

## Para Que Existe Este Documento

Este documento resume la tesis oficial de Convertilabs 2.0, el alcance operativo inicial, la organizacion multi-tenant y el mapa de dominios madre.

Leerlo antes de tocar:

- alcance de producto;
- auth, onboarding y memberships;
- organizaciones y permisos;
- nomenclatura de superficies;
- decisiones que cambien el perimetro de Convertilabs 2.0.

## 1. Tesis Del Producto

Convertilabs 2.0 es el sistema operativo integral de gestion y continuidad de la empresa.

Tambien puede describirse como:

> un super ERP personalizado que captura hechos reales de la empresa y los conecta con personas, trabajos, documentos, dinero, contabilidad, impuestos, tareas, procesos, evidencia e historial.

La frase rectora es:

> Toda la empresa, conectada y entendible.

Convertilabs no busca copiar un ERP generico. Busca ordenar la empresa real con un modelo profundo y pantallas enfocadas.

## 2. Destino Inicial

El destino inicial es la empresa propia.

Primero debe servir para:

- ver donde esta parada la empresa;
- saber que falta hacer;
- asociar documentos a trabajos y personas;
- saber que se debe y que me deben;
- ver vencimientos, tareas y bloqueos;
- capturar procesos que dependen de memoria humana;
- preparar continuidad administrativa;
- sostener contabilidad, IVA y cierre con evidencia.

Abrir el producto como SaaS externo queda fuera de prioridad hasta que el piloto interno funcione.

## 3. Activos Que Se Conservan

Se conservan como base util:

- nombre Convertilabs;
- dominio y hosting existentes;
- Next.js, React y TypeScript;
- Supabase Auth, Postgres y Storage;
- RLS por organizacion;
- OpenAI para salidas estructuradas;
- Inngest para procesos durables;
- documentos, storage privado y extraccion;
- kernel contable multilinea;
- reglas contables y aprendizaje;
- IVA Uruguay;
- cierre;
- open items y settlements;
- imports/exports;
- Zeta como integracion externa;
- audit logs y trazabilidad.

Nada de esto es sagrado. Se conserva lo que sirva a la vision nueva.

## 4. Entidades Madre

El modelo objetivo se organiza alrededor de:

- `organizations`, `organization_members`, `profiles`;
- `parties`, `party_roles`, `contacts`, `party_contacts`, `party_identifiers`;
- `work_units`;
- `documents`;
- `business_events`;
- `entity_links`;
- `evidence_refs`;
- dinero: open items, pagos, cobros, bancos, caja y settlements;
- operaciones: tasks, processes, obligations y capture notes;
- communications: interactions e historial;
- accounting, tax, close e integrations como dominios especializados.

## 5. Auth, Tenancy Y Organizacion

La plataforma sigue siendo multi-tenant por organizacion.

Tablas base actuales:

- `profiles`
- `organizations`
- `organization_members`

La organizacion se resuelve por slug y membresia activa.

Roles actuales a conservar inicialmente:

- `owner`
- `admin`
- `admin_processing`
- `accountant`
- `reviewer`
- `operator`
- `developer`
- `viewer`

La logica por organizacion sigue siendo util aunque el primer uso sea interno: permite acceso a contador, familiares, operadores y soporte sin perder auditoria.

## 6. Dominios Oficiales

Dominios actuales fuertes:

- `auth`
- `organizations`
- `documents`
- `accounting`
- `tax`
- `close`
- `assistant`
- `audit`
- `imports`
- `exports`
- `integrations`
- `spreadsheets`
- `presentation`

Dominios a crear o elevar durante Convertilabs 2.0:

- `directory`
- `work`
- `events`
- `money`
- `operations`
- `communications`
- `continuity`
- `intelligence`

## 7. Estado Actual Frente A La Refundacion

### KEEP

- auth y tenancy;
- Supabase y RLS base;
- documentos e intake;
- motor contable multilinea;
- IVA Uruguay;
- cierre;
- open items;
- imports/exports;
- Zeta;
- IA estructurada;
- auditabilidad.

### REWRITE

- tesis de producto;
- navegacion;
- Inicio/dashboard;
- clientes/proveedores hacia `parties`;
- proyectos/centros de costo hacia `work_units`;
- dinero como dominio visible;
- procesos, tareas y continuidad;
- historial de contactos;
- documentacion oficial.

### DELETE O LEGACY

- restricciones de producto que impidan el sistema integral;
- rutas o copy que pongan documentos/IVA como centro unico;
- features sin conexion al modelo madre;
- links rotos o docs obsoletos como fuente activa.

## 8. Rutas Actuales Y Rutas Objetivo

Rutas privadas existentes que siguen vivas mientras se migra:

- `/app/o/[slug]/dashboard`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/review`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/close`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/advanced`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/rules`

Rutas objetivo a implementar por etapas:

- `/app/o/[slug]/dashboard` como Inicio real;
- `/app/o/[slug]/work`;
- `/app/o/[slug]/money`;
- `/app/o/[slug]/agenda`;
- `/app/o/[slug]/directory`;
- `/app/o/[slug]/continuity`.

## 9. Criterio De Exito

El core esta alineado cuando Convertilabs permite crear una organizacion, crear parties, crear un trabajo, asociar documentos, ver ventas/gastos/margen, ver deudores/acreedores, ver tareas/vencimientos y entender todo desde Inicio.
