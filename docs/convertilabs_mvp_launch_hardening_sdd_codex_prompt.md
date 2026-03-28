# Convertilabs — Spec SDD de hardening para lanzamiento del MVP

**Status:** Draft v1.0  
**Fecha:** 2026-03-28  
**Modo de trabajo:** Specs-Driven Development  
**Repositorio base:** `josemaria1988/convertilabs`  
**Objetivo:** llevar el repo actual a un estado apto para **beta privada cobrable** en Uruguay, con comportamiento contable/fiscal conservador, trazable y operable.

---

## 0. Prompt operativo para Codex

Trabaja **sobre el código real actual del repo**, no sobre documentación vieja. Implementa las tareas en el orden indicado.

### Reglas obligatorias de ejecución

1. **No inventes comportamiento contable/fiscal.** Si falta un dato clave, bloquea, degrada a revisión manual o deja el documento en modo asistido.
2. **La opción correcta para MVP es conservadora, no “mágica”.** Es preferible bloquear una automatización dudosa antes que postear algo fiscalmente incorrecto.
3. **No fabriques métricas ni tendencias.** Si no hay historia real, la UI debe mostrar un empty state honesto.
4. **No rompas backward compatibility de la base sin necesidad.** Si agregas schema, actualiza SQL canónico y migraciones de Supabase, y deja la paridad en verde.
5. **No dejes lógica de negocio dispersa en UI.** La verdad operativa debe vivir en módulos de dominio.
6. **No cierres una tarea sin tests o smoke checks.**
7. **No expandas alcance comercial.** El objetivo no es abrir self-serve total; es dejar el producto listo para una beta privada seria.
8. **Cuando haya ambigüedad, documenta la decisión en el PR y elige el criterio más seguro para Uruguay.**

### Resultado esperado del trabajo de Codex

Al terminar, el repo debe tener:
- integridad monetaria básica consistente entre journals y open items,
- una máquina de estado operativa canónica para documentos,
- dashboard sin datos sintéticos,
- alcance de automatización explícito y visible,
- importaciones degradadas a modo asistido cuando haya ambigüedad,
- health/readiness más honestos,
- un gate operativo de piloto utilizable.

---

## 1. Hechos observados hoy en el repo

Estos hechos salen del código actual y deben tomarse como punto de partida:

1. `modules/accounting/open-items.ts` hoy fija `fxRate = 1` dentro de `syncApprovedDocumentOpenItems` y arma `functional_amount` con ese valor, aun cuando la moneda del documento pueda diferir de la funcional.
2. Ese mismo flujo de open items busca open items abiertos por contraparte, pero **no filtra por moneda** antes de aplicar recibos/notas de crédito/pagos contra saldos existentes.
3. `modules/accounting/journal-builder.ts` sí maneja `fxRate`, `functionalCurrencyCode`, `fxRateSource` y calcula débitos/créditos funcionales con esa tasa.
4. `modules/documents/status.ts` todavía expone estados legacy (`uploaded`, `draft_ready`, `classified`, `approved`, etc.).
5. `modules/documents/review.ts` ya combina `status`, `posting_status` y validaciones derivadas; además expone `canPostProvisional` y `canConfirmFinal`, y mantiene compatibilidad con selectores `STEP5` y `LEGACY`.
6. `app/app/o/[slug]/dashboard/page.tsx` construye `chartRows` con labels `M001`…`M005` a partir de contadores actuales. Eso es dato sintético, no historial real.
7. `modules/organizations/onboarding-schema.ts` acepta `UNIPERSONAL` e `IRAE_LITERAL_E`, mientras `modules/tax/uy-vat-profile.ts` define automatización VAT solo para `SA`, `SRL`, `SAS`.
8. `modules/imports/intake.ts` sigue usando heurísticas/warnings por keywords (`zona franca`, `suspenso`, `reliquid`, `exoner`, etc.) y detecta `broker_invoice` / `local_related_service` como gasto local relacionado.
9. `app/api/health/route.ts` hoy es un endpoint de config/liveness; no hace readiness real contra dependencias.
10. `modules/tax/dgi-reconciliation.ts` arma buckets del sistema (`sales_basic`, `sales_minimum`, etc.) a partir del dataset VAT y los compara contra una baseline; eso es útil, pero es una conciliación base, no filing ni matching exhaustivo.
11. `modules/evals/rontil-pilot.ts` ya define el resumen/gate de readiness del piloto (`pilotReady`) con cobertura, clasificación, blocking, IVA y tiempo medio de revisión.

---

## 2. Decisiones rectoras de producto para esta tanda

### 2.1 Tipo de lanzamiento objetivo

El objetivo de esta tanda es **beta privada controlada**, no apertura pública self-serve irrestricta.

### 2.2 Alcance automático conservador para MVP

Solo puede considerarse **automático** un flujo que cumpla simultáneamente:
- organización Uruguay,
- forma jurídica `SA`, `SRL` o `SAS`,
- `taxRegimeCode = IRAE_GENERAL`,
- `vatRegime = GENERAL`,
- documento local estándar de compra o venta,
- sin duplicado no resuelto,
- sin warnings de importación/aduana,
- con moneda igual a la funcional o con snapshot FX persistido y confiable,
- sin necesidad de settlement cross-currency.

### 2.3 Modo asistido

Todo lo que quede fuera del perímetro anterior debe pasar a **modo asistido**. Modo asistido significa:
- se puede extraer,
- se puede revisar,
- se puede sugerir,
- se puede hacer preview,
- se puede guardar trazabilidad,
- **pero no se debe auto-finalizar ni auto-postear como si el caso estuviera plenamente soportado**.

### 2.4 Modo bloqueado

Se bloquea automatización y/o confirmación final si ocurre cualquiera de estos casos:
- FX faltante en documento con moneda extranjera,
- intento de settlement contra open items de otra moneda,
- duplicado no resuelto,
- importación con warning relevante,
- documento sin identidad mínima o sin importes confiables,
- scope fiscal fuera del perímetro automático.

---

## 3. Objetivos concretos de implementación

1. **Corregir integridad monetaria** entre journals, open items y settlement links.
2. **Unificar la verdad operativa del documento** mediante un estado canónico derivado.
3. **Eliminar métricas sintéticas** del dashboard.
4. **Expresar el alcance real de automatización** en el producto, no solo en la cabeza del fundador.
5. **Degradar importaciones ambiguas a asistidas** con bloqueos explícitos.
6. **Ajustar naming/product truth de conciliación DGI** para no sobreprometer.
7. **Separar liveness de readiness** para operaciones.
8. **Hacer utilizable el gate de piloto** antes de abrir más clientes.

---

## 4. No objetivos de esta tanda

No hacer ahora, salvo que sea estrictamente necesario para cerrar una dependencia técnica:
- payroll / BPS,
- filing directo con DGI,
- conciliación bancaria,
- multi-country,
- motor completo de IRAE/IP,
- importaciones complejas con capitalización profunda,
- permisos multiusuario finos de estudio contable,
- aprendizaje automático silencioso,
- write-back ERP genérico profundo.

---

## 5. Matriz operativa deseada

| Escenario | Modo deseado | Acción permitida |
|---|---|---|
| Compra/venta local estándar en alcance automático | Automático | review, provisional, final, VAT preview/run/export |
| Documento en moneda extranjera con FX snapshot válido | Automático con trazabilidad FX | review, provisional, final |
| Documento en moneda extranjera sin FX snapshot válido | Bloqueado | review sí, posting final no |
| Settlement contra open items de distinta moneda | Bloqueado | resolución manual |
| Importación estándar sin warnings críticos | Asistido | preview/provisional sí, final manual explícito |
| Importación con warning (`zona franca`, `suspenso`, etc.) | Bloqueado/Asistido duro | no auto-final |
| Organización fuera de perímetro automático | Asistido | onboarding sí, automatización final no |
| Duplicado no resuelto | Bloqueado | no confirmación final |

---

## 6. TASK-01 — Integridad monetaria en open items y settlements

**Objetivo**  
Eliminar la inconsistencia actual entre journals y open items en multimoneda, y evitar settlement incorrecto entre documentos de distintas monedas.

### Problema actual

- `syncApprovedDocumentOpenItems` fija `fxRate = 1` por defecto.
- La búsqueda de open items abiertos no filtra por `currency_code`.
- El journal builder ya calcula importes funcionales con `fxRate`, por lo que hoy puede existir una divergencia entre asiento y open item.

### Cambios requeridos

#### 6.1 Fuente de verdad monetaria para open items
Crear una función de dominio explícita, por ejemplo:
- `resolveOpenItemMonetaryContext(...)`

Debe resolver, en este orden de precedencia:
1. snapshot monetario persistido del journal suggestion confirmado / posting confirmado,
2. snapshot monetario persistido en draft actual si está validado,
3. misma moneda que funcional => `fxRate = 1`, `fxRateSource = "same_currency"`,
4. si la moneda es distinta y no hay snapshot confiable => **bloquear auto-sync de open items**.

#### 6.2 No permitir `fxRate = 1` para moneda extranjera por default
Cambiar la regla actual:
- solo usar `1` cuando `currencyCode === functionalCurrencyCode`.
- si no, exigir `fxRate > 0` y snapshot persistido.

#### 6.3 Settlement por misma moneda solamente en MVP
Para esta fase, el auto-settlement solo puede correr cuando:
- el documento liquidador y el open item tengan la misma `currency_code`,
- el cálculo de importes esté en la misma moneda original.

Si hay settlement cross-currency:
- **no aplicar automáticamente**,
- registrar un blocker/flag explícito,
- dejar el caso para resolución manual futura.

#### 6.4 Cargar y usar `currency_code` en open items existentes
Actualizar `ExistingOpenItem` y la query correspondiente para incluir al menos:
- `currency_code`,
- opcionalmente `functional_currency_code`, `fx_rate` si la tabla ya lo soporta.

Luego, filtrar candidatos de settlement por la misma moneda del documento liquidador.

#### 6.5 Trazabilidad monetaria
Todo `ledger_open_item` creado o actualizado debe conservar trazabilidad suficiente:
- `currency_code`,
- `functional_currency_code`,
- `fx_rate`,
- `fx_rate_date`,
- `fx_rate_source`,
- `functional_amount` consistente con `original_amount * fx_rate`.

#### 6.6 Tolerancia numérica
La consistencia entre journal y open item debe respetar tolerancia máxima de `0.01` en importes funcionales.

### Archivos / módulos probables

- `modules/accounting/open-items.ts`
- `modules/accounting/journal-builder.ts`
- `modules/accounting/types.ts` si hace falta ampliar tipos
- cualquier mapper que persista/recupere snapshot monetario
- tests de accounting/open items

### Done cuando

- Un documento en USD/EUR ya no genera open items funcionales con `fxRate = 1` salvo misma moneda funcional.
- Recibos/notas de crédito/pagos no se aplican automáticamente a open items de otra moneda.
- Los open items y settlement links quedan alineados con la monetización de journal suggestion/posting.
- Si falta FX confiable, el sistema bloquea y explica; no inventa.

### Pruebas mínimas

1. Factura en UYU con misma moneda funcional.
2. Factura en USD con `fxRate` válido persistido.
3. Factura en USD sin `fxRate` persistido => blocker.
4. Recibo en UYU frente a open item en USD => no auto-settlement.
5. Nota de crédito en USD contra factura USD => settlement correcto.
6. Assert de consistencia entre `functional_amount` de open item y totales funcionales del journal.

---

## 7. TASK-02 — Estado canónico de workflow documental

**Objetivo**  
Eliminar la doble/triple verdad entre `status`, `posting_status`, validaciones derivadas y señales de UI.

### Problema actual

- `status.ts` todavía trabaja con estados legacy.
- `review.ts` ya usa `posting_status` y validaciones más ricas.
- La UI puede dar sensación de “done” aunque el documento no esté realmente listo para final.

### Decisión de diseño

Mantener columnas legacy por compatibilidad, pero introducir un **estado canónico derivado** como única fuente de verdad operativa para la app.

### Cambios requeridos

#### 7.1 Crear módulo de estado canónico
Crear algo como:
- `modules/documents/workflow-state.ts`

Debe exponer:
- tipo `CanonicalDocumentState`,
- tipo `DocumentOperationalBucket`,
- función `deriveCanonicalDocumentState(...)`,
- función `deriveDocumentActionPermissions(...)`.

#### 7.2 Estados canónicos sugeridos
Ajustar si el código lo exige, pero mantener semántica clara:
- `processing`
- `needs_review`
- `blocked_duplicate`
- `blocked_scope`
- `blocked_missing_fx`
- `ready_provisional`
- `posted_provisional_pending_final`
- `ready_final`
- `posted_final`
- `archived`
- `error`

#### 7.3 Buckets operativos para UI/listados
Derivar buckets simples para operación diaria:
- `processing`
- `review`
- `blocked`
- `ready_to_post`
- `done`

#### 7.4 Consumidores obligatorios del nuevo estado
Migrar para que lean el estado canónico:
- `modules/documents/status.ts`
- `modules/documents/review.ts`
- listados/workspace de documentos
- dashboard
- filtros y contadores visibles

#### 7.5 Compatibilidad
No eliminar de golpe `status` o `posting_status` de base.  
Usarlos como inputs del adaptador canónico, no como verdad final de UI.

#### 7.6 Acciones derivadas
`canPostProvisional`, `canConfirmFinal`, `canConfirm`, `canReopen` y similares deben salir del módulo canónico, no de lógica repartida.

### Archivos / módulos probables

- `modules/documents/workflow-state.ts` (nuevo)
- `modules/documents/status.ts`
- `modules/documents/review.ts`
- componentes de workspace/document review/dashboard

### Done cuando

- Todos los listados y badges visibles usan el estado canónico.
- Un documento no aparece como “done” si en realidad está provisional o bloqueado.
- Las acciones disponibles en UI coinciden con la máquina de estado.

### Pruebas mínimas

1. Documento `draft_ready` + no listo para final => bucket correcto.
2. Documento `approved` pero `posting_status = posted_provisional` => no mostrar como finalizado.
3. Documento con duplicado no resuelto => bucket `blocked`.
4. Documento con FX faltante => bucket `blocked`.
5. Documento final posteado => `posted_final` + bucket `done`.

---

## 8. TASK-03 — Cola operativa mínima reutilizando el workspace existente

**Objetivo**  
Dar una superficie operativa real sin construir un módulo nuevo gigantesco.

### Decisión

No crear una “super bandeja” nueva desde cero en esta tanda. Reutilizar la superficie actual de workspace/listado, pero con filtros y contadores derivados del estado canónico.

### Cambios requeridos

Agregar filtros/badges al workspace actual para al menos:
- `processing`
- `review`
- `blocked_duplicate`
- `blocked_missing_fx`
- `blocked_scope`
- `imports_assisted`
- `ready_provisional`
- `ready_final`
- `posted_final`

Agregar también indicadores visibles en fila/tarjeta cuando aplique:
- `Duplicado`
- `FX faltante`
- `Fuera de alcance automático`
- `Importación asistida`

### Done cuando

- Un operador puede saber rápidamente qué documentos están trabados y por qué.
- El workspace deja de depender de leer estados legacy a ojo.

### Pruebas mínimas

- Smoke manual: una organización con mezcla de locales, importaciones, duplicados y moneda extranjera muestra filtros coherentes.

---

## 9. TASK-04 — Dashboard sin métricas sintéticas

**Objetivo**  
Eliminar la falsa sensación de “analítica histórica” cuando no existe historial real.

### Problema actual

`app/app/o/[slug]/dashboard/page.tsx` genera `chartRows` con `M001..M005` a partir de contadores actuales. Eso es placeholder engañoso.

### Cambios requeridos

#### 9.1 Prohibición explícita
No puede quedar en producción ninguna gráfica temporal basada en datos inventados.

#### 9.2 Implementación deseada
Elegir una de estas dos opciones:

**Opción preferida**  
Construir historial real usando fuentes existentes (`vat_runs`, documentos por período, u otra fuente persistida real).

**Opción aceptable para esta tanda**  
Eliminar la tendencia y reemplazarla por un estado honesto:
- “Todavía no hay historial suficiente para mostrar tendencia real.”

#### 9.3 Contadores
Alinear los contadores del dashboard con los buckets canónicos:
- processing,
- review,
- blocked,
- ready_to_post,
- done.

### Archivos / módulos probables

- `app/app/o/[slug]/dashboard/page.tsx`
- componentes dashboard asociados
- cualquier helper de métricas

### Done cuando

- No existen labels `M001..M005` ni series inventadas.
- Toda métrica visible proviene de datos persistidos reales o se reemplaza por empty state honesto.

### Pruebas mínimas

1. Organización sin historial => mensaje honesto.
2. Organización con historial real => gráfica/serie real.
3. Contadores de dashboard coinciden con el workspace filtrado por buckets canónicos.

---

## 10. TASK-05 — Scope engine explícito para automatización del MVP

**Objetivo**  
Hacer visible en producto qué cae en modo automático y qué cae en modo asistido.

### Problema actual

El onboarding y los enums aceptan un abanico más amplio que el perímetro automático conservador del MVP. Eso genera expectativa peligrosa.

### Decisión de diseño

Agregar un motor de alcance explícito, por ejemplo:
- `modules/launch/scope.ts`

Debe devolver algo como:
- `supportLevel: "automatic" | "assisted_only" | "blocked"`
- `reasons: string[]`
- `allowedActions`

### Cambios requeridos

#### 10.1 Reglas mínimas del scope conservador
Por defecto:
- `automatic` solo para `UY + (SA|SRL|SAS) + IRAE_GENERAL + GENERAL + flujo local estándar`.
- `assisted_only` para cualquier combinación fuera de eso pero aún utilizable.
- `blocked` cuando faltan datos mínimos o el riesgo operativo es demasiado alto.

#### 10.2 Persistencia / exposición
Persistir o derivar este scope de forma accesible para UI. Si no quieres schema nuevo, puedes exponerlo como cálculo derivado desde organization profile + document context, pero debe ser reutilizable en toda la app.

#### 10.3 Onboarding
El onboarding debe informar claramente:
- si la organización entra en modo automático,
- si entra en modo asistido,
- por qué.

No ocultar esto detrás de copy ambiguo.

#### 10.4 Efecto en el producto
Si `supportLevel !== automatic`:
- permitir extracción/review,
- permitir preview,
- permitir trabajo asistido,
- **bloquear auto-finalización/posting final automático**.

#### 10.5 Copy visible
Agregar copy simple y honesto en superficies clave:
- onboarding completion,
- dashboard o tax hub,
- pantalla de review cuando aplique.

Ejemplos de etiqueta:
- `Modo automático`
- `Modo asistido`
- `Finalización automática no disponible para este perfil`

### Archivos / módulos probables

- `modules/launch/scope.ts` (nuevo)
- `modules/organizations/onboarding-schema.ts`
- pantallas de onboarding
- review / tax / dashboard
- posiblemente acciones de posting/finalización

### Done cuando

- La organización sabe desde el onboarding en qué modo quedó.
- El sistema deja de actuar como si todos los perfiles fiscales fueran equivalentes.
- Los casos fuera de scope no se auto-finalizan silenciosamente.

### Pruebas mínimas

1. `SA + IRAE_GENERAL + GENERAL` => automático.
2. `UNIPERSONAL + IRAE_LITERAL_E` => asistido o bloqueado según regla definida.
3. Organización fuera de scope no puede auto-finalizar período/documento.
4. La UI muestra el motivo del modo asistido.

---

## 11. TASK-06 — Importaciones: degradación formal a modo asistido

**Objetivo**  
Evitar que la heurística actual de importaciones se venda o se comporte como automatización madura.

### Problema actual

`modules/imports/intake.ts` detecta DUA y clasifica tributos/gastos locales con heurística textual. Eso sirve para asistencia, no para confianza ciega.

### Cambios requeridos

#### 11.1 Política explícita de revisión de importaciones
Crear una política central, por ejemplo:
- `modules/imports/review-policy.ts`

Debe clasificar cada caso como:
- `assisted_ok`
- `manual_required`
- `blocked`

#### 11.2 Reglas mínimas
Como mínimo, deben forzar revisión manual:
- warnings por `zona franca`, `suspenso`, `reliquid`, `exoner`, `parcial`,
- `documentKind` ambiguo,
- `broker_invoice` o `local_related_service` cuando cambien el tratamiento económico,
- falta de DUA/reference code confiable cuando el flujo lo exija,
- inconsistencia de moneda o fechas.

#### 11.3 Integración con estado canónico
Importaciones ambiguas deben caer en bucket `blocked` o `review` con badge `Importación asistida`, nunca en `ready_final` automático.

#### 11.4 Posting
Para esta tanda:
- importaciones pueden llegar a preview/provisional,
- **no deben auto-finalizarse** si el review policy no es verde.

### Archivos / módulos probables

- `modules/imports/intake.ts`
- `modules/imports/review-policy.ts` (nuevo)
- review / workflow-state / UI badges

### Done cuando

- Toda importación queda claramente marcada como asistida o bloqueada.
- No existe “final automático” para importaciones ambiguas.

### Pruebas mínimas

1. DUA estándar sin warnings => asistido_ok.
2. Documento con `zona franca` => manual_required o blocked.
3. `broker_invoice` => no auto-final.
4. Importación con datos incompletos => blocker visible.

---

## 12. TASK-07 — Conciliación DGI: honestidad de alcance

**Objetivo**  
Alinear naming y UX con lo que el motor actual realmente hace.

### Problema actual

La lógica actual bucketiza el dataset del sistema y lo compara con una baseline DGI. Es útil, pero llamarlo genéricamente “conciliación DGI” puede sobreprometer si no se explica el alcance.

### Cambios requeridos

#### 12.1 Naming user-facing
Cambiar labels visibles a algo del estilo:
- `Conciliación DGI base`
- `Comparación base por buckets`

No es necesario renombrar internamente módulos/archivos en esta tanda.

#### 12.2 Mensaje visible
La UI debe aclarar que:
- compara buckets del sistema contra una baseline/importación,
- no equivale a filing directo,
- no reemplaza revisión contable/fiscal final.

#### 12.3 Metadata opcional
Si ayuda, agregar `scopeLabel = "base"` o equivalente a los view models.

### Archivos / módulos probables

- vistas de tax / dgi reconciliation
- `modules/tax/dgi-reconciliation.ts` solo si hace falta exponer metadata

### Done cuando

- El usuario no puede interpretar la funcionalidad como filing o conciliación exhaustiva cuando no lo es.

### Pruebas mínimas

- Revisión manual de copy y labels en todas las superficies donde aparece esta funcionalidad.

---

## 13. TASK-08 — Separar liveness de readiness

**Objetivo**  
Tener endpoints operativos honestos y útiles.

### Problema actual

`/api/health` hoy devuelve básicamente estado de configuración de Supabase/OpenAI/Inngest. Eso sirve como liveness/config, no como readiness real.

### Cambios requeridos

#### 13.1 Mantener un endpoint barato de liveness/config
`/api/health` puede seguir existiendo como chequeo liviano.  
Debe indicar claramente que es `mode: "liveness"` o `kind: "config"`.

#### 13.2 Agregar readiness real
Crear uno de estos dos caminos:
- `/api/ready`
- o `/api/health?mode=ready`

Debe verificar al menos:
- conectividad a DB / Supabase con una consulta barata,
- disponibilidad mínima de dependencias críticas internas,
- versión/build timestamp si ya existe.

#### 13.3 No hacer pings costosos en cada health
No golpear OpenAI ni Inngest en cada request de readiness.  
Para esos servicios, devolver:
- `configured`,
- `lastVerifiedAt` si existe trazabilidad previa,
- o `verification: "not_performed"`.

#### 13.4 Semántica de respuesta
La respuesta debe distinguir con claridad:
- `liveness ok`,
- `readiness degraded`,
- `readiness failed`.

### Archivos / módulos probables

- `app/api/health/route.ts`
- nuevo endpoint si corresponde
- `lib/env.ts`
- helpers de readiness/ops

### Done cuando

- Operaciones puede diferenciar “app prendida” de “app lista para servir”.
- El endpoint no da falso verde cuando falta DB real.

### Pruebas mínimas

1. Health liviano responde sin depender de DB.
2. Readiness falla si la dependencia crítica no responde.
3. OpenAI/Inngest no generan costos innecesarios por health checks.

---

## 14. TASK-09 — Gate de piloto utilizable

**Objetivo**  
Volver operable el `rontil-pilot` como criterio de apertura controlada.

### Problema actual

El módulo existe, pero no necesariamente está integrado en un flujo práctico para validar readiness antes de abrir más clientes.

### Cambios requeridos

#### 14.1 Script/flujo operativo
Agregar un script o comando claro, por ejemplo:
- `npm run pilot:summary -- path/to/results.json`
- o equivalente dentro del runner existente.

Debe:
- leer resultados por escenario,
- usar `buildRontilPilotSummary(...)`,
- emitir un resumen legible,
- devolver exit code no-cero si no se alcanza el gate.

#### 14.2 Fixtures y formato
Definir formato JSON esperado de resultados por escenario.  
No inventar un fixture “verde” como si fuera evidencia real. Si agregas sample, etiquetarlo como sample/demo.

#### 14.3 Integración mínima
Dejar claro en docs/README interno cómo correr el gate antes de sumar una organización nueva al piloto.

### Archivos / módulos probables

- `modules/evals/rontil-pilot.ts`
- `scripts/` o `tests/` para el ejecutor
- `package.json` para script npm
- doc breve de operación

### Done cuando

- Existe una forma repetible de evaluar readiness del piloto.
- El equipo puede correr el gate sin leer código a mano.

### Pruebas mínimas

1. Script con archivo sample válido.
2. Exit code falla si coverage o rates quedan debajo de threshold.
3. Output muestra escenarios faltantes y métricas principales.

---

## 15. TASK-10 — Actualizar docs vivas mínimas después del código

**Objetivo**  
Cerrar el gap entre producto real y relato operativo, pero recién después del hardening técnico.

### Cambios requeridos

Actualizar solo lo imprescindible para que no quede documentación engañosa:
- README con alcance actual honesto,
- una nota corta de “beta privada / alcance automático vs asistido”,
- cómo correr readiness y pilot gate.

### Done cuando

- La documentación mínima no contradice el comportamiento real del código.

---

## 16. Checklist de validación final obligatoria

Antes de cerrar esta tanda, Codex debe dejar verificable:

### Calidad técnica
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run db:verify:parity` si hubo cambios de schema
- [ ] smoke scripts relevantes si no se rompen por entorno

### Validación funcional
- [ ] documento local UYU automático llega a final sin desviaciones
- [ ] documento moneda extranjera sin FX confiable queda bloqueado
- [ ] settlement cross-currency no se autoaplica
- [ ] dashboard no muestra tendencias sintéticas
- [ ] organización fuera de scope automático entra en modo asistido visible
- [ ] importación con warnings no puede auto-finalizar
- [ ] conciliación DGI muestra naming honesto
- [ ] readiness real distingue liveness de dependencias
- [ ] pilot gate se puede ejecutar con un comando claro

### Validación de verdad de producto
- [ ] el sistema no aparenta cubrir más de lo que realmente cubre
- [ ] no hay automatización silenciosa en casos fiscalmente dudosos
- [ ] los bloqueos explican por qué el caso no sigue automáticamente

---

## 17. Riesgos conocidos que quedan fuera de esta tanda

Aunque esta tanda salga bien, todavía quedarán temas para un batch posterior:
- reglas aprendidas con gobierno/pausa/métricas,
- conciliación DGI más profunda que buckets base,
- importaciones con capitalización completa y casuística aduanera avanzada,
- operación multiusuario más madura,
- observabilidad funcional más rica para soporte,
- adapters reales de export/import hacia destinos concretos.

No intentar colar estos frentes dentro de esta misma tanda salvo que aparezca una dependencia crítica real.

---

## 18. Criterio de cierre global

Esta tanda está realmente terminada solo si el repo queda apto para este mensaje comercial honesto:

> “Convertilabs ya puede operar una beta privada en Uruguay para procesamiento documental, revisión contable/fiscal asistida, IVA revisable y posting controlado, con límites explícitos para multimoneda, importaciones e incompatibilidades de alcance.”

Si al terminar todavía existe cualquiera de estas situaciones, la tanda **no** está cerrada:
- open items multimoneda incorrectos,
- settlement entre monedas distintas aplicado automáticamente,
- dashboard con historia inventada,
- organizaciones fuera de scope tratadas como automáticas,
- importaciones ambiguas finalizadas como si fueran seguras,
- health endpoint dando falso verde operacional.

---

## 19. Instrucción final a Codex

Implementa esta tanda completa como una secuencia de cambios pequeña pero seria.  
Prioriza exactitud contable/fiscal, honestidad del producto y operabilidad de beta privada sobre “feature breadth”.  
Si tienes que elegir entre automatizar más o bloquear mejor, **bloquea mejor**.
