# Testing, rollout y roadmap tecnico

## Scripts de calidad

Definidos en `package.json`:

- `npm run dev`
- `npm run inngest:dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run db:generate:migration`
- `npm run db:verify:parity`
- `npm run db:smoke:profile-sync`
- `npm run db:smoke:organization-onboarding`
- `npm run db:smoke:private-dashboard`
- `npm run db:smoke:document-upload`

## Cobertura de pruebas por dominio

### Auth y organizations

- signup/login
- activity search
- identity y RPC guardrails
- preset apply service
- preset recommendation explanations
- preset AI recommendation

### Documents y workflow

- upload
- intake contract
- Inngest pipeline
- review schema compat
- workflow state

### Accounting

- bootstrap
- accounting domain
- suggestions
- imports
- exports
- open items
- transaction family resolution

### Tax

- VAT engine
- VAT preview
- VAT schema compat
- DGI reconciliation
- location risk

### Spreadsheets e imports

- spreadsheets
- spreadsheet schema compat
- import operations

## Estrategia de rollout actual

- feature flags para onboarding/presets/help hints/VAT;
- service-only helpers para dominios sensibles;
- validaciones duras de input hash y pertenencia antes de aplicar resultados IA;
- fallback deterministico cuando OpenAI no esta disponible.

## Estado por fase del rector

### Fase 1: separacion documental

Estado: parcial alto

Hecho:

- review separada de extraccion;
- posting provisional/final;
- preview contable y fiscal;
- reopen sin rerun IA;
- assignment runs.

Falta:

- cola UI dedicada de pendientes de asignacion;
- mas operacion masiva.

### Fase 2: onboarding y presets modulares

Estado: implementado alto

Hecho:

- actividad principal/secundaria;
- traits;
- recommendation engine;
- settings integrados;
- IA hibrida sobre presets;
- importacion de plan externo.

### Fase 3: cost centers, jobs y margen

Estado: preparado

Hecho:

- borradores IA de centros de costo;
- algunos hooks de exports.

Falta:

- entidades reales;
- asignacion documental;
- reporting de margen.

### Fase 4: VAT integral y DGI

Estado: implementado parcial/alto

Hecho:

- VAT engine;
- preview y definitivo;
- exports;
- diferencias DGI base.

Falta:

- mas cobertura de edge cases;
- integracion externa mas profunda.

### Fase 5 en adelante

Estado: preparado

- multimoneda completa;
- importaciones profundas;
- otros impuestos;
- export bridge mas amplio.

## Regla de documentacion y calidad

Un modulo solo se considera "implementado" en docs cuando existen al menos estas tres cosas:

1. codigo del dominio;
2. persistencia o contrato real;
3. una superficie visible o una prueba que lo haga operativo.

Si falta alguna de las tres, debe documentarse como `parcial` o `preparado`.
