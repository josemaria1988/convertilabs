# Auditoria Repo Convertilabs 2.0 - KEEP / REWRITE / DELETE

## Estado

Auditoria inicial para PR-00. Debe evolucionar con cada etapa del plan maestro.

## KEEP

- Nombre Convertilabs.
- Dominio y hosting existentes.
- Next.js, React y TypeScript.
- Supabase Auth, Postgres y Storage.
- Auth multi-tenant.
- Organizaciones y memberships.
- RLS base.
- Intake documental.
- Storage privado de documentos.
- IA estructurada.
- Inngest.
- Kernel contable multilinea.
- Accounting rules si se mantienen sanas.
- IVA Uruguay.
- Close cockpit.
- Open items y settlements.
- Imports y exports.
- Zeta como integracion externa.
- Audit logs y decision logs.
- Estructura `app/`, `components/`, `modules/`, `db/`, `supabase/migrations/`, `tests/`.

## REWRITE

- Tesis del producto.
- Agent rules.
- README.
- Docs oficiales.
- Navegacion principal.
- Inicio/dashboard.
- Modelo clientes/proveedores hacia `parties`.
- Modelo trabajos/proyectos/centros de costo hacia `work_units`.
- Dinero como dominio visible.
- Procesos, tareas y continuidad.
- Contactos e historial.
- IA contable aislada hacia inteligencia operativa.
- Mobile field limitado hacia captura conectada a trabajos, dinero y agenda.
- Copy que presente documentos, IVA o review como centro unico.

## DELETE O LEGACY

- Restricciones activas que impidan Convertilabs como sistema integral.
- Rutas legacy sin uso real despues de migracion.
- Pantallas de beta documental que no conecten al modelo madre.
- Estados duplicados de UI.
- Features preparadas para vender afuera antes de servir internamente.
- Configuradores sin retorno operativo.
- Docs historicos que compitan con la verdad 2.0.

## Hallazgos Iniciales PR-00

- `docs/agent_rules.md` y `docs/00-core-product-and-organization.md` contenian tesis vieja activa.
- `README.md` apuntaba a docs inexistentes.
- Existen docs Zeta y mobile utiles, pero subordinados.
- `parties` ya existe como base tecnica, pero falta consolidarla como directorio canonico.
- `organization_cost_centers` y `documents.cost_center_id` existen como puente; el destino canonico es `work_units`.
- `ledger_open_items` existe y debe alimentar el dominio `money`.

## Proxima Auditoria

PR-01 debe auditar schema y RLS antes de crear:

- `party_roles`;
- `contacts`;
- `party_contacts`;
- `party_identifiers`;
- `work_units`;
- `business_events`;
- `entity_links`;
- `evidence_refs`.
