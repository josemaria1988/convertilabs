# DASH-001: dashboard privado

## Objetivo

Levantar la primera shell privada usable de la app:

- entrada SSR en `/app`
- contexto de organizacion por slug
- layout privado con navegacion minima
- lista base de documentos real o estado vacio funcional
- CTA de upload visible para enlazar con `DOC-001`

## Decisiones implementadas

- `/app` sigue funcionando como entrypoint SSR y redirige al dashboard de la organizacion primaria del usuario.
- `app/app/layout.tsx` define el contenedor del area privada y `components/dashboard/private-dashboard-shell.tsx` monta la shell org-aware con topbar, nombre de organizacion, usuario actual, logout y CTA principal.
- `app/app/o/[slug]/dashboard/page.tsx` resuelve membership por slug desde servidor y consulta documentos reales sin depender de hooks cliente.
- La lista de documentos usa una funcion SQL controlada, `public.list_dashboard_documents(uuid, integer)`, para exponer nombre de archivo, estado, fecha y uploader display sin relajar la policy base de `profiles`.
- El estado vacio ya queda listo para `DOC-001`, con CTA visible y copy de formatos esperados.

## Entregables del repo

- `app/app/layout.tsx`
- `app/app/page.tsx`
- `app/app/o/[slug]/dashboard/page.tsx`
- `components/dashboard/private-dashboard-shell.tsx`
- `components/dashboard/dashboard-document-list.tsx`
- `components/dashboard/dashboard-empty-state.tsx`
- `modules/documents/dashboard.ts`
- `supabase/migrations/20260311_dash001_private_dashboard.sql`

## Contrato operativo

- Usuario sin sesion -> middleware y guards lo llevan a `/login`.
- Usuario autenticado sin membership -> `/onboarding`.
- Usuario autenticado con membership -> `/app/o/[slug]/dashboard`.
- Slug inexistente o ajeno -> recurso no accesible via `notFound()`.
- Documentos:
  - si hay error de lectura -> estado `error`
  - si no hay documentos -> estado `empty`
  - si hay documentos -> estado `populated`

## Notas de rollout

- Aplica `20260311_dash001_private_dashboard.sql` si la base remota ya estaba en el estado de `ORG-001`.
- Regenera el `sync` canonico con `npm run db:generate:migration`.
- Verifica con `npm run db:verify:parity`.
- Valida la query SSR con `npm run db:smoke:private-dashboard`.
- Valida visualmente o con build SSR que `/app/o/[slug]/dashboard` renderiza el estado vacio o la lista real.
