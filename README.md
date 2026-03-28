# Convertilabs

Convertilabs es una plataforma contable y fiscal para Uruguay centrada en tres motores: ingreso documental, decision contable y liquidacion fiscal revisable.

## Estado actual del proyecto

- onboarding multi-tenant con business profile versionado, actividades CIIU, traits y recomendacion de presets base o hibrida con IA;
- workspace documental con upload privado, procesamiento por Inngest + OpenAI, revision humana, posting y carril separado para operaciones internacionales;
- workspace contable read-only con balance de comprobacion, libro diario, open items y mapa contable explicable;
- workspace fiscal con VAT preview, VAT runs, exportes fiscales y conciliacion DGI base manual por buckets;
- carriles de soporte para planillas de plan de cuentas, historicos IVA, plantillas contables y bridge de exportacion contable hacia sistemas externos;
- settings con perfil fiscal versionado, plan de cuentas, conexiones de email CFE y capacidades por organizacion.

## Superficies activas

### Publicas

- `/(marketing)`
- `/login`
- `/signup`
- `/logout`
- `/auth/confirm`
- `/onboarding`

### Privadas por organizacion

- `/app/o/[slug]/documents`
- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/tax/reconciliation`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`

Las rutas cortas `/documents`, `/tax`, `/settings`, `/trial-balance`, `/journal-entries` y `/open-items` redirigen a la organizacion primaria del usuario.

## Stack operativo

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth, Postgres y Storage
- OpenAI Responses API para salidas estructuradas
- Inngest para orquestacion durable
- Tailwind CSS 4 y ESLint 9

## Estructura principal

```text
app/
  (marketing)/
  app/o/[slug]/
  api/
components/
db/
  schema/
  rls/
docs/
modules/
supabase/
  migrations/
tests/
scripts/
  backfills/
  supabase/
```

## Desarrollo local

El proyecto requiere un `.env` basado en `.env.example` con estas piezas minimas:

- app y cliente web: `APP_URL`, `NEXT_PUBLIC_APP_URL`;
- Supabase web/server: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`;
- Postgres: `DATABASE_URL`, `DIRECT_URL`;
- OpenAI: `OPENAI_API_KEY` y, si hace falta, overrides `OPENAI_*_MODEL`;
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

## Documentacion viva

- [docs/README.md](docs/README.md)
- [docs/beta_privada_alcance_y_operacion.md](docs/beta_privada_alcance_y_operacion.md)
- [docs/00-foundations/01-mapa-del-repo-y-rutas.md](docs/00-foundations/01-mapa-del-repo-y-rutas.md)
- [docs/04-documents/01-document-intake-and-processing.md](docs/04-documents/01-document-intake-and-processing.md)
- [docs/04-documents/03-document-settlement-and-multi-line-posting.md](docs/04-documents/03-document-settlement-and-multi-line-posting.md)
- [docs/07-platform/database-api-background-jobs-and-observability.md](docs/07-platform/database-api-background-jobs-and-observability.md)

## Alcance operativo hoy

- Uruguay only;
- foco operativo en documentos, decision contable, IVA y bridge externo;
- conciliacion DGI base manual asistida, no filing automatico;
- sin payroll/BPS, conciliacion bancaria end-to-end ni multi-country operativo.

## Beta privada y perimetro operativo

- `Modo automatico` hoy aplica al perimetro conservador `UY + SA|SRL|SAS + IRAE_GENERAL + IVA GENERAL + flujo local estandar`.
- `Modo asistido` cubre importaciones y perfiles fuera de ese perimetro: se permite extraccion, review y preview/provisional, pero no cierre automatico final.
- `Bloqueado` aplica cuando faltan datos minimos, no hay FX confiable en moneda extranjera o aparece settlement cross-currency.

## Operaciones y checks

- `GET /api/health` es liveness/config barato.
- `GET /api/ready` y `GET /api/health?mode=ready` hacen readiness real contra DB/Supabase sin ping costoso a OpenAI o Inngest.
- `npm run pilot:summary -- <archivo.json>` ejecuta el gate del piloto y devuelve exit code no-cero si la apertura debe seguir bloqueada.
