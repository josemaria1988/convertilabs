# AUTH-001: profiles y auth SSR

## Objetivo

Cerrar el flujo base de identidad para Semana 1:

- `public.profiles` como espejo minimo de `auth.users`
- signup y login con Supabase SSR
- confirmacion de email por `token_hash`
- cookies refrescadas por middleware
- rutas privadas protegidas sin depender de estado cliente

## Decisiones implementadas

- `profiles` guarda `email` como copia denormalizada, `full_name`, `avatar_url`, `created_at` y `updated_at`.
- El trigger de `auth.users` es minimo: inserta en `public.profiles` y hace `on conflict do nothing`; no sincroniza updates de email/perfil en esta etapa.
- El backfill se mantiene como SQL reproducible en `scripts/backfills/backfill_profiles_from_auth_users.sql`.
- El login usa `signInWithPassword()` y devuelve redirect server-driven hacia `/onboarding` o `/app/o/[slug]/dashboard`.
- La confirmacion de email aterriza en `/auth/confirm`, verifica `token_hash` y deja una sesion SSR valida.

## Entregables del repo

- `supabase/migrations/20260311_auth001_profiles_ssr.sql`
- `scripts/backfills/backfill_profiles_from_auth_users.sql`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `middleware.ts`
- `app/auth/confirm/route.ts`
- `app/logout/route.ts`
- `app/onboarding/page.tsx`

## Notas de rollout

- Si la base remota ya tiene la version vieja de `profiles`, aplica primero `20260311_auth001_profiles_ssr.sql`.
- Luego regenera la migracion canonica desde `db/` con `npm run db:generate:migration`.
- Finalmente corre `npm run db:verify:parity` y `npm run db:smoke:profile-sync`.
