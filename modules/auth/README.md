# auth

Responsable de login, signup, sesiones, recuperacion de acceso y politicas de identidad.

Estado actual:
- signup y login conectados con Supabase SSR
- confirmacion por email cerrada en `/auth/confirm`
- sesiones persistidas en cookies con refresh por `middleware.ts`
- sincronizacion minima de `auth.users` a `public.profiles` con backfill
- guards server-side para `/app`, `/app/o/[slug]` y onboarding
- resolucion de organizacion primaria post-auth apuntando a `/dashboard` como entrada principal y soportando rutas cortas como `/documents`, `/review` o `/advanced`

Puntos de entrada reales:
- `modules/auth/server-auth.ts`
- `modules/auth/login-service.ts`
- `modules/auth/signup-service.ts`
- `app/api/v1/auth/login/route.ts`
- `app/api/v1/auth/signup/route.ts`
