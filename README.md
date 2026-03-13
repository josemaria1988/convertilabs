# Convertilabs

Convertilabs es un SaaS contable y fiscal para Uruguay orientado a procesamiento documental, clasificacion asistida y liquidacion IVA revisable.

El MVP actual esta enfocado en:

- onboarding multi-tenant con perfil fiscal base,
- upload privado de facturas y comprobantes,
- intake documental con IA acotada por snapshots,
- revision humana sobre draft persistido,
- sugerencia contable balanceada,
- soporte inicial de IVA Uruguay,
- exportacion y trazabilidad desde un modelo canonico.

La referencia principal de ejecucion esta en [docs/specs3/convertilabs_mvp_spec_sdd.md](docs/specs3/convertilabs_mvp_spec_sdd.md) y el corte operativo del MVP esta resumido en [docs/specs3/uruguay_mvp_phase1_scope.md](docs/specs3/uruguay_mvp_phase1_scope.md).

## Stack

- Next.js App Router
- TypeScript
- React 19
- Supabase Auth, Postgres y Storage
- OpenAI Responses API para intake documental

## Modulos clave

```text
app/
  (marketing)/
  app/
  onboarding/
components/
lib/
modules/
  accounting/
  ai/
  auth/
  documents/
  organizations/
  tax/
db/
  schema/
  rls/
docs/
supabase/
  migrations/
scripts/
  supabase/
```

## Flujo MVP

1. Usuario autenticado crea su organizacion y perfil fiscal base.
2. La organizacion sube un PDF, JPG o PNG a storage privado.
3. El pipeline documental extrae facts estructurados y genera un draft persistido.
4. El reviewer corrige, confirma o reabre sobre ese draft.
5. El sistema genera sugerencia contable, tratamiento IVA y trazabilidad para el periodo.

## Scripts utiles

```bash
npm run dev
npm run lint
npm run typecheck
npm run db:verify:parity
npm run db:smoke:organization-onboarding
npm run db:smoke:private-dashboard
npm run db:smoke:document-upload
```

## Estado del MVP

Incluido en fase 1:

- Uruguay only
- documentos de compra y venta locales
- IVA Uruguay revisable
- aprendizaje explicito de reglas en pasos posteriores del roadmap

Fuera de alcance en esta fase:

- filing directo con DGI
- payroll y BPS
- conciliacion bancaria
- multi-country
- emision CFE en runtime
