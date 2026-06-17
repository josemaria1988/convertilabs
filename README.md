# Convertilabs

Convertilabs 2.0 es el sistema operativo integral de gestion y continuidad de la empresa: un super ERP personalizado para conectar trabajos, clientes, proveedores, documentos, dinero, contabilidad, IVA, tareas, procesos, evidencia e historial en un solo modelo operativo.

La refundacion esta documentada en:

- [docs/documento-refundacional-convertilabs.md](docs/documento-refundacional-convertilabs.md)
- [docs/plan-maestro-version1.md](docs/plan-maestro-version1.md)
- [docs/00-refundacion-convertilabs-2.md](docs/00-refundacion-convertilabs-2.md)

## Estado Operativo Actual

El repo conserva piezas valiosas de la etapa anterior:

- auth multi-tenant con Supabase;
- organizaciones, perfiles y memberships;
- storage privado para documentos;
- intake documental, procesamiento y reviewer;
- IA estructurada;
- Inngest;
- kernel contable multilinea;
- reglas contables;
- IVA Uruguay;
- cierre;
- open items;
- imports/exports;
- Zeta como integracion externa;
- audit logs y trazabilidad.

La nueva direccion eleva esas piezas hacia un sistema integral basado en:

```text
party
work_unit
document
business_event
money
accounting
tax
task
process
interaction
evidence
```

## Objetivo Del MVP Refundacional

El primer corte operativo debe demostrar el caso `Trabajo Nueva Palmira`:

1. crear cliente como party;
2. crear trabajo como work unit;
3. asociar documentos de gasto y venta;
4. ver ventas, costos y margen basico;
5. ver deudores, acreedores, cobros y pagos;
6. ver tareas y vencimientos;
7. ver impacto contable e IVA cuando aplique;
8. ver todo resumido en Inicio.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres y Storage
- OpenAI Responses API
- Inngest
- Tailwind CSS 4
- ESLint 9

## Estructura Principal

```text
app/
components/
db/
  schema/
  rls/
docs/
lib/
modules/
supabase/
  migrations/
tests/
scripts/
```

## Documentacion Principal

- [Agent Rules 2.0](docs/agent_rules.md)
- [Core product and organization](docs/00-core-product-and-organization.md)
- [Workflows, UX and surfaces](docs/01-workflows-ux-and-surfaces.md)
- [Accounting, tax and integrations](docs/02-accounting-tax-and-integrations.md)
- [Platform, quality and roadmap](docs/03-platform-quality-and-roadmap.md)
- [Auditoria KEEP / REWRITE / DELETE](docs/auditoria-repo-convertilabs-2-keep-rewrite-delete.md)

## Referencias Tecnicas Subordinadas

Estas referencias siguen siendo utiles, pero no mandan sobre Convertilabs 2.0:

- [Documentacion unificada historica](docs/convertilabs-documentacion-unificada.md)
- [Backlog Zeta revisado](docs/backlog-convertilabs-zetasoftware-revisado.md)
- [Contrato endpoints Zeta](docs/zetasoftware-endpoints-contract.md)
- [Notas Bandeja Zeta](docs/zetasoftware-bandeja-contract-notes.md)
- [Mobile PWA/TWA](docs/mobile-pwa-twa.md)
- [App mobile Google Play](docs/app-mobile-googleplay.md)

## Desarrollo Local

El proyecto requiere un `.env` basado en `.env.example`.

Variables principales:

- app y cliente web: `APP_URL`, `NEXT_PUBLIC_APP_URL`;
- Supabase web/server: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`;
- Postgres: `DATABASE_URL`, `DIRECT_URL`;
- OpenAI: `OPENAI_API_KEY` y overrides `OPENAI_*_MODEL` si hacen falta;
- Inngest: `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_BASE_URL`;
- flags fiscales: `VAT_UY_*`.

Comandos habituales:

```bash
npm install
npm run dev
npm run inngest:dev
```

## Scripts Utiles

```bash
npm run lint
npm run typecheck
npm run test
npm run pilot:summary -- docs/samples/rontil-pilot-demo-ready.json
npm run db:generate:migration
npm run db:verify:parity
npm run db:smoke:profile-sync
npm run db:smoke:organization-onboarding
npm run db:smoke:private-dashboard
npm run db:smoke:document-upload
npm run documents:repair:stale-processing
```

## Regla De Trabajo

La refundacion se ejecuta por cortes:

1. documentacion refundacional;
2. modelo madre;
3. Inicio y navegacion;
4. trabajos;
5. Nueva Palmira end-to-end;
6. dinero;
7. agenda, procesos y continuidad;
8. directorio e historial;
9. integracion contable/fiscal;
10. Zeta 2.0;
11. IA operativa;
12. hardening y piloto interno.

No construir modulos aislados. Toda feature nueva debe conectarse al modelo madre o justificar por que existe.
