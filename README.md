# Convertilabs

Convertilabs es una plataforma contable y fiscal document-driven para Uruguay, centrada en intake documental, decision contable explicable e IVA revisable.

## Estado operativo real

- onboarding multi-tenant con business profile versionado, actividades CIIU, traits y recomendacion de presets por reglas o IA;
- `Inicio` como centro de trabajo real con tareas del dia y CTAs unicos hacia documentos, revision, impuestos y cierre;
- workspace `Documentos` reducido al ingreso documental: upload privado, estado visible del tramo reciente y CTA fuerte hacia `Revision`;
- workspace `Revision` como cola principal por buckets accionables y reviewer con ruta guiada canonica derivada desde workflow y decision snapshot, incluyendo fast lane auto-resuelto y cierre terminal consistente;
- `Importacion masiva` en `/audit` para planillas mensuales con preview estructurado, aceptar/rechazar parcial y trazabilidad por corrida;
- admin de `Reglas contables` con listado, lifecycle, versionado forward-only, simulaciones, conflictos y chat consultivo;
- workspaces contables read-only con balance, diario, open items y mapa contable explicable;
- workspace fiscal con una misma ruta `/tax` separada entre `resolver pendientes` y `ver resultado IVA`, reutilizando el mismo workbench y las mismas acciones;
- `Cierre` como flujo validator-first con bloqueos agrupados por documentos, impuestos, contabilidad y open items;
- `Configuracion` separada en `Empresa`, `Perfil fiscal`, `Perfil de negocio`, `Plan contable`, `Integraciones` y `Avanzado`.

## Superficies activas

### Publicas

- `/(marketing)`
- `/login`
- `/signup`
- `/logout`
- `/auth/confirm`
- `/onboarding`

### Privadas del top nav por organizacion

- `/app/o/[slug]/dashboard`
- `/app/o/[slug]/documents`
- `/app/o/[slug]/review`
- `/app/o/[slug]/tax`
- `/app/o/[slug]/close`
- `/app/o/[slug]/settings`
- `/app/o/[slug]/advanced`

### Privadas expertas o de soporte por organizacion

- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/rules`
- `/app/o/[slug]/documents/pending-assignment`
- `/app/o/[slug]/documents/[documentId]/original`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/tax/reconciliation`

Las rutas cortas `/dashboard`, `/documents`, `/review`, `/advanced`, `/close`, `/rules`, `/tax`, `/settings`, `/trial-balance`, `/journal-entries` y `/open-items` redirigen a la organizacion primaria del usuario. `pending-assignment` sigue vivo como cola secundaria de lotes y asignacion, no como entrypoint principal.

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
- [docs/00-foundations/02-estado-actual-kernel-contable-y-fiscal-2026-03-28.md](docs/00-foundations/02-estado-actual-kernel-contable-y-fiscal-2026-03-28.md)
- [docs/04-documents/01-document-intake-and-processing.md](docs/04-documents/01-document-intake-and-processing.md)
- [docs/04-documents/02-document-review-classification-and-posting.md](docs/04-documents/02-document-review-classification-and-posting.md)
- [docs/03-accounting/accounting-rules-admin-and-learning.md](docs/03-accounting/accounting-rules-admin-and-learning.md)
- [docs/04-documents/03-document-settlement-and-multi-line-posting.md](docs/04-documents/03-document-settlement-and-multi-line-posting.md)
- [docs/07-platform/database-api-background-jobs-and-observability.md](docs/07-platform/database-api-background-jobs-and-observability.md)

## Specs activas de implementacion

- [docs/convertilabs_mvp_launch_hardening_sdd_codex_prompt.md](docs/convertilabs_mvp_launch_hardening_sdd_codex_prompt.md)
- [docs/specs-driven-development-admin-reglas-y-aprendizaje.md](docs/specs-driven-development-admin-reglas-y-aprendizaje.md)
- [docs/specs-driven-development-asistente-contable.md](docs/specs-driven-development-asistente-contable.md)
- [docs/spec_ui_refactor_explainability_convertilabs.md](docs/spec_ui_refactor_explainability_convertilabs.md)

## Alcance operativo hoy

- Uruguay only;
- foco operativo en documentos, reglas, decision contable, IVA y bridge externo;
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
