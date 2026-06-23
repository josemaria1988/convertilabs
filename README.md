# Convertilabs

Convertilabs 2.0 es el sistema operativo integral de gestion de Rontil.

No reemplaza ZetaSoftware, la web ni el email. Los conecta y ordena en un modelo propio para operar trabajos, contactos, documentos, ventas, compras, dinero, contabilidad, IVA, tareas, procesos, evidencia y tablero ejecutivo.

## Documentacion principal

La documentacion viva esta concentrada en:

- [docs/README.md](docs/README.md)
- [Baseline de arquitectura](docs/convertilabs-2.0-baseline-arquitectura.md)
- [Analisis arquitectonico](docs/analisis-arquitectura-convertilabs-2.0.md)
- [Plan de accion por PRs](docs/plan_de_accion_convertilabs2_PRs_analisis.md)
- [Agent rules](docs/agent_rules.md)

La documentacion legacy fue retirada o subordinada. Si aparece una contradiccion entre historia vieja y estos documentos, gana Convertilabs 2.0.

## Modelo mental

```text
hecho operativo
-> party/contacto
-> work_unit/trabajo
-> document/evidencia
-> dinero
-> contabilidad
-> IVA/cumplimiento
-> tareas/procesos
-> Inicio
```

El primer corte operativo a validar es Nueva Palmira:

```text
cotizacion o solicitud
-> cliente
-> trabajo
-> documentos de venta/gasto
-> margen
-> pendientes
-> tablero
```

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres y Storage
- OpenAI Responses API
- Inngest
- Tailwind CSS 4
- ESLint 9

## Estructura principal

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

## Desarrollo local

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

## Scripts utiles

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

## Hito documental

Fecha: 2026-06-23.

Commit sugerido:

```text
docs: consolidar base documental Convertilabs 2.0
```

Este hito marca el punto en que la documentacion del repo queda reducida a la base Convertilabs 2.0 y referencias tecnicas vigentes.
