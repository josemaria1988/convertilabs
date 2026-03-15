# Auth, tenancy y memberships

## Objetivo del modulo

Este modulo asegura que cada usuario entre por SSR, quede asociado a una sola organizacion activa en el flujo inicial y opere dentro de un tenant real con RLS.

## Estado actual

### Auth implementado

- signup y login via Supabase SSR
- confirmacion por email en `/auth/confirm`
- logout via `/logout`
- refresh de sesion por `middleware.ts`
- sincronizacion minima `auth.users -> public.profiles`

Archivos centrales:

- `modules/auth/signup-service.ts`
- `modules/auth/login-service.ts`
- `modules/auth/server-auth.ts`
- `app/api/v1/auth/signup/route.ts`
- `app/api/v1/auth/login/route.ts`

### Tenancy implementado

- tabla `organizations`
- tabla `organization_members`
- helpers `is_org_member`, `is_org_owner`, `is_active_member`, `has_org_role`
- guardas server-side con `requirePrivateAppPage`, `requireOnboardingPage` y `requireOrganizationDashboardPage`
- bucket privado y rutas privadas atadas a `organization_id`

### Unicidad por RUT

Desde `20260315_doc014_workflow_separation_foundations.sql`:

- `organizations.tax_id_normalized`
- indice unico parcial por RUT normalizado
- `create_organization_with_owner(...)` ya no permite duplicar organizacion por RUT

Esto resuelve una condicion estructural del rector: una organizacion debe ser una sola entidad por identificador fiscal.

## Roles observados hoy

### Roles de datos y uso

En el esquema y el codigo aparecen estos roles:

- `owner`
- `admin`
- `admin_processing`
- `accountant`
- `reviewer`
- `operator`
- `viewer`
- `developer`

### Uso actual real

- `requireOrganizationDashboardPage` valida membresia activa y abre la app privada.
- el endpoint de preset IA en settings restringe a `owner`, `admin` y `accountant`.
- `admin_processing` ya existe en datos para futuras colas operativas, aunque su explotacion UI aun es parcial.

## Flujo real de acceso

1. usuario no autenticado intenta entrar;
2. se redirige a `/login`;
3. al autenticarse, `resolvePostAuthDestination` decide:
   - `/onboarding` si no tiene membresia activa;
   - `/app/o/[slug]/dashboard` si ya pertenece a una organizacion.

## Modelo y tablas relevantes

- `profiles`
- `organizations`
- `organization_members`

Campos importantes:

- `organizations.slug`
- `organizations.tax_id`
- `organizations.tax_id_normalized`
- `organizations.created_by`
- `organization_members.role`
- `organization_members.is_active`

## Politicas activas

- el usuario inicial crea la organizacion y queda como `owner`;
- hoy el flujo espera una membresia activa principal para resolver destino post-auth;
- la app es multi-tenant a nivel de datos, aunque la UX actual sigue optimizada para una organizacion principal por usuario.

## Lo que falta o queda preparado

- UI completa de invitaciones y alta de miembros;
- administracion avanzada de permisos por pantalla/accion;
- flujo de `claim` o solicitud de acceso a una organizacion ya existente;
- experiencia multi-organizacion mas profunda para usuarios con varias membresias activas.
