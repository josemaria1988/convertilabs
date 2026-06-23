# organizations

Responsable de tenancy, perfiles de empresa, miembros y permisos por organizacion.

Estado actual:
- onboarding con slug unico, membership owner y bootstrap inicial
- business profile versionado con actividad principal, secundarias y traits
- feature flags de presets por actividad, preset IA y help hints
- settings por organizacion tabulados en `Empresa`, `Perfil fiscal`, `Plan contable`, `Integraciones` y `Avanzado`
- navegacion privada por organizacion en `private-nav.ts` con `Inicio`, `Trabajos`, `Documentos`, `Dinero`, `Agenda` y `Mas`

Archivos clave:
- `modules/organizations/onboarding-schema.ts`
- `modules/organizations/business-profiles.ts`
- `modules/organizations/settings.ts`
- `modules/organizations/feature-flags.ts`
- `modules/organizations/private-nav.ts`
