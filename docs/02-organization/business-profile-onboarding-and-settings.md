# Business profile, onboarding y settings

## Objetivo del modulo

Traducir la identidad registral y operativa de la empresa a un perfil de negocio versionado que luego alimente:

- recomendacion de plan de cuentas;
- reglas fiscales;
- explainability;
- exportaciones;
- futuras capas de rentabilidad.

## Datos capturados hoy

### Basicos de organizacion

- nombre
- slug
- pais
- moneda base
- locale
- forma juridica
- RUT
- regimen tributario
- regimen IVA
- grupo DGI
- estado CFE

### Business profile

- `primaryActivityCode`
- `secondaryActivityCodes`
- `selectedTraits`
- `shortBusinessDescription`

### Version fiscal

Ademas del business profile, settings mantiene un perfil fiscal versionado con campos como:

- direccion fiscal
- departamento
- ciudad
- codigo postal
- politica geografica
- radio de viaje

## Validaciones reales del onboarding

Definidas en `modules/organizations/onboarding-schema.ts`:

- nombre minimo y maximo;
- forma juridica soportada;
- RUT valido;
- regimen tributario soportado;
- VAT regime, DGI group y CFE status explicitos;
- actividad principal obligatoria si se pide business profile;
- maximo 5 actividades secundarias;
- al menos un trait;
- descripcion corta maximo 240 caracteres;
- si el modo es `hybrid_ai_recommended`, el `aiRunId` debe existir.

## Feature flags que gobiernan este carril

Definidas en `modules/organizations/feature-flags.ts`:

- `ONBOARDING_ACTIVITY_BASED_PRESETS_ENABLED`
- `PRESET_AI_RECOMMENDATION_ENABLED`
- `UI_HELP_HINTS_ENABLED`

Defaults actuales:

- presets por actividad: `true`
- preset IA: `false`
- help hints: `true`

## Persistencia del perfil

### Tablas activas

- `organization_business_profile_versions`
- `organization_business_profile_activities`
- `organization_business_profile_traits`
- `organization_preset_applications`

### Regla de versionado

Cada cambio relevante crea nueva version. El sistema desactiva la version actual y crea una nueva con:

- actividad principal;
- secundarias limpias y sin duplicados;
- traits;
- descripcion corta;
- flags derivados como imports/exports/mixed VAT/multi-currency.

## Modos de arranque del plan

Soportados hoy:

- `recommended`
- `alternative`
- `external_import`
- `minimal_temp_only`
- `hybrid_ai_recommended`

Semantica real:

- `recommended`: aplica la composicion sugerida por reglas;
- `alternative`: aplica una alternativa elegida por el usuario;
- `external_import`: desvia al carril de importacion de planilla;
- `minimal_temp_only`: arranca con cuentas temporales o minima estructura;
- `hybrid_ai_recommended`: aplica la composicion recomendada por IA dentro del set permitido.

## Superficies de UI

### Onboarding

- `app/onboarding/page.tsx`
- `components/organization-onboarding-form.tsx`
- `components/onboarding/business-profile-configurator.tsx`

### Settings

- `app/app/o/[slug]/settings/page.tsx`
- `components/settings/business-profile-settings.tsx`

Settings concentra:

- datos base de organizacion;
- business profile y recomendacion de plan;
- perfil fiscal versionado;
- administracion del chart of accounts.

## Politica de historia

- cambiar business profile o traits no reprocesa historicos;
- cambiar plan de cuentas no rerunea IA sobre documentos viejos;
- nuevas versiones operan hacia adelante;
- si se quiere reclasificar un documento ya confirmado, se hace via reapertura controlada.

## Estado actual frente al rector

### Implementado

- onboarding con captura registral y operativa;
- versionado de business profile;
- traits y actividad economica;
- recomendacion de presets por reglas;
- recomendacion hibrida con IA opcional;
- settings integrados con historial y preset activo.

### Parcial

- copy y UX todavia conviven con lenguaje de varias iteraciones previas;
- no existe aun una experiencia de claim/invitacion para una org ya creada;
- la organizacion sigue siendo el pivot, pero el modelo de membresias futuras todavia no tiene UI dedicada.

### Pendiente

- formularios mas ricos para fuentes externas oficiales;
- catalogos mas profundos por industria;
- cost centers y jobs como entidades de setup real dentro de onboarding/settings.
