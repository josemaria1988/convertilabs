> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

# Mobile PWA TWA de Campo

## Arquitectura

La app mobile vive dentro del mismo producto Next.js.

Capas:

- PWA en el repo actual con `app/manifest.ts`, `public/sw.js`, iconos y prompt de instalacion.
- Entrada publica `/mobile` que reutiliza auth y tenancy existentes.
- Superficie privada `/app/o/[slug]/field` con home, upload, activity y projects.
- Wrapper Android TWA en `/android-twa` basado en Bubblewrap.

## Decisiones tomadas

- No se creo una app separada ni stack nativo nuevo.
- El service worker es conservador y no cachea HTML autenticado, `/api`, signed URLs ni contenido privado.
- La guia mobile se persiste en `localStorage` porque es estado UI no sensible y per-dispositivo.
- El upload mobile reutiliza `prepare/finalize/fail/enqueue` del flujo documental actual.
- El origen mobile queda trazado con `documents.upload_source = "mobile_field"` y `documents.metadata.source_surface = "mobile_field"`.
- Proyectos minimos se modelan con `organization_cost_centers` y `documents.cost_center_id`.
- Desktop sigue siendo la fuente de verdad para crear/archivar proyectos y editar la asignacion por documento.
- Lo experto sigue en desktop web: IVA, cierre, auditoria, imports, exports, reglas, journal, balance y advanced.

## Limites del MVP

- Sin offline queue.
- Sin cache de datos privados ni respuestas sensibles.
- Sin bridge nativo Android para camara o archivos.
- Sin rentabilidad, allocations complejas, reporting avanzado ni multi-document allocation para proyectos.
- La TWA depende de fingerprints reales y de un keystore valido para abrir en modo Trusted Web Activity pleno.

## Caching del service worker

- Precarga solo `/offline`, `manifest`, iconos PWA y assets estaticos seguros.
- Navegaciones usan red y caen a `/offline` solo si no hay conectividad.
- `/_next/static/` entra en cache allowlist.
- `/app`, `/api`, `/login`, `/signup`, `/logout`, `/auth`, `/onboarding` quedan fuera de cache persistente.
- No se cachean signed URLs ni objetos privados de Supabase Storage.
- No se usa background sync.

## Comandos principales

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run db:verify:parity`
- `npm run db:smoke:document-upload`
- `npm run twa:doctor`
- `npm run twa:validate`
- `npm run twa:init`
- `npm run twa:update`
- `npm run twa:build`
- `npm run twa:install`

## Variables TWA

- `TWA_ANDROID_PACKAGE_NAME`
- `TWA_PRODUCTION_URL`
- `TWA_START_URL`
- `TWA_APP_NAME`
- `TWA_LAUNCHER_NAME`
- `TWA_SHORT_NAME`
- `TWA_APP_VERSION`
- `TWA_APP_VERSION_CODE`
- `TWA_KEYSTORE_PATH`
- `TWA_KEY_ALIAS`
- `TWA_KEYSTORE_PASSWORD`
- `TWA_KEY_PASSWORD`
- `TWA_SHA256_FINGERPRINTS`

## Checklist Play Internal Testing

1. Confirmar `assetlinks.json` con package y fingerprints reales.
2. Correr `npm run twa:doctor`.
3. Correr `npm run twa:validate`.
4. Inicializar o actualizar el wrapper con `npm run twa:init` o `npm run twa:update`.
5. Generar artefactos con `npm run twa:build`.
6. Subir `.aab` o `.apk` a Play Console Internal Testing.
7. Instalar en Android y validar que abra `/mobile` sin barra de navegador.
8. Probar login, onboarding, upload, activity y projects.

## Pasos manuales restantes

- Configurar fingerprints y secretos reales fuera del repo.
- Ejecutar Bubblewrap en una maquina con JDK y Android SDK completos.
- Probar la instalacion en un dispositivo Android real.
