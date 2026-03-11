# auth

Responsable de login, signup, sesiones, recuperacion de acceso y politicas de identidad.

Estado actual:
- signup y login conectados con Supabase SSR
- confirmacion por email cerrada en `/auth/confirm`
- sesiones persistidas en cookies con refresh por `middleware.ts`
- sincronizacion minima de `auth.users` a `public.profiles` con backfill
