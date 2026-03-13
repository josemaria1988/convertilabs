# ORG-001: onboarding de organizaciones

## Objetivo

Cerrar el primer flujo multi-tenant real de Semana 1:

- usuario autenticado sin memberships activas -> `/onboarding`
- creacion atomica de organizacion + membership owner
- slug unico generado en servidor
- salida limpia hacia `/app/o/[slug]/dashboard`

## Decisiones implementadas

- `db/` sigue siendo la fuente canonica del tenant model y ahora expone `public.create_organization_with_owner(...)` como RPC segura para el alta inicial, incluyendo forma juridica, RUT, regimen tributario, regimen IVA, grupo DGI y estado CFE.
- La creacion de organizacion no queda abierta por `INSERT` directo al cliente; se endurecieron las policies de `organizations` y `organization_members` para que el camino valido sea la funcion controlada.
- Se agregaron helpers `public.is_org_member(uuid)` e `public.is_org_owner(uuid)` para reutilizar el criterio de autorizacion en RLS y en futuras capas.
- El slug se normaliza en servidor con `public.slugify_organization_name(text)` y resuelve colisiones con sufijo incremental.
- `modules/auth/server-auth.ts` ya resuelve la organizacion primaria del usuario y usa ese contexto para redirects SSR post-login, post-signup y post-confirm.

## Entregables del repo

- `supabase/migrations/20260311_org001_organizations_onboarding.sql`
- `app/onboarding/page.tsx`
- `app/onboarding/actions.ts`
- `components/organization-onboarding-form.tsx`
- `modules/organizations/onboarding-schema.ts`
- `app/app/page.tsx`
- `app/app/o/[slug]/dashboard/page.tsx`

## Contrato operativo

- Si el usuario no esta autenticado, `/onboarding` rebota a `/login?next=/onboarding`.
- Si el usuario ya tiene membership activa, `/onboarding` lo redirige a su destino util por slug.
- Si la creacion de organizacion tiene exito, la server action redirige a `/app/o/[slug]/dashboard`.
- Si el usuario intenta abrir un slug ajeno, el dashboard privado no expone informacion y responde como recurso no accesible.

## Notas de rollout

- Aplica primero `20260311_org001_organizations_onboarding.sql` en la base remota si ya estaba desplegada la version anterior de auth sin onboarding real.
- Luego regenera el `sync` canonico con `npm run db:generate:migration`.
- Finalmente corre `npm run db:verify:parity` para confirmar schema, funciones y policies alineadas con `db/`.
- Para una validacion funcional minima, usa `npm run db:smoke:organization-onboarding`.
