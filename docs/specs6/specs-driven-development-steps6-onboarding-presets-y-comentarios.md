# specs-driven-development-steps6-onboarding-presets-y-comentarios.md

## Objetivo

Implementar en Convertilabs un **onboarding contable/fiscal guiado por actividad económica y rasgos operativos**, con **presets modulares de plan de cuentas** y con **comentarios explicativos del sistema** visibles mediante iconos `?`, de forma que:

1. cada nueva organización reciba una recomendación de plan de cuentas mucho más precisa;
2. el usuario no tenga que inventar su estructura contable desde cero para empezar;
3. la recomendación quede anclada a criterios oficiales de Uruguay cuando existan;
4. el sistema siga funcionando aunque el usuario no elija un plan completo, usando cuentas temporales;
5. la UI explique con claridad qué significa cada decisión, por qué importa y qué impacto tiene;
6. el resultado sirva tanto a usuarios novatos como a contadores quisquillosos;
7. la arquitectura quede lista para crecer sin convertir el producto en un zoológico de presets inmantenibles.

---

## Decisión de producto adoptada

### Qué se implementará

Se adopta este modelo:

- **un plan base general del sistema** para Uruguay;
- **overlays por actividad económica**;
- **overlays por rasgos fiscales/operativos**;
- **onboarding guiado** por:
  - actividad principal,
  - actividades secundarias,
  - rasgos operativos/fiscales,
  - texto corto opcional;
- **recomendación automática de presets**;
- **explicaciones visibles del sistema** mediante iconos `?`, popovers y textos breves orientados a decisión.

### Qué NO se implementará

1. No se hará un “plan totalmente distinto por cada rubro” como si cada empresa fuese una isla.
2. No se venderá esto como “plan oficial del MEF”, porque el MEF publica normas contables adecuadas, no un plan universal obligatorio para toda empresa privada general.
3. No se dependerá de APIs externas en tiempo real para clasificar actividad o recomendar presets.
4. No se bloqueará el onboarding si el usuario no sabe elegir su plan final.
5. No se llenará la UI de párrafos; las explicaciones se esconderán detrás de `?`, salvo alertas críticas.

---

## Fundamento oficial que debemos respetar

### 1. Clasificación de actividad: DGI / CIIU

La base oficial para clasificar actividad económica en Uruguay es la **CIIU Rev. 4** adaptada y publicada por DGI. Esa debe ser la fuente primaria del selector de actividad principal y secundarias.

### 2. Ayuda de clasificación: INE / Vulcano

El INE tiene **Vulcano**, un codificador de actividades económicas. No se usará como dependencia runtime, pero sí como inspiración funcional: pocas preguntas + sugerencias concretas de actividad.

### 3. Alta registral: formulario 0351

El formulario 0351 muestra que la realidad registral uruguaya ya distingue:

- actividad principal,
- actividad secundaria,
- domicilio,
- obligaciones,
- banderas como importador/exportador.

El onboarding de Convertilabs debe seguir esa lógica mental y no inventar una taxonomía alienígena.

### 4. Normas contables: MEF

El MEF publica las **normas contables adecuadas** aplicables en Uruguay. Eso sirve para alinear la estructura del plan y sus tags de reporting, pero **no** para fingir que existe un plan universal del MEF por rubro.

### 5. Rasgos fiscales importantes

La lógica del sistema debe contemplar que en Uruguay:

- pueden coexistir operaciones gravadas y no gravadas;
- el IVA compras no siempre es íntegramente deducible;
- existen casos de prorrata;
- existen operaciones de importación, exportación e IVA en suspenso;
- la moneda extranjera debe convertirse con criterio fiscal trazable.

---

## Principio arquitectónico central

No construir “planes por rubro” como bloques gigantes y cerrados.

Construir:

1. **Preset base general Uruguay**
2. **Overlay por actividad principal**
3. **Overlays por actividades secundarias**
4. **Overlays por rasgos operativos/fiscales**
5. **Fallback con cuentas temporales**

Esto permite que una organización como Rontil sea una composición de capacidades, por ejemplo:

- base general Uruguay S.A.;
- comercio mayorista de equipos y repuestos;
- servicios técnicos / mantenimiento;
- importador;
- multi-moneda;
- eventualmente operaciones mixtas gravadas/no gravadas.

---

## Resultado UX esperado

Cuando un usuario cree una organización, el flujo debe verse así:

1. completa datos básicos legales y fiscales;
2. selecciona actividad principal desde catálogo oficial CIIU;
3. marca actividades secundarias relevantes;
4. marca rasgos operativos/fiscales mediante checkboxes claros;
5. opcionalmente agrega una descripción muy corta de su negocio;
6. el sistema le recomienda un plan de cuentas compuesto;
7. el sistema le explica **por qué** lo recomienda;
8. el usuario elige entre:
   - usar plan recomendado,
   - elegir otra opción sugerida,
   - importar plan externo,
   - empezar con plan mínimo + cuentas temporales;
9. el sistema confirma qué quedó aplicado y qué implicancias tiene.

---

## Criterio UX para los comentarios del sistema

### Regla principal

Todo lo que tenga impacto real en:

- IVA,
- journals,
- plan de cuentas,
- exportación,
- bloqueo o destrabe del flujo,
- trazabilidad,
- cambio de comportamiento futuro,

...debe tener una explicación accesible para el usuario.

### Regla secundaria

La explicación **no** debe romper la UI.

Por eso se usará:

- icono `?` junto a labels, chips, recomendaciones y estados;
- hover en desktop;
- click/tap para abrir popover;
- cierre automático al perder foco o click fuera;
- para mobile, siempre click/tap.

### Regla crítica

Las alertas importantes no deben quedar invisibles.

Ejemplo correcto:

- se muestra el chip visible: `IVA indirecto` o `Revisión sugerida`;
- al lado hay un `?` con la explicación completa.

Ejemplo incorrecto:

- esconder una alerta crítica solamente detrás del `?`.

---

## Diseño editorial de las explicaciones

Cada comentario del sistema debe responder siempre, como mínimo, estas cuatro preguntas:

1. **Qué es esto**
2. **Por qué importa**
3. **Qué impacto tiene**
4. **Qué puede hacer el usuario si no está de acuerdo**

### Tono

- español claro;
- sin jerga innecesaria;
- sin frases tipo “se aplicó el perfil V2 por consistencia taxonómica”;
- primero la consecuencia práctica, después el detalle;
- para expertos, incluir detalle expandible o bloque “ver fundamento”.

### Estructura recomendada

```ts
export type HelpHintContent = {
  key: string;
  title: string;
  shortLabel: string;
  whatIsIt: string;
  whyItMatters: string;
  impact: string;
  whatCanYouDo: string;
  sourceLabel?: string;
  expertNotes?: string[];
};
```

### Ejemplo bueno

**Actividad principal**
- Qué es: El rubro que mejor representa el negocio principal de la empresa.
- Por qué importa: Se usa para sugerir cuentas, reglas y plantillas acordes a la operativa habitual de ese tipo de empresa.
- Impacto: Cambia la recomendación inicial del plan de cuentas y las sugerencias contables.
- Qué podés hacer: Elegir otra actividad o corregirla después desde configuración.

### Ejemplo malo

“Actividad principal según taxonomía CIIU para inicialización de overlays.”

Eso suena a reunión de robots con corbata.

---

## Alcance funcional

### Alcance obligatorio en esta entrega

1. Selector de actividad principal con catálogo CIIU.
2. Selector de actividades secundarias.
3. Checkboxes de rasgos operativos/fiscales.
4. Texto corto opcional para afinar sugerencia.
5. Motor de recomendación de presets por composición.
6. Aplicación del plan recomendado.
7. Opción de importar plan externo.
8. Opción de usar plan mínimo + cuentas temporales.
9. Framework de comentarios explicativos con icono `?`.
10. Comentarios específicos en onboarding y recomendación de plan.

### Alcance recomendado si el tiempo alcanza

1. Reutilizar el mismo framework de comentarios en review documental.
2. Mostrar comentarios expertos con evidencia técnica.
3. Guardar trazabilidad de por qué se sugirió un preset.
4. Recalcular sugerencias si el usuario cambia actividad o traits.

### Alcance fuera de esta entrega

1. Reentrenamiento automático de actividad por documentos históricos.
2. Llamadas online a servicios oficiales en el onboarding.
3. Presets ultra sectoriales para 40 rubros desde el día uno.

---

## Modelo de datos propuesto

## 1) Catálogo oficial de actividad (snapshot en repo, no runtime API)

**No** meter esto en una API remota en tiempo real.

### Nuevo artefacto de datos

`data/uy/ciiu-rev4-activity-catalog.json`

Contenido mínimo:

```json
[
  {
    "code": "46590",
    "title": "Comercio al por mayor de otro tipo de maquinaria y equipo",
    "section": "G",
    "division": "46",
    "group": "465",
    "class": "4659",
    "aliases": ["maquinaria", "equipos", "repuestos", "equipamiento"],
    "is_active": true,
    "source": "DGI CIIU Rev.4"
  }
]
```

### Regla

Este catálogo debe versionarse en git y cargarse desde el repo. No depende de red.

---

## 2) Rasgos operativos/fiscales (traits)

### Nuevo artefacto de datos

`data/uy/organization-traits.json`

Separar en dos familias:

#### A. Rasgos anclados en lógica oficial/registral

- `imports_goods`
- `exports_goods`
- `exports_services`
- `vat_taxed_operations`
- `vat_exempt_or_non_taxed_operations`
- `mixed_vat_operations`
- `possible_vat_suspenso`
- `multi_currency_operations`

#### B. Rasgos del sistema, orientados a operación contable/fiscal

- `sells_goods`
- `provides_services`
- `maintains_inventory`
- `technical_installation_or_maintenance`
- `manufactures_or_assembles`
- `public_tenders`
- `recurring_service_contracts`
- `uses_cost_centers`
- `field_technicians_or_mobile_units`

### Shape recomendado

```json
[
  {
    "code": "imports_goods",
    "group": "tax_and_operations",
    "label": "Importa bienes",
    "description": "La empresa compra bienes en el exterior y nacionaliza mercadería o activos.",
    "source_kind": "official-inspired",
    "affects_presets": ["OVERLAY_IMPORTER", "OVERLAY_MULTI_CURRENCY"],
    "affects_tax_profiles": ["UY_VAT_IMPORT_CREDITABLE", "UY_VAT_IMPORT_ANTICIPO"]
  }
]
```

---

## 3) Perfil de negocio de la organización

### Nueva tabla

`organization_business_profile_versions`

Campos:

- `id`
- `organization_id`
- `version_no`
- `primary_activity_code`
- `short_description`
- `has_mixed_vat_operations`
- `has_imports`
- `has_exports`
- `is_multi_currency`
- `source` (`onboarding`, `settings_update`, `admin_correction`)
- `is_current`
- `created_at`
- `created_by`

### Nueva tabla

`organization_business_profile_activities`

Campos:

- `id`
- `business_profile_version_id`
- `activity_code`
- `role` (`primary`, `secondary`)
- `rank`

### Nueva tabla

`organization_business_profile_traits`

Campos:

- `id`
- `business_profile_version_id`
- `trait_code`
- `enabled`

### Regla de versionado

No pisar en caliente el perfil anterior. Crear nueva versión y marcar la anterior como no actual.

Esto permite auditoría y evita magia silenciosa.

---

## 4) Presets y overlays aplicados

### No guardar la definición del preset en DB como verdad primaria

La **definición** debe vivir en el repo, versionada.

La **aplicación** sí debe persistirse por organización.

### Nueva tabla

`organization_preset_applications`

Campos:

- `id`
- `organization_id`
- `business_profile_version_id`
- `base_preset_code`
- `overlay_codes_json`
- `application_mode` (`recommended`, `manual_pick`, `external_import`, `minimal_temp_only`)
- `explanation_json`
- `applied_at`
- `applied_by`
- `active`

### `explanation_json`

Debe guardar por qué se aplicó esa combinación. Esto luego se puede mostrar en UI y auditar.

---

## 5) Framework de explicaciones del sistema

### Para ayuda estática de UI

No crear tabla. Mantenerlo en código.

Archivo nuevo:

`modules/ui/help-hints-registry.ts`

### Para comentarios dinámicos de decisión

No crear tabla genérica nueva en esta etapa.

Usar:

- `organization_preset_applications.explanation_json`
- metadatos/audit logs existentes para documentos
- payloads de respuesta en endpoints server

Archivo nuevo:

`modules/explanations/decision-comment-builder.ts`

---

## Arquitectura de presets

## 1) Definiciones base

Crear carpeta:

`modules/accounting/presets/`

Estructura propuesta:

```txt
modules/accounting/presets/
  catalog.ts
  types.ts
  compose-preset.ts
  validate-preset.ts
  base/
    uy-base-sa-general.v1.ts
  activity/
    ciiu-46-wholesale-equipment.v1.ts
    ciiu-33-repair-installation.v1.ts
    ciiu-28-light-manufacturing.v1.ts
    ciiu-47-retail.v1.ts
    ciiu-01-03-agro.v1.ts
  traits/
    importer.v1.ts
    exporter.v1.ts
    mixed-vat.v1.ts
    multi-currency.v1.ts
    recurring-services.v1.ts
    tenders-public-sector.v1.ts
```

## 2) Tipo base sugerido

```ts
export type PresetBundle = {
  code: string;
  version: string;
  kind: 'base' | 'activity_overlay' | 'trait_overlay';
  label: string;
  description: string;
  compatibleActivityCodes?: string[];
  compatibleTraits?: string[];
  incompatibleTraits?: string[];
  accounts: ChartAccountSeed[];
  journalTemplates: JournalTemplateSeed[];
  taxProfiles: TaxProfileSeed[];
  uiHints?: PresetUiHint[];
};
```

## 3) Orden de composición

Aplicar en este orden:

1. base general;
2. overlay de actividad principal;
3. overlays de actividades secundarias;
4. overlays de traits;
5. fallback de cuentas temporales obligatorias si faltan.

## 4) Regla de conflictos

Si dos overlays proponen la misma cuenta:

- si el `code` y el `semantic_key` coinciden, merge;
- si el `code` coincide pero el significado cambia, error de validación de preset;
- si el nombre cambia solo por etiqueta, prevalece el más específico;
- nunca borrar cuentas técnicas obligatorias del sistema.

---

## Diseño del onboarding

## Pantalla 1 — Datos básicos de organización

Mantener lo actual y agregar ayuda contextual `?`.

Campos actuales relevantes:

- nombre;
- forma jurídica;
- RUT;
- régimen tributario;
- régimen IVA;
- grupo DGI;
- estado CFE.

### Cambios

Agregar `?` junto a todos los campos que tengan impacto fiscal u operativo.

Ejemplos de hints:

- `forma_juridica`
- `regimen_iva`
- `grupo_dgi`
- `estado_cfe`

---

## Pantalla 2 — Actividad principal y secundarias

### Componentes nuevos

- `ActivityCodeSearch`
- `ActivityCodeSuggestedList`
- `SecondaryActivitiesSelector`
- `HelpHint`

### Flujo

1. usuario busca actividad principal por código o texto;
2. sistema muestra resultados CIIU;
3. usuario elige una actividad principal;
4. usuario puede agregar 0 a 5 actividades secundarias;
5. al elegir una actividad, aparece un `?` que explica qué significa y por qué importa.

### Reglas UX

- mostrar código + título corto;
- permitir búsqueda por alias;
- priorizar coincidencias exactas;
- no obligar al usuario a saber el código;
- si no encuentra, permitir texto corto y sugerir 3 opciones, pero **sin auto-elegir**.

---

## Pantalla 3 — Rasgos operativos/fiscales

### Componentes nuevos

- `TraitChecklist`
- `TraitGroupCard`
- `HelpHint`

### Grupos sugeridos

#### Grupo: Qué hace la empresa

- vende bienes;
- presta servicios;
- fabrica o ensambla;
- mantiene inventario;
- hace instalación o mantenimiento técnico.

#### Grupo: Cómo opera fiscalmente

- realiza operaciones gravadas por IVA;
- realiza operaciones exentas o no gravadas;
- puede tener IVA indirecto / prorrata;
- opera con IVA en suspenso;
- importa bienes;
- exporta bienes;
- exporta servicios;
- opera en varias monedas.

#### Grupo: Cómo gestiona su operación

- trabaja por contratos recurrentes;
- vende a organismos públicos / licitaciones;
- usa centros de costo o proyectos;
- tiene técnicos en campo / camionetas / stock móvil.

### Regla de diseño

Cada checkbox lleva `?` con:

- qué significa;
- por qué se pregunta;
- qué cambia si se marca.

---

## Pantalla 4 — Descripción corta opcional

Campo simple:

`short_business_description`

Placeholder ejemplo:

> Importamos equipos, vendemos repuestos y hacemos instalación y mantenimiento en todo el país.

### Uso

No será el insumo principal. Sirve para:

- desempatar recomendaciones;
- sugerir una actividad si el usuario todavía duda;
- enriquecer el comentario explicativo del plan recomendado.

### Regla

Nunca autoaplicar un preset sólo por texto libre.

---

## Pantalla 5 — Recomendación de plan

### Componentes nuevos

- `PresetRecommendationCard`
- `PresetAlternativeCard`
- `PlanOptionSelector`
- `HelpHint`
- `DecisionWhyPopover`

### Opciones que el usuario verá

1. **Usar plan recomendado**
2. **Elegir otra recomendación**
3. **Importar mi plan de cuentas**
4. **Empezar con plan mínimo + cuentas temporales**

### Qué debe mostrar la tarjeta principal

- nombre del plan recomendado;
- composición (base + overlays);
- 3 o 4 razones de por qué se recomendó;
- 3 o 4 cosas concretas que agrega;
- aclaración de que puede cambiarlo después;
- `?` con explicación extendida.

### Ejemplo de copy

**Plan recomendado: Comercio + Servicios técnicos + Importador**

Razones:
- elegiste como actividad principal un rubro de comercio mayorista de equipos;
- marcaste que prestás servicios de instalación/mantenimiento;
- marcaste que importás bienes;
- marcaste que operás en varias monedas.

Este plan agrega:
- cuentas para mercadería en tránsito y proveedores del exterior;
- cuentas para servicios técnicos y contratos de mantenimiento;
- cuentas para diferencia de cambio y multi-moneda;
- plantillas contables iniciales para compras, ventas, importaciones y servicios.

---

## Motor de recomendación de presets

## Objetivo

Dado un perfil de negocio, devolver:

- `recommended_preset_composition`
- `alternative_compositions[]`
- `explanation`
- `confidence`

## Archivo nuevo

`modules/accounting/presets/recommendation-engine.ts`

## Inputs

- `primaryActivityCode`
- `secondaryActivityCodes[]`
- `traits[]`
- `shortDescription?`

## Output sugerido

```ts
export type PresetRecommendationResult = {
  recommended: PresetComposition;
  alternatives: PresetComposition[];
  explanation: DecisionComment;
  scoreBreakdown: {
    primaryActivity: number;
    secondaryActivities: number;
    traits: number;
    textDescription: number;
  };
};
```

## Algoritmo inicial

### Peso sugerido

- actividad principal: **60%**
- actividades secundarias: **20%**
- traits: **20%**
- texto corto: sólo desempate, no peso estructural fuerte

### Reglas

1. siempre arrancar por `UY_BASE_SA_GENERAL_V1`;
2. elegir overlay principal por la familia CIIU;
3. sumar overlays secundarios compatibles;
4. sumar overlays por traits;
5. validar conflictos;
6. si faltan cuentas técnicas, agregar fallback técnico;
7. generar explicación entendible.

### No usar IA en el motor central

La recomendación debe ser determinística. La IA puede ayudar a sugerir actividades cuando el usuario escribe texto, pero la composición final se resuelve por reglas.

---

## Sistema de comentarios explicativos

## 1) Ayuda contextual estática (`?`)

### Componente nuevo

`components/ui/help-hint.tsx`

### Props sugeridas

```ts
type HelpHintProps = {
  contentKey: string;
  mode?: 'tooltip' | 'popover';
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'info' | 'warning';
};
```

### Comportamiento

- desktop:
  - hover: preview corto;
  - click: popover completo;
- mobile:
  - click/tap: popover completo;
- cerrar con click afuera o `Esc`.

### Diseño del popover

Bloques:

- **Qué es**
- **Por qué importa**
- **Impacto**
- **Qué podés hacer**
- opcional: **Fundamento**

### Archivo de contenido

`modules/ui/help-hints-registry.ts`

### Claves iniciales obligatorias

#### Onboarding

- `onboarding.primary_activity`
- `onboarding.secondary_activities`
- `onboarding.short_description`
- `onboarding.trait.imports_goods`
- `onboarding.trait.exports_goods`
- `onboarding.trait.mixed_vat_operations`
- `onboarding.trait.multi_currency_operations`
- `onboarding.trait.recurring_service_contracts`
- `onboarding.recommended_plan`
- `onboarding.option.import_external_chart`
- `onboarding.option.minimal_temp_plan`

#### Fiscal/contable (para reuso futuro)

- `document.vat_direct`
- `document.vat_indirect`
- `document.vat_non_deductible`
- `document.posted_provisional`
- `document.temporary_account`
- `document.location_outlier`

---

## 2) Comentarios dinámicos de decisión

### Archivo nuevo

`modules/explanations/decision-comment-builder.ts`

### Tipo sugerido

```ts
export type DecisionComment = {
  code: string;
  severity: 'info' | 'warning' | 'success' | 'soft_block';
  shortLabel: string;
  summary: string;
  whyItMatters: string;
  impact: string;
  whatCanYouDo: string;
  sourceKind: 'official' | 'system_rule' | 'user_input' | 'imported_data' | 'ai_assist';
  sourceLabel?: string;
  expertNotes?: string[];
  evidence?: Array<{ label: string; value: string }>;
};
```

### Ejemplo: recomendación de plan

```ts
{
  code: 'preset_recommended_commerce_services_importer',
  severity: 'info',
  shortLabel: 'Plan recomendado por actividad y operativa',
  summary: 'Recomendamos este plan porque tu empresa combina comercio, servicios técnicos e importación.',
  whyItMatters: 'Esa combinación cambia las cuentas iniciales, los asientos sugeridos y el tratamiento de ciertas compras y operaciones en moneda extranjera.',
  impact: 'Se crearán cuentas y plantillas para stock, servicios, importaciones y diferencia de cambio. Podrás cambiarlo después.',
  whatCanYouDo: 'Podés aceptar esta recomendación, elegir otra, importar tu plan o empezar con cuentas mínimas.',
  sourceKind: 'system_rule',
  expertNotes: [
    'Base: UY_BASE_SA_GENERAL_V1',
    'Overlay actividad: CIIU_46_WHOLESALE_EQUIPMENT_V1',
    'Overlay actividad: CIIU_33_REPAIR_INSTALLATION_V1',
    'Overlay trait: IMPORTER_V1',
    'Overlay trait: MULTI_CURRENCY_V1'
  ]
}
```

---

## Integración con opción de importar plan externo

Este trabajo debe convivir con la otra feature ya especificada:

- importación inteligente de plan de cuentas desde XLSX/CSV;
- system prompt para interpretar planillas heterogéneas;
- adopción segura del plan importado.

### En onboarding, la opción “Importar mi plan” debe:

1. dejar el flujo en estado válido aunque la importación no ocurra en el mismo momento;
2. permitir fallback a plan mínimo + temporales;
3. mostrar un `?` explicando que:
   - el sistema intentará interpretar la planilla;
   - el orden de columnas puede variar;
   - el usuario revisará el resultado antes de adoptar el plan.

### Mensaje sugerido

> Si ya tenés un plan en Excel o exportado de otro sistema, podés importarlo. Convertilabs intentará reconocer códigos, nombres, tipos y jerarquías aunque el archivo no siga un formato único.

---

## Integración con cuentas temporales

La nueva lógica no debe romper el flujo mínimo actual.

### Regla

Si el usuario:

- no quiere elegir plan recomendado,
- no quiere importar uno,
- o no termina el setup contable,

...el sistema debe aplicar:

- `starter accounts` actuales;
- cuentas temporales `TEMP-*`;
- journals mínimos;
- processing enabled.

### Explicación visible sugerida

> Podés empezar ahora con una estructura mínima. Tus documentos se van a poder procesar igual, usando cuentas temporales cuando falte una cuenta definitiva. Más adelante podés completar o importar tu plan sin perder lo ya cargado.

---

## Persistencia y no-retroactividad

Esto es importante y Codex no debe meter la pata.

### Regla 1

Cambiar actividad o traits en configuración **no** debe reescribir automáticamente journals históricos.

### Regla 2

Cambiar el preset aplicado:

- puede agregar cuentas nuevas;
- puede marcar cuentas como inactivas hacia adelante;
- puede recalcular sugerencias futuras;
- puede ofrecer recategorización opcional de pendientes;
- no debe mutar silenciosamente documentos cerrados.

### Regla 3

Toda nueva aplicación de preset debe quedar versionada.

---

# Paso a paso detallado para implementar con Codex

## Etapa 0 — Preparación y feature flags

### Objetivo

Evitar romper onboarding actual mientras se construye la nueva versión.

### Tareas

1. crear feature flag:
   - `onboarding_activity_based_presets_enabled`
   - `ui_help_hints_enabled`
2. envolver nueva UI bajo flags;
3. mantener compatibilidad con onboarding existente.

### Archivos probables

- `app/onboarding/actions.ts`
- `modules/organizations/onboarding-schema.ts`
- `modules/feature-flags/...` (según repo)

### Criterio de aceptación

- con flags apagados, el sistema se comporta exactamente igual que hoy;
- con flags encendidos, aparece el nuevo flujo.

---

## Etapa 1 — Seed de catálogos oficiales y rasgos

### Objetivo

Tener una base estable, offline y versionada.

### Tareas

1. crear `data/uy/ciiu-rev4-activity-catalog.json`;
2. cargar snapshot inicial con:
   - código;
   - título;
   - jerarquía;
   - aliases de búsqueda;
3. crear `data/uy/organization-traits.json`;
4. crear `scripts/validate-uy-catalogs.ts` para validar estructura;
5. documentar fuente oficial usada para el snapshot.

### Importante

- no descargar en runtime desde DGI/INE;
- mantener el snapshot en git;
- agregar comentario de versión y fecha de verificación.

### Criterio de aceptación

- se puede buscar actividad por código o texto;
- se pueden listar traits agrupados.

---

## Etapa 2 — Tipos de dominio y utilidades base

### Objetivo

Tipar el modelo antes de tocar UI y lógica.

### Tareas

Crear:

- `modules/organizations/activity-types.ts`
- `modules/accounting/presets/types.ts`
- `modules/explanations/types.ts`

### Tipos mínimos

- `ActivityCatalogEntry`
- `OrganizationTraitDefinition`
- `BusinessProfileInput`
- `PresetBundle`
- `PresetComposition`
- `DecisionComment`
- `HelpHintContent`

### Criterio de aceptación

- no hay lógica fuerte todavía, pero el dominio compila;
- todo el resto del trabajo puede importar estos tipos.

---

## Etapa 3 — Migraciones de negocio

### Objetivo

Persistir el perfil de negocio y la aplicación de presets.

### Tareas

Crear migración SQL para:

1. `organization_business_profile_versions`
2. `organization_business_profile_activities`
3. `organization_business_profile_traits`
4. `organization_preset_applications`

### Recomendación

Usar nombres y timestamps consistentes con las tablas ya existentes.

### Criterio de aceptación

- la migración corre sin romper organizaciones existentes;
- para organizaciones viejas no se exige backfill inmediato.

---

## Etapa 4 — Catálogo de actividades y búsqueda

### Objetivo

Construir el selector de actividad.

### Tareas

Crear:

- `modules/organizations/activity-catalog.ts`
- `modules/organizations/activity-search.ts`
- `components/onboarding/activity-code-search.tsx`
- `components/onboarding/secondary-activities-selector.tsx`

### Funciones mínimas

- `searchActivities(query)`
- `getActivityByCode(code)`
- `getSuggestedActivitiesFromText(text)`

### Regla barata y prolija

Primero usar búsqueda determinística con:

- título;
- aliases;
- coincidencia por código;
- palabras clave normalizadas.

### IA opcional

La IA para sugerir actividades desde descripción corta debe ser **opcional** y sólo si la búsqueda determinística no alcanza. Nunca auto-confirma.

### Criterio de aceptación

- búsqueda usable con términos comunes;
- selección estable de actividad principal y secundarias.

---

## Etapa 5 — Rasgos operativos/fiscales

### Objetivo

Construir la pantalla de traits.

### Tareas

Crear:

- `modules/organizations/traits-catalog.ts`
- `components/onboarding/trait-checklist.tsx`
- `components/onboarding/trait-group-card.tsx`

### Reglas UX

- agrupar por tema;
- permitir multi-selección;
- cada trait con `?`;
- si el usuario marca `vat_exempt_or_non_taxed_operations`, sugerir automáticamente mostrar también `mixed_vat_operations`.

### Criterio de aceptación

- los traits quedan seleccionados y persistibles;
- la UI se entiende sin manual de 90 páginas.

---

## Etapa 6 — Framework de `?` y ayudas contextuales

### Objetivo

Implementar el componente de ayuda reutilizable.

### Tareas

Crear:

- `components/ui/help-hint.tsx`
- `modules/ui/help-hints-registry.ts`

### Requisitos funcionales

1. preview corta en hover desktop;
2. popover completa en click;
3. soporte mobile;
4. accesibilidad con teclado;
5. render seguro de texto largo;
6. estilo discreto;
7. no tapar controles críticos.

### Requisitos editoriales

- máximo 1 frase corta en preview;
- popover con 4 bloques estándar;
- para expertos, bloque colapsable “ver fundamento”.

### Criterio de aceptación

- todo campo nuevo del onboarding tiene su `?`;
- el contenido es entendible por un usuario no técnico;
- no rompe layout.

---

## Etapa 7 — Definiciones de presets y overlays

### Objetivo

Crear la biblioteca inicial de presets.

### Tareas

#### Base obligatoria

- `UY_BASE_SA_GENERAL_V1`

#### Overlays iniciales obligatorios

1. `CIIU_46_WHOLESALE_EQUIPMENT_V1`
2. `CIIU_33_REPAIR_INSTALLATION_V1`
3. `CIIU_47_RETAIL_V1`
4. `CIIU_01_03_AGRO_V1`
5. `TRAIT_IMPORTER_V1`
6. `TRAIT_EXPORTER_V1`
7. `TRAIT_MIXED_VAT_V1`
8. `TRAIT_MULTI_CURRENCY_V1`
9. `TRAIT_RECURRING_SERVICES_V1`
10. `TRAIT_PUBLIC_TENDERS_V1`

### Cada preset debe traer

- cuentas;
- journal templates mínimas;
- tax profiles necesarios;
- hints de UI opcionales;
- validación de compatibilidad.

### Criterio de aceptación

- se pueden componer presets sin conflictos;
- el preset para Rontil sale de composición, no de hardcode especial.

---

## Etapa 8 — Motor de recomendación

### Objetivo

Tomar el perfil de negocio y devolver una recomendación explicada.

### Tareas

Crear:

- `modules/accounting/presets/recommendation-engine.ts`
- `modules/accounting/presets/compose-preset.ts`
- `modules/accounting/presets/validate-preset.ts`

### Salida mínima

- recomendado;
- alternativas;
- `DecisionComment`;
- breakdown de score.

### Regla de alternativas

Mostrar siempre:

- recomendación principal;
- hasta 2 alternativas cercanas;
- importación externa;
- mínimo + temporales.

### Criterio de aceptación

- el motor genera explicación coherente;
- los resultados son reproducibles;
- no hay dependencia de IA para la composición final.

---

## Etapa 9 — Backend de onboarding

### Objetivo

Extender el submit de onboarding.

### Tareas

Modificar:

- `modules/organizations/onboarding-schema.ts`
- `app/onboarding/actions.ts`

### Nuevo schema esperado

Agregar:

- `primaryActivityCode`
- `secondaryActivityCodes[]`
- `selectedTraits[]`
- `shortBusinessDescription?`
- `planSetupMode` (`recommended`, `alternative`, `external_import`, `minimal_temp_only`)
- `selectedPresetComposition?`

### Lógica de submit

1. validar base legal/fiscal;
2. persistir organización;
3. crear `organization_business_profile_versions`;
4. generar recomendación de preset;
5. según decisión del usuario:
   - aplicar plan recomendado,
   - aplicar alternativa,
   - dejar pendiente importación externa,
   - aplicar mínimo + temporales;
6. guardar `organization_preset_applications`;
7. ejecutar bootstrap contable correspondiente;
8. materializar o refrescar snapshot de reglas.

### Criterio de aceptación

- onboarding termina con organización operable;
- aunque el usuario elija “mínimo + temporales”, el pipeline documental queda funcional.

---

## Etapa 10 — Aplicación del plan recomendado

### Objetivo

Crear cuentas, templates y perfiles fiscales a partir de la composición elegida.

### Tareas

Crear/ajustar:

- `modules/accounting/chart-manager.ts`
- `modules/accounting/repository.ts`
- `modules/accounting/starter-accounts.ts`
- `modules/accounting/preset-apply-service.ts`

### Lógica

1. asegurar cuentas técnicas obligatorias;
2. aplicar cuentas del base preset;
3. aplicar cuentas de overlays;
4. evitar duplicados;
5. mantener `TEMP-*` siempre disponibles;
6. crear tax profiles y journal templates asociadas;
7. registrar qué quedó aplicado.

### Criterio de aceptación

- la organización queda con plan suficiente para operar;
- no se duplican cuentas por reaplicar preset;
- los templates quedan listos para documents y VAT engine.

---

## Etapa 11 — UI de recomendación y comentarios visibles

### Objetivo

Hacer comprensible la recomendación.

### Tareas

Crear:

- `components/onboarding/preset-recommendation-card.tsx`
- `components/onboarding/preset-alternative-card.tsx`
- `components/onboarding/decision-why-popover.tsx`

### Reglas UX

- el card muestra resumen corto;
- el `?` explica el detalle;
- si el usuario cambia una selección, recalcular en caliente;
- mostrar claramente si el plan recomendado agrega:
  - importaciones,
  - servicios,
  - multi-moneda,
  - prorrata/IVA mixto,
  - contratos recurrentes.

### Criterio de aceptación

- el usuario entiende por qué se le sugiere ese plan;
- puede elegir otra opción sin perder control.

---

## Etapa 12 — Reuso del framework en review documental

### Objetivo

No dejar el `?` encerrado sólo en onboarding.

### Tareas

Integrar progresivamente en:

- `components/documents/document-review-workspace.tsx`

### Casos iniciales sugeridos

- `IVA directo`
- `IVA indirecto`
- `No deducible`
- `Cuenta temporal`
- `Posteo provisional`
- `Alerta geográfica`
- `Tipo de cambio fiscal usado`

### Criterio de aceptación

- al menos 5 decisiones importantes de review muestran explicación accesible.

---

## Etapa 13 — Ajustes para configuración posterior de organización

### Objetivo

Permitir editar perfil después del onboarding.

### Tareas

Crear:

- `components/settings/business-profile-settings.tsx`
- `app/o/[slug]/settings/...` (según estructura real)

### Lógica

1. permitir editar actividad y traits;
2. crear nueva versión del perfil;
3. recalcular recomendación;
4. permitir aplicar nueva composición hacia adelante;
5. no alterar journals históricos;
6. mostrar comentario explicativo del cambio.

### Criterio de aceptación

- una organización puede evolucionar sin perder trazabilidad.

---

## Etapa 14 — Integración con importación de plan externo

### Objetivo

Alinear onboarding con la otra gran puerta de entrada.

### Tareas

Ajustar:

- `modules/spreadsheets/import-runner.ts`
- wizard o modal de importación correspondiente

### Reglas

1. si el usuario elige importar, no se rompe el onboarding;
2. si el import falla, se puede seguir con temporales;
3. mostrar explicación `?` sobre cómo funciona el reconocimiento del archivo;
4. si luego se importa correctamente, marcar la aplicación previa como reemplazada o superada.

### Criterio de aceptación

- “importar mi plan” es una opción real y no un callejón sin salida.

---

## Etapa 15 — Tests y cobertura de explicaciones

### Objetivo

Evitar que el sistema quede lleno de huecos mudos.

### Tests mínimos

#### Dominio

- recomendación correcta dado un perfil tipo Rontil;
- composición sin conflictos;
- fallback a temporales si no hay preset.

#### UI / contenido

- todo field importante del onboarding tiene `contentKey` válido;
- toda tarjeta de recomendación muestra comentario explicativo;
- el `?` renderiza preview y popover.

#### Reglas de cobertura

Crear test:

- `help-hints-coverage.test.ts`

Objetivo:

- si se agrega un campo importante sin `?`, el test falla.

Crear test:

- `preset-recommendation-explanations.test.ts`

Objetivo:

- si se devuelve una recomendación sin explicación, el test falla.

---

## Etapa 16 — Telemetría y validación real

### Objetivo

Medir si esto ayuda o sólo quedó bonito.

### Eventos a trackear

- actividad principal elegida;
- número de actividades secundarias;
- traits seleccionados;
- preset recomendado;
- preset aceptado;
- uso de alternativa;
- uso de importación externa;
- uso de plan mínimo + temporales;
- apertura de `?` por campo;
- abandono del onboarding por pantalla.

### Métricas útiles

- aceptación del preset recomendado;
- porcentaje de usuarios que entienden el flujo sin ayuda humana;
- reducción de documentos que caen a review por falta de cuenta;
- cuántos usuarios eligen mínimo + temporales;
- qué `?` se abren más.

---

## Etapa 17 — Rollout seguro

### Fase 1

Sólo nuevas organizaciones internas / piloto.

### Fase 2

Rontil + pruebas con contador.

### Fase 3

Nuevas organizaciones productivas.

### Fase 4

Edición posterior de perfil para clientes existentes.

---

## Presets iniciales recomendados para arrancar

No construir 50 presets. Construir pocos y buenos.

### Base

- `UY_BASE_SA_GENERAL_V1`

### Actividad

- comercio mayorista de equipos / maquinaria / repuestos;
- servicios técnicos / reparación / instalación;
- retail / minorista;
- agro / agroindustrial;
- fabricación/ensamble liviano.

### Traits

- importador;
- exportador;
- operaciones mixtas gravadas/no gravadas;
- multi-moneda;
- contratos recurrentes;
- licitaciones / organismos públicos.

---

## Ejemplo objetivo para Rontil

**No hardcodear** un preset “RONTIL”.

Construirlo como composición.

### Ejemplo inicial probable

- base: `UY_BASE_SA_GENERAL_V1`
- actividad principal: comercio mayorista de equipos / repuestos
- actividad secundaria: reparación / instalación / mantenimiento
- traits:
  - `imports_goods`
  - `sells_goods`
  - `provides_services`
  - `maintains_inventory`
  - `technical_installation_or_maintenance`
  - `multi_currency_operations`
  - si aplica: `mixed_vat_operations`

### Resultado esperado

Plan recomendado tipo:

**Comercio + Servicios técnicos + Importador + Multi-moneda**

---

## Reglas de oro para Codex

1. No llamar servicios oficiales en runtime para este flujo.
2. No convertir texto libre en verdad única.
3. No usar IA como juez final de composición.
4. No bloquear onboarding si falta decisión contable perfecta.
5. No escribir copy críptica.
6. No esconder alertas graves únicamente detrás de `?`.
7. No reescribir históricos al cambiar perfil.
8. No inventar un “plan oficial del MEF”.
9. No romper el pipeline mínimo con `starter accounts` y `TEMP-*`.
10. Todo lo que cambie el comportamiento del sistema debe poder explicarse con palabras humanas.

---

## Checklist final de aceptación funcional

### Onboarding

- [ ] Se puede seleccionar actividad principal CIIU.
- [ ] Se pueden agregar actividades secundarias.
- [ ] Se pueden marcar rasgos operativos/fiscales.
- [ ] Se puede escribir una descripción corta opcional.
- [ ] El sistema recomienda un plan compuesto.
- [ ] El sistema ofrece alternativas.
- [ ] El sistema permite importar plan externo.
- [ ] El sistema permite empezar con mínimo + temporales.

### UX explicativa

- [ ] Cada campo importante tiene `?`.
- [ ] Cada `?` explica qué es, por qué importa, impacto y acción posible.
- [ ] La recomendación de plan tiene explicación visible.
- [ ] Las alertas importantes tienen chip visible + `?` explicativo.

### Técnico

- [ ] El perfil de negocio queda versionado.
- [ ] La aplicación de presets queda persistida.
- [ ] El plan se puede reaplicar hacia adelante sin romper históricos.
- [ ] El pipeline documental sigue funcionando con plan mínimo + temporales.

---

## Fuentes oficiales verificadas para diseñar esta feature

Usar estas fuentes como ancla conceptual y documental al implementar:

- DGI — CIIU Rev. 4: https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/codificacion-actividades-economicas-ciiu
- INE — Vulcano: https://www3.ine.gub.uy/sistemas/hvulcano.aspx
- Formulario 0351: https://www.gub.uy/tramites/sites/catalogo-tramites/files/requirements/2025-06/Formulario%2B0351%2BV05.pdf
- MEF — Normas contables adecuadas: https://www.gub.uy/ministerio-economia-finanzas/politicas-y-gestion/normas-contables-adecuadas-publicadas-segun-reglamentacion
- Datos Abiertos — Localidades del Uruguay: https://catalogodatos.gub.uy/dataset/ide-localidades-del-uruguay
- Datos Abiertos — Direcciones Geográficas del Uruguay: https://catalogodatos.gub.uy/dataset/ide-direcciones-geograficas-del-uruguay
- DGI — Operaciones en moneda extranjera: https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/operaciones-moneda-extranjera
- DGI / Sigma / Formulario 2178 — IVA compras directo, indirecto y anticipo/importación: https://www.gub.uy/direccion-general-impositiva/sites/direccion-general-impositiva/files/documentos/publicaciones/Formularios_incluidos_aplicacion_sigma.pdf
- DGI — Operaciones gravadas y no gravadas / prorrata: https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/puede-contribuyente-deducir-totalidad-del-iva-compras-realiza-vez
- DGI — IVA en suspenso: https://www.gub.uy/direccion-general-impositiva/comunicacion/publicaciones/son-caracteristicas-del-regimen-iva-suspenso

---

## Nota final para Codex

La meta no es “poner más formularios”.

La meta es que el usuario sienta esto:

- “el sistema entendió qué tipo de empresa soy”; 
- “me recomendó algo razonable”; 
- “me explicó por qué”; 
- “no me está obligando a migrar mi contabilidad entera hoy”; 
- “si no sé qué elegir, igual puedo empezar”; 
- “si soy contador, veo que acá hubo estudio serio y no chamuyo con IA.”

Si el resultado final se siente como otro ERP mudo y opaco, el trabajo está mal aunque compile perfecto.
