# 03 - Platform, Quality And Roadmap

## Para Que Existe Este Documento

Este documento resume la plataforma real del repo, las reglas de calidad y el roadmap tecnico para ejecutar Convertilabs 2.0.

Leerlo si vas a tocar:

- schema;
- migraciones;
- RLS;
- APIs;
- background jobs;
- OpenAI/Inngest;
- tests;
- roadmap;
- hardening.

## 1. Stack Actual

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres y Storage
- OpenAI Responses API
- Inngest
- Tailwind CSS 4
- ESLint 9

## 2. Estructura Del Repo

```text
app/
components/
db/
docs/
lib/
modules/
supabase/migrations/
tests/
scripts/
```

Regla:

- `app/` compone rutas y server actions;
- `components/` presenta UI;
- `modules/` contiene dominio;
- `db/schema/` es referencia canonica;
- `supabase/migrations/` es historial aplicable;
- `db/rls/` gobierna seguridad;
- `tests/` prueba comportamiento.

## 3. Dominios Actuales

Fuertes hoy:

- auth;
- organizations;
- documents;
- accounting;
- tax;
- close;
- assistant;
- audit;
- imports;
- exports;
- integrations;
- spreadsheets;
- presentation.

Nuevos o a elevar:

- directory;
- work;
- events;
- money;
- operations;
- communications;
- continuity;
- intelligence.

## 4. Persistencia

El esquema vive en dos niveles:

1. `db/schema/00..09_*` como referencia canonica consolidada;
2. `supabase/migrations/` como historial aplicable real.

Si se toca persistencia:

- actualizar schema canonico;
- crear migracion;
- revisar RLS;
- agregar indices;
- agregar tests;
- verificar paridad cuando corresponda.

## 5. RLS Y Tenancy

Toda entidad nueva multi-tenant debe tener:

- `organization_id`;
- FK a `organizations`;
- indices por organizacion;
- RLS de select por miembro activo;
- RLS de insert/update/delete por roles adecuados;
- tests o smokes de aislamiento.

Nunca resolver permisos sensibles moviendo logica al cliente.

## 6. OpenAI E Inngest

Se conservan:

- `lib/llm/openai-responses.ts`;
- `modules/ai`;
- `modules/assistant`;
- Inngest para procesos durables.

La IA nueva debe funcionar como sugerencia revisable. No debe modificar entidades criticas sin aceptacion humana o regla segura.

## 7. Roadmap Tecnico

### PR-00 - Documentacion refundacional

Docs, README, reglas, indice documental y auditoria KEEP/REWRITE/DELETE.

### PR-01 - Schema madre

`directory`, `work`, `events`, RLS y tests:

- `party_roles`;
- `contacts`;
- `party_contacts`;
- `party_identifiers`;
- `work_units`;
- `business_events`;
- `entity_links`;
- `evidence_refs`.

### PR-02 - Adaptadores legacy

Puentes:

- `documents.work_unit_id`;
- cost center -> work unit;
- vendors/customers -> parties;
- sin romper reviewer actual.

### PR-03 - Navegacion e Inicio 2.0

Inicio real, nav nueva, empty states honestos y read model inicial.

### PR-04 - Trabajos MVP

Listado, creacion, detalle, party cliente, documentos y resumen base.

### PR-05 - Nueva Palmira E2E

Cliente + trabajo + gasto + venta + margen + documentos + Inicio.

### PR-06 - Money MVP

Deudores, acreedores, vencimientos, cobros, pagos y settlements basicos.

### PR-07 - Tasks y Agenda MVP

Tareas y vencimientos vinculados a entidades reales.

### PR-08 - Procesos y Continuidad MVP

Procesos versionados, obligaciones, capture notes y modo continuidad.

### PR-09 - Directorio e Historial MVP

Perfil de party, contactos e interacciones vinculadas.

### PR-10 - Integracion contable/fiscal

Party/work unit en posting, open items, IVA, cierre e Inicio.

### PR-11 - Integraciones Zeta 2.0

Raw records, entity links, CentroCostos -> work unit y export con centro operativo.

### PR-12 - IA operativa

Sugerencias revisables, procesos desde notas, bloqueos y resumen de Inicio.

### PR-13 - Hardening piloto interno

Calidad tecnica, limpieza legacy, piloto Nueva Palmira y hallazgos reales.

## 8. Definition Of Done

Una etapa no termina hasta cumplir proporcionalmente:

1. documentacion actualizada si cambia la verdad oficial;
2. schema canonico actualizado si toca persistencia;
3. migracion creada si toca DB;
4. RLS revisada para tablas nuevas;
5. servicios de dominio en `modules/`;
6. UI consume modulos o presenters;
7. tests o smokes proporcionales;
8. sin datos inventados en Inicio;
9. sin bypass de IA sobre reglas criticas;
10. sin cruces entre organizaciones;
11. comandos ejecutados o no ejecutados documentados.

## 9. Comandos De Calidad

Segun alcance:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:verify:parity
npm run db:smoke:profile-sync
npm run db:smoke:organization-onboarding
npm run db:smoke:private-dashboard
npm run db:smoke:document-upload
```

Docs-only no requiere test suite, pero si busquedas de validacion documental.

## 10. Riesgos Principales

- Crear modulos aislados.
- Duplicar parties con vendors/customers.
- Abusar de entity links.
- Romper el kernel contable.
- Crear dashboards decorativos.
- Dar demasiado poder a la IA.
- Mantener legacy por miedo.
- Intentar implementar todo a la vez.

La mitigacion principal es ejecutar por PRs chicos y probar siempre con el caso Nueva Palmira.
