> **Estado Convertilabs 2.0:** este documento pertenece a la etapa anterior y queda subordinado al documento refundacional, al plan maestro 2.0 y a los docs oficiales actuales. Usarlo solo como referencia historica o tecnica.

Vas a trabajar en el repo Convertilabs.

Antes de tocar código:
1. Lee en este orden:
   - docs/agent_rules.md
   - docs/00-core-product-and-organization.md
   - docs/01-workflows-ux-and-surfaces.md
   - docs/02-accounting-tax-and-integrations.md
   - docs/03-platform-quality-and-roadmap.md

2. Luego inspecciona como mínimo:
   - package.json
   - app/layout.tsx
   - modules/auth/server-auth.ts
   - app/app/page.tsx
   - app/onboarding/page.tsx
   - components/dashboard/private-dashboard-shell.tsx
   - components/documents/upload-dropzone.tsx
   - app/app/o/[slug]/documents/page.tsx

Guardrails obligatorios:
- No crear React Native, Expo, Capacitor ni una app separada.
- Implementar:
  a) PWA dentro del repo Next.js actual
  b) wrapper TWA Android dentro de /android-twa
  c) nueva superficie mobile de campo dentro del mismo producto
- La app mobile es “de campo”: captura, procesamiento/estado, clasificación básica, proyectos/centros de costo mínimos, actividad reciente y onboarding mobile.
- Lo experto queda en web desktop: IVA, cierre, auditoría, imports, exports, reglas, mapa contable, journal, balance y advanced.
- Reutilizar auth, tenancy, upload, storage, extraction y workflow actuales.
- Mantener enfoque conservador: no inventar datos, no auto-finalizar casos inseguros, no cachear offline datos privados ni respuestas sensibles.
- No meter lógica de negocio en componentes.
- Si tocas schema: actualizar db/schema, agregar migración, revisar RLS, mantener paridad.

En cada respuesta:
- dame plan breve,
- archivos tocados,
- migraciones,
- riesgos,
- comandos corridos,
- resultados de verificación.


## 1. Auditoría y plan antes de editar

Con el contexto anterior, no edites nada todavía.

Quiero un relevamiento del repo y un plan de implementación para la app mobile PWA/TWA de campo.

Entregame:
1. rutas actuales reutilizables para auth, onboarding, upload, review y navegación;
2. archivos a crear o editar para:
   - PWA base
   - entrada mobile
   - app de campo
   - onboarding mobile
   - upload mobile
   - proyectos/cost centers mínimos
   - wrapper Android TWA
3. cambios de schema/migraciones necesarios;
4. riesgos de service worker y caching en un producto financiero multi-tenant;
5. plan de implementación en 6-8 fases con criterios de aceptación;
6. lista de verificaciones que vas a correr en cada fase.

No empieces a codificar hasta mostrar el plan.

## 2. Base PWA dentro del repo Next.js

Implementá la base PWA dentro del repo Next.js actual.

Objetivos:
- crear `app/manifest.ts` con `start_url` apuntando a `/mobile`, `display: "standalone"`, `short_name`, descripción, theme/background colors e íconos;
- agregar íconos PWA mínimos y assets de app install en `/public`;
- registrar un service worker desde un client component incluido en `app/layout.tsx`;
- agregar una ruta/página offline simple para fallback;
- agregar un install prompt web/PWA reutilizable;
- actualizar metadata/layout para que la app se comporte correctamente como PWA instalada.

Reglas:
- el service worker debe ser conservador;
- cachear solo shell estático, icons, fonts y offline page;
- nunca cachear HTML privado autenticado, respuestas de `/api`, signed URLs, contenido de storage privado ni datos contables sensibles;
- no romper SSR ni auth.

Entregame:
- diff completo,
- archivos tocados,
- política de caching explicada en 6-10 puntos,
- verificación con `npm run lint`, `npm run typecheck`, `npm run build`.

## 3. Entrada mobile y superficie “de campo”

Implementá la nueva entrada mobile y la nueva superficie privada de campo.

Crear:
- `app/mobile/page.tsx` como entry público del PWA/TWA;
- `app/app/o/[slug]/field/page.tsx` como home privada de la app de campo;
- los componentes/helpers necesarios para un shell mobile liviano.

Comportamiento:
- si no hay sesión -> redirigir a `/login?next=/mobile`;
- si hay sesión pero no hay organización -> redirigir a `/onboarding?next=/mobile`;
- si hay organización -> redirigir a `/app/o/[slug]/field`.

La home de campo debe mostrar solo:
- resumen simple de estado,
- CTA principal `Subir documento`,
- actividad reciente,
- acceso a proyectos,
- enlace visible `Abrir versión completa en web`.

UX:
- máximo 5 ítems de navegación mobile;
- una acción principal por pantalla;
- nada de tablas ERP, nada de superficies expertas visibles como navegación principal.

No rompas:
- `/app`
- `/dashboard`
- `/documents`
- la shell privada actual.

## 4. Onboarding mobile en dos capas

Implementá onboarding mobile en 2 capas.

A) Conservar y respetar el onboarding existente de organización:
- `/mobile` debe llevar correctamente a `/onboarding` cuando el usuario no tiene organización activa;
- al terminar onboarding, el usuario debe volver al flujo mobile y no perderse.

B) Crear una guía de uso de la app de campo que se muestre la primera vez que un usuario entra desde mobile/PWA/TWA.

Requisitos de la guía:
- 4 o 5 steps máximo;
- copy clara en español;
- explicar:
  1. para qué sirve la app de campo,
  2. cómo subir un documento,
  3. cómo seguir el estado,
  4. cómo asociarlo a un proyecto,
  5. que la versión completa vive en la web desktop para IVA, cierre, reglas, auditoría, imports/exports, etc.;
- permitir reabrir la guía desde la app;
- persistir que el usuario ya la vio (si usás localStorage, justificá por qué; si usás persistencia server-side, hacelo de forma mínima y limpia).

Entregame también el copy final completo en español.

## 5. Flujo de captura y subida mobile

Implementá el flujo mobile de captura/subida reutilizando la infraestructura actual de documentos.

Requisitos:
- CTA principal `Subir documento`;
- al tocarlo, abrir una action sheet / bottom sheet con:
  - `Sacar foto`
  - `Cargar archivo`
- la opción de foto debe priorizar cámara trasera en Android cuando el navegador lo soporte, con fallback seguro al selector de archivos;
- la opción de archivo debe permitir PDFs e imágenes dentro del perímetro actual;
- reutilizar estas acciones existentes:
  - `prepareDocumentUploadAction`
  - `finalizeDocumentUploadAction`
  - `failDocumentUploadAction`
  - `enqueueSelectedDocumentExtractionsAction`
- agregar normalización/optimización cliente para fotos de cámara si vienen demasiado pesadas;
- mostrar estados claros:
  - subiendo
  - procesando
  - listo para revisar
  - bloqueado
- al terminar, refrescar actividad reciente y dejar el documento entrando al loop principal del reviewer.

Reglas:
- no crear bridge nativo Android para este flujo;
- no duplicar lógica de negocio;
- si ya existe un campo útil para marcar origen mobile, usarlo;
- si no existe, proponer e implementar una forma mínima y auditada de distinguir uploads desde la app de campo.

## 6. Proyectos / centros de costo mínimos

Implementá la versión mínima de proyectos / centros de costo para la app de campo.

Objetivo:
poder crear un proyecto tipo `Servicios TGU Abril 2026` y asociar documentos a ese proyecto.

Alcance mínimo:
- tabla `organization_cost_centers` (o nombre equivalente canonico);
- campo nullable de relación en `documents`;
- migración y actualización de `db/schema`;
- RLS consistente con membership por organización;
- acciones server-only para:
  - crear
  - listar
  - archivar
  - asignar documento a proyecto
- UI simple en mobile para:
  - crear proyecto
  - seleccionar proyecto activo
  - filtrar actividad por proyecto

Fuera de alcance:
- rentabilidad
- jobs complejos
- prorrateos
- allocations multi-documento
- reporting avanzado

Verificación obligatoria:
- `npm run db:verify:parity`
- tests/smokes razonables
- explicación breve del impacto del schema.

## 7. Wrapper Android TWA

Implementá el wrapper Android TWA dentro del mismo repo, en `/android-twa`.

Objetivo:
dejar listo un proyecto reproducible para abrir la versión PWA/mobile de Convertilabs en Android y publicarlo en Google Play.

Requisitos:
- usar Bubblewrap como base;
- agregar scripts para:
  - `twa:doctor`
  - `twa:validate`
  - `twa:init`
  - `twa:build`
  - `twa:install`
  - `twa:update`
- usar `npx @bubblewrap/cli` o devDependency local, no depender de instrucciones mágicas;
- generar o dejar listo `twa-manifest.json`;
- configurar el wrapper para abrir la entrada mobile del PWA, no el desktop genérico;
- agregar soporte server-side para `/.well-known/assetlinks.json` usando variables de entorno, soportando múltiples fingerprints SHA-256;
- documentar variables necesarias:
  - Android package name
  - production URL
  - keystore path
  - key alias
  - passwords
  - SHA-256 fingerprints
- no versionar secretos, keystores ni credenciales;
- agregar `.gitignore` y documentación de build/release;
- minimizar ediciones manuales del proyecto generado por Bubblewrap; preferir configuración en `twa-manifest.json` y scripts.

Importante:
- si el entorno no permite completar el build Android, igual dejá todo el código, scripts y documentación listos;
- explicá exactamente qué prerrequisito faltó;
- no cierres la tarea diciendo solo “no pude”.

Quiero además:
- guía de build local,
- guía de internal testing,
- ubicación esperada de APK/AAB,
- pasos para actualizar el wrapper cuando cambie la web manifest.

## 8. Hardening, QA y docs finales

Hacé hardening final y documentación de la implementación mobile PWA/TWA.

Quiero:
1. smoke manual del flujo `/mobile` para:
   - usuario sin sesión
   - usuario con sesión sin organización
   - usuario con sesión y organización
2. smoke del tutorial mobile;
3. smoke del upload con foto y archivo;
4. smoke de proyectos/cost centers;
5. verificación con:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run test`
6. si tocaste schema:
   - `npm run db:verify:parity`
   - smokes relevantes
7. crear `docs/mobile-pwa-twa.md` con:
   - arquitectura
   - decisiones tomadas
   - límites del MVP
   - comandos
   - checklist de publicación en Play Internal Testing
8. actualizar docs del producto si cambió la verdad oficial o el estado de implementación.

Entregame un resumen final con:
- entregables,
- riesgos abiertos,
- deuda aceptada,
- pasos manuales restantes.

