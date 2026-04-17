# 00 - Core product and organization

## Para que existe este documento

Este documento resume la tesis del producto, el alcance operativo oficial, la organizacion multi-tenant y el mapa de superficies sobre el que corre Convertilabs.

Leelo si vas a tocar:

- alcance de producto;
- onboarding;
- auth y memberships;
- settings;
- business profile y presets;
- copy de alto nivel;
- nomenclatura de superficies;
- decisiones que cambian el perimetro de la beta privada.

## 1. Tesis del producto

Convertilabs no es un ERP, no es un sistema contable generalista y no es una UI manual de bookkeeping.

Convertilabs es:

> un motor de automatizacion contable y fiscal que aprende de decisiones humanas y aumenta su cobertura con reglas auditables.

La secuencia correcta del producto es:

1. recibir documentos o datasets operativos;
2. extraer hechos estructurados;
3. revisar lo factual;
4. resolver tratamiento contable;
5. resolver tratamiento fiscal;
6. postear con trazabilidad;
7. aprender de la intervencion humana;
8. automatizar mejor la proxima vez.

## 2. Alcance operativo oficial

La beta privada actual esta pensada para Uruguay y para un modo conservador de automatizacion.

### Entra en el perimetro activo

- intake documental binario;
- importacion asistida o auditada de planillas;
- revision factual;
- asignacion contable guiada;
- preview de impacto contable y fiscal;
- posting provisional y final;
- liquidacion IVA base y corrida fiscal;
- cierre mensual con guardrails;
- export bridge hacia sistemas externos;
- aprendizaje con reglas auditables;
- presets contables y perfil de negocio versionado.

### Queda fuera del perimetro core

- ERP full;
- bookkeeping manual libre como flujo principal;
- filing automatico completo a organismos;
- motor fiscal multi-pais;
- rentabilidad, jobs, centros de costo o margen como producto activo;
- dashboards decorativos o analitica sintetica sin historia real.

## 3. Motores oficiales del sistema

### 3.1 Motor documental

Responsable de intake, storage, extraccion, draft y workflow humano del documento.

Flujo:

```text
upload
-> storage
-> IA extraction
-> document draft
-> reviewer
```

### 3.2 Motor de decision contable

Responsable de transformar hechos en tratamiento contable, preview multi-linea, aprendizaje y posting.

Flujo:

```text
factual review
-> accounting context
-> rule engine
-> template + accounts by role
-> journal entry preview
-> posting
```

### 3.3 Motor fiscal

Responsable de evaluar elegibilidad IVA, correr periodos, conciliar y exportar.

Flujo:

```text
posted documents
-> VAT preview
-> VAT run
-> DGI reconciliation
-> export
```

## 4. Modos operativos oficiales

El sistema debe comportarse siempre en uno de estos tres modos:

### Automatico

El caso cae dentro del perimetro seguro, no tiene blockers y puede confirmarse con degradacion minima.

### Asistido

El caso es operable, pero requiere confirmacion humana o alguna decision contable o fiscal visible.

### Bloqueado

Falta un dato critico o el caso es inseguro. El sistema no debe inventar datos ni confirmar por si solo.

## 5. Auth, tenancy y organizacion

La plataforma es multi-tenant por organizacion.

Tablas base:

- `profiles`
- `organizations`
- `organization_members`

La organizacion se resuelve por slug y por membresia activa.

### Rutas publicas core

- `/login`
- `/signup`
- `/logout`
- `/auth/confirm`
- `/onboarding`
- `/app`

### Regla de entrada

- si el usuario no esta autenticado, entra por auth;
- si no tiene organizacion activa, va a onboarding;
- si ya esta operativo, resuelve organizacion primaria y aterriza en la app privada.

## 6. Roles observados hoy

El enum `member_role` y el uso real del producto incluyen:

- `owner`
- `admin`
- `admin_processing`
- `accountant`
- `reviewer`
- `operator`
- `developer`
- `viewer`

Lectura operativa:

- `owner` y `admin` concentran administracion y cambios sensibles;
- `admin_processing`, `accountant` y `reviewer` operan el flujo diario;
- `operator` entra en carriles acotados;
- `viewer` queda restringido a lectura;
- `developer` habilita soporte tecnico interno.

## 7. Onboarding, business profile y bootstrap

El onboarding captura:

- datos base de la organizacion;
- forma juridica y RUT;
- perfil fiscal base;
- perfil de negocio;
- seleccion o recomendacion de preset;
- modo inicial del plan contable.

Snapshots y tablas clave:

- `organization_profile_versions`
- `organization_business_profile_versions`
- `organization_business_profile_activities`
- `organization_business_profile_traits`
- `organization_preset_applications`
- `organization_preset_ai_runs`
- `organization_rule_snapshots`

### Modos de arranque vigentes

- `recommended`
- `alternative`
- `external_import`
- `minimal_temp_only`
- `hybrid_ai_recommended`

### Politica de historia

Los cambios de perfil, preset, reglas o fiscalidad operan hacia adelante. No reescriben historia cerrada.

## 8. Settings oficiales

La ruta canonica de settings es:

- `/app/o/[slug]/settings`

Tabs oficiales:

- `company`
- `fiscal`
- `business`
- `chart`
- `integrations`
- `advanced`

Sentido de cada tab:

- `company`: identidad, datos base y capacidades;
- `fiscal`: versionado del perfil fiscal;
- `business`: perfil de negocio, actividades y presets;
- `chart`: plan de cuentas, importacion y cuentas provisionales;
- `integrations`: conexiones y bridge;
- `advanced`: accesos expertos, reglas, mapa contable e importaciones de soporte.

## 9. Superficies y nombres oficiales

Lenguaje de producto recomendado:

- `Bandeja Documental`
- `Contabilidad`
- `Impuestos (IVA)`
- `Review documental` como accion contextual dentro de la bandeja, no como entrada primaria del menu;
- `Ajustes`
- `Auditoria`
- `Mapa contable`
- `Reglas contables`
- `Importaciones`
- `Exportaciones`

## 10. Rutas privadas activas

### Canonicas core

- `/app/o/[slug]/documents`
- `/app/o/[slug]/dashboard` redirige a `/app/o/[slug]/documents`
- `/app/o/[slug]/review` queda como superficie secundaria o legacy
- `/app/o/[slug]/tax`
- `/app/o/[slug]/settings`

### Superficies privadas activas

- `/app/o/[slug]/documents/[documentId]`
- `/app/o/[slug]/documents/pending-assignment`
- `/app/o/[slug]/audit`
- `/app/o/[slug]/imports`
- `/app/o/[slug]/exports`
- `/app/o/[slug]/close`
- `/app/o/[slug]/tax/reconciliation`
- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/rules`
- `/app/o/[slug]/rules/new`
- `/app/o/[slug]/rules/[ruleId]`
- `/app/o/[slug]/rules/[ruleId]/version`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`
- `/app/o/[slug]/advanced`

### Rutas cortas de compatibilidad

El repo soporta rutas cortas que resuelven la organizacion primaria y redirigen a la ruta privada por slug. Entre ellas:

- `/dashboard`
- `/documents`
- `/review`
- `/tax`
- `/settings`
- `/rules`
- `/advanced`
- `/close`
- `/trial-balance`
- `/journal-entries`
- `/open-items`

## 11. Estado del producto frente al rector

### Implementado y operativo

- auth, tenancy y onboarding base;
- perfil fiscal versionado;
- business profile y presets;
- bandeja documental y reviewer;
- reglas contables administrables;
- tax period workbench;
- cierre y read models contables;
- imports, audit y exports.

### Parcial o en consolidacion

- mobile-first homogeneo en todas las superficies expertas;
- explainability uniforme en todas las vistas;
- FX end-to-end mas maduro;
- hard close y snapshots mas profundos;
- bridge externo con adapters especificos.

### Preparado, no productizado

- cost centers, jobs y rentabilidad;
- mas impuestos;
- multi-country;
- filing automatico a organismos.
