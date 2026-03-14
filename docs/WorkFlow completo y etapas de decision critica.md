# WorkFlow completo y etapas de decision critica

## 1. Proposito de este documento

Este documento describe el funcionamiento actual implementado en el proyecto, desde el alta de un usuario nuevo hasta el uso operativo completo del sistema para lo que fue pensado: ingreso documental, clasificacion, revision, resolucion contable, impacto tributario, seguimiento de open items, importaciones y exportacion fiscal.

El foco no es describir una idea abstracta del producto, sino el flujo real que hoy existe en el repo. Por eso se detallan:

- Que hace cada etapa.
- Que decisiones toma el sistema de forma deterministica.
- Donde interviene la IA.
- Donde interviene el usuario.
- Que bloquea la confirmacion.
- Que cosas se aprenden y quedan reutilizables.
- Cuales son hoy las etapas de decision critica para resolver bien el problema de deterministica, asientos contables, procesamiento IA y decisiones posteriores.

## 2. Que problema intenta resolver el sistema

Convertilabs es un sistema orientado a Uruguay para procesar documentacion fiscal/contable de una organizacion y llevarla a un flujo operativo usable:

- recibir documentos reales en un bucket privado,
- extraer hechos estructurados,
- separar compra/venta/otro,
- detectar contraparte e identidad de factura,
- sugerir tratamiento IVA,
- sugerir asiento contable,
- permitir revision humana,
- aprender reglas reutilizables a partir de aprobaciones,
- construir open items,
- reconstruir VAT runs mensuales,
- soportar importaciones y planillas historicas,
- exportar datasets fiscales y formularios canonicos/DGI.

Dicho de otra forma: el producto no es solo OCR ni solo IA. Es un motor de decision documental + contable + fiscal + operativa posterior.

## 3. Dependencias operativas sin las cuales el flujo no funciona

Antes de entrar al flujo, hay cuatro dependencias estructurales:

### 3.1 Supabase

Supabase provee:

- Auth
- Postgres
- Storage
- RPCs de upload
- RLS / acceso multi-tenant

Sin schema al dia, el sistema puede romper aunque el codigo este correcto. Ya se vio en esta etapa con:

- enums incompletos,
- tablas faltantes,
- columnas faltantes,
- funciones RPC desalineadas.

### 3.2 OpenAI

OpenAI se usa en dos carriles distintos:

- IA de intake documental
- segunda IA contable para resolver casos donde la deterministica no alcanza

Si falta `OPENAI_API_KEY`, el intake y/o la segunda IA quedan imposibilitados o degradados.

### 3.3 Inngest

Inngest es el carril de background para procesamiento documental.

Sin Inngest correctamente sincronizado:

- el documento puede quedar en `queued`,
- el run no arranca,
- no hay ida a OpenAI,
- la UI parece "trancada" aunque la subida haya quedado bien.

### 3.4 Configuracion de URLs y correo

El alta de usuarios depende de:

- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `Site URL` de Supabase
- redirects permitidos en Supabase
- plantilla de email apuntando a `/auth/confirm`

Si esto esta mal:

- el mail de confirmacion lleva a `localhost`,
- el usuario no completa el alta,
- el onboarding productivo no empieza.

## 4. Mapa de alto nivel del sistema

El flujo real, resumido, es este:

```text
Usuario nuevo
  -> signup / confirmacion email
  -> login
  -> onboarding organizacion
  -> bootstrap de cuentas base
  -> perfil fiscal + snapshot de reglas
  -> upload documental
  -> cola Inngest
  -> IA documental OpenAI
  -> armonizacion deterministica
  -> draft de revision
  -> revision humana
  -> contexto contable y/o segunda IA
  -> sugerencia de journal + tratamiento IVA
  -> confirmacion
  -> aprendizaje de regla
  -> open items
  -> VAT run mensual
  -> exportacion fiscal
  -> iteracion continua con documentos e imports
```

## 5. Entidades principales del dominio

Las tablas mas importantes para entender el sistema son estas:

| Area | Tablas principales | Rol |
| --- | --- | --- |
| Auth/tenancy | `profiles`, `organizations`, `organization_members` | usuario, tenant y membresia |
| Perfil fiscal | `organization_profile_versions`, `organization_rule_snapshots` | versionado del perfil fiscal y snapshot de reglas usable por la IA y la logica |
| Documentos | `documents`, `document_processing_runs`, `document_drafts`, `document_draft_steps`, `document_confirmations`, `document_revisions` | ciclo de vida documental y de revision |
| Extraccion | `document_extractions`, `document_field_candidates`, `document_classification_candidates` | persistencia de datos intermedios/extraccion |
| Identidad/duplicados | `document_invoice_identities`, `document_relations` | identidad de factura y relaciones |
| Contabilidad | `chart_of_accounts`, `accounting_rules`, `accounting_suggestions`, `accounting_suggestion_lines`, `document_accounting_contexts`, `journal_entries`, `journal_entry_lines` | reglas, sugerencias y asiento |
| Contrapartes | `vendors`, `vendor_aliases`, `customers` | proveedor / cliente |
| Conceptos | `organization_concepts`, `organization_concept_aliases` | taxonomia reutilizable |
| Open items | `ledger_open_items`, `ledger_settlement_links` | cuentas a cobrar / pagar y cancelaciones |
| IVA | `tax_periods`, `vat_runs`, `tax_rules` | cierre periodico de IVA |
| Imports | `organization_spreadsheet_import_runs`, `organization_import_operations`, `organization_import_operation_documents`, `organization_import_operation_taxes` | planillas e importaciones |
| Export | `exports`, `vat_form_exports`, `organization_dgi_form_mappings` | artefactos y mapeo de salida |
| Auditoria IA | `ai_decision_logs`, `audit_log` | trazabilidad de decisiones |

## 6. Flujo end-to-end detallado

### 6.1 Alta de usuario nuevo

Entrada principal:

- `modules/auth/signup-service.ts`

Flujo:

1. El usuario completa nombre, email y password.
2. Se valida el input.
3. Se llama `supabase.auth.signUp(...)`.
4. Se manda `emailRedirectTo` a `/auth/confirm`.
5. Si Supabase crea session inmediata, el sistema redirige directo.
6. Si no, el usuario debe confirmar por email.

Importante:

- El signup no crea organizacion.
- Solo crea identidad de usuario.
- El destino post-auth depende de si el usuario ya tiene membresia en una organizacion.

### 6.2 Confirmacion de email

Entrada:

- `app/auth/confirm/route.ts`

Flujo:

1. Supabase redirige con `token_hash` y `type`.
2. El backend llama `verifyOtp`.
3. Se consulta si el usuario ya tiene organizacion primaria.
4. Si no tiene, se va a `/onboarding`.
5. Si tiene, se va a `/app/o/[slug]/dashboard`.

### 6.3 Login

Entradas:

- `modules/auth/login-service.ts`
- `modules/auth/server-auth.ts`

Flujo:

1. El usuario inicia sesion.
2. Se resuelve el `primaryOrganization`.
3. Si no tiene membresia, el destino es onboarding.
4. Si tiene tenant, entra a su dashboard.

La logica de redireccion post-auth esta centralizada en `resolvePostAuthDestination(...)`.

### 6.4 Onboarding de organizacion

Entrada:

- `app/onboarding/actions.ts`
- `modules/organizations/onboarding-schema.ts`

Datos obligatorios hoy:

- nombre
- forma juridica
- RUT
- regimen tributario
- regimen IVA
- grupo DGI
- estado CFE

Flujo:

1. Usuario autenticado sin tenant entra a onboarding.
2. Se valida el formulario.
3. Se ejecuta la RPC `create_organization_with_owner`.
4. Se crea `organizations` y `organization_members`.
5. Inmediatamente se ejecuta `ensureStarterAccountingSetup(...)`.
6. Se redirige al dashboard del tenant nuevo.

Punto critico:

Si el onboarding fiscal queda incompleto, el sistema puede permitir navegar, pero el procesamiento documental posterior se rompe al intentar materializar el perfil/snapshot fiscal.

### 6.5 Bootstrap inicial de cuentas contables

Entradas:

- `modules/accounting/starter-accounts.ts`
- `modules/accounting/repository.ts`
- `app/onboarding/actions.ts`

El sistema ya no depende de que una organizacion nueva tenga plan de cuentas cargado a mano desde cero para arrancar minimamente.

Se auto-sembran cuentas base:

- `SYS-AR` -> `accounts_receivable`
- `SYS-AP` -> `accounts_payable`
- `SYS-VAT-IN` -> `vat_input_creditable`
- `SYS-VAT-OUT` -> `vat_output_payable`
- `GEN-SALE` -> cuenta generica de revenue
- `GEN-EXP` -> cuenta generica de expense

Esto se hace:

- en onboarding,
- y tambien al cargar runtime contable si la organizacion esta vacia.

Consecuencia:

- una organizacion nueva ya puede llegar mas lejos en el flujo,
- pero sigue sin tener un plan de cuentas rico ni reglas de negocio finas.

### 6.6 Perfil fiscal y materializacion del snapshot de reglas

Entradas:

- `modules/organizations/rule-snapshots.ts`
- `modules/organizations/settings.ts`

Objetivo:

Construir una version materializada del contexto fiscal-contable de la organizacion para que:

- la logica deterministica tenga contexto,
- la IA documental tenga prompt contextual,
- la segunda IA tenga resumen fiscal,
- exista un snapshot versionado y trazable.

Flujo:

1. Se carga la organizacion.
2. Se busca `organization_profile_versions` activa.
3. Si no existe, se intenta bootstrappear desde `organizations`.
4. Si faltan datos fiscales, se corta el flujo.
5. Se cargan reglas contables activas.
6. Se crea o reutiliza `organization_rule_snapshots`.

Punto critico:

La organizacion no puede procesar documentos si faltan:

- `legal_entity_type`
- `tax_id`
- `tax_regime_code`
- `vat_regime`
- `dgi_group`
- `cfe_status`

### 6.7 Ingreso documental

Entradas:

- `components/documents/upload-dropzone.tsx`
- `app/app/o/[slug]/dashboard/actions.ts`
- RPCs `prepare_document_upload`, `complete_document_upload`, `fail_document_upload`

Flujo:

1. El usuario arrastra o selecciona PDF/JPG/PNG.
2. Se valida MIME y tamano.
3. Se llama `prepareDashboardDocumentUpload(...)`.
4. La RPC crea metadata documental en DB y devuelve bucket/path.
5. El archivo sube al bucket privado con signed upload URL.
6. Se llama `finalizeDashboardDocumentUpload(...)`.
7. La RPC marca el documento como subido.
8. Se llama `enqueueDocumentProcessing(...)`.
9. La UI empieza a poll de estado.

Importante:

- En upload el documento entra con `direction = unknown`.
- El upload no decide compra o venta.
- Solo deja el documento listo para background processing.

### 6.8 Encolado y arranque del procesamiento documental

Entrada:

- `modules/documents/processing.ts`

Flujo:

1. Se verifica `OPENAI_API_KEY`.
2. Se verifica que Inngest este usable.
3. Se materializa el snapshot de reglas.
4. Se crea `document_processing_run`.
5. Se emite evento `documents/process.requested`.

Si esto falla:

- el documento puede quedar en `error`,
- o quedarse en `queued` si el worker no toma el evento,
- o marcar fallo antes de OpenAI.

### 6.9 Worker Inngest y llamada a OpenAI para intake documental

Entradas:

- `modules/documents/inngest-function.ts`
- `app/api/inngest/route.ts`
- `lib/llm/openai-responses.ts`
- `modules/ai/document-intake-contract.ts`

Flujo:

1. El worker toma el `runId`.
2. Carga documento y run.
3. Si el run ya esta terminal, no reprocesa.
4. Descarga el archivo privado desde Storage.
5. Calcula hash del archivo.
6. Detecta duplicados por hash.
7. Sube el archivo a OpenAI como `user_data`.
8. Crea respuesta estructurada en background con schema JSON.
9. Hace polling hasta estado terminal.
10. Si OpenAI termina bien, extrae JSON estructurado.
11. Valida el contrato.
12. Armoniza resultados con logica deterministica.
13. Persiste artefactos documentales y draft de revision.

Puntos relevantes:

- El intake IA no es la ultima verdad para compra/venta.
- El modelo devuelve candidatos y hechos.
- Luego se rearmoniza con identidad organizacional y reglas del sistema.

### 6.10 Que extrae la IA documental

La IA de intake intenta devolver, entre otras cosas:

- candidato a familia transaccional
- subtipo documental
- emisor y receptor
- RUTs
- numero/serie
- moneda
- fecha
- subtotal / IVA / total
- lineas o amount breakdown
- warnings
- score de confianza
- explicaciones

Pero esos datos no entran al sistema "sin filtro". Antes se determiniza una parte importante.

### 6.11 Re-armonizacion deterministica despues de OpenAI

Entradas:

- `modules/accounting/organization-identity.ts`
- `modules/accounting/transaction-family-resolution.ts`
- `modules/accounting/invoice-identity.ts`
- `modules/accounting/concept-resolution.ts`

Esto es central para entender la arquitectura actual.

El sistema no confia ciegamente en la salida del modelo. Hace varias correcciones deterministicas:

#### A. Identidad organizacional

Compara emisor y receptor contra la identidad de la organizacion usando:

- RUT normalizado
- alias exactos
- overlap de tokens

Estrategias posibles:

- `tax_id`
- `exact_alias`
- `token_overlap`
- `none`
- `ambiguous`

#### B. Compra / venta / otro

La familia transaccional final se resuelve asi:

- si el emisor coincide fuerte con la organizacion -> `sale`
- si el receptor coincide fuerte con la organizacion -> `purchase`
- si ambos coinciden fuerte -> `other` + review
- si la identidad es ambigua -> `other` + review
- si no alcanza la identidad -> fallback al candidato del modelo

Esto significa que hoy la IA documental no manda sola sobre compra/venta. La identidad de la organizacion pesa mas.

#### C. Identidad de factura y duplicados

Se arma una business identity con prioridad:

- `tax_id + number + date`
- `tax_id + number + total + currency`
- `name + number + date + total + currency`

Se detecta:

- duplicado por hash,
- duplicado por identidad de negocio,
- duplicado sospechoso por identidad difusa.

Si queda como `suspected_duplicate` o `confirmed_duplicate`, la confirmacion se bloquea.

#### D. Match de concepto

Orden de matching:

1. alias del proveedor por codigo
2. alias del proveedor por descripcion
3. alias de organizacion por codigo
4. alias de organizacion por descripcion
5. similitud semantica
6. fallback a amount breakdown

Umbrales importantes:

- si similitud < `0.72`, no hay match semantico
- si la confianza de match < `0.8`, la linea requiere contexto del usuario

Consecuencia:

La salida de la IA puede haber extraido bien la linea, pero igualmente el sistema bloquear el carril contable porque no tiene un concepto confiable.

### 6.12 Persistencia del draft de revision

Resultado del intake exitoso:

- se crea o actualiza `document_drafts`
- se crean steps
- se guardan line items persistibles
- se guarda identidad de factura
- se guarda contexto inicial del documento
- el documento pasa a revision

Desde ese momento la UI de revision puede mostrar:

- identidad
- fields
- amounts
- operation context
- accounting context
- duplicate status
- tax treatment
- journal suggestion
- decision logs

### 6.13 Workspace de revision documental

Entrada:

- `modules/documents/review.ts`
- `components/documents/document-review-workspace.tsx`

Este es el centro operativo del producto.

El usuario trabaja sobre un draft abierto y ve:

- documento original
- hechos extraidos
- rol documental
- tipo documental
- fecha
- contraparte
- confianza / semaforo
- warnings
- duplicados
- tratamiento IVA
- sugerencia de asiento
- bloqueos
- decision logs de IA

Importante:

- la carga inicial de la pagina no dispara la segunda IA contable,
- porque `deriveDocumentAccountingState(...)` entra con `runAssistant: false`,
- para no gastar ni recalcular innecesariamente en cada refresh.

### 6.14 Accounting Context: cuando aparece y para que sirve

Entradas:

- `modules/accounting/rule-engine.ts`
- `modules/accounting/runtime.ts`

El `accounting_context` aparece cuando la deterministica no alcanza para cerrar la clasificacion contable.

Reason codes posibles:

- `ambiguous_vendor`
- `unmatched_concept`
- `new_concept_without_rule`
- `vat_operation_dependency`
- `multiple_candidate_accounts`

Estados posibles:

- `not_required`
- `required`
- `provided`
- `assistant_completed`
- `manual_override`

Reglas clave:

- bloquea confirmacion si hay reasons y no hay override manual ni texto del usuario,
- habilita segunda IA solo si hay reasons y el usuario escribio contexto libre,
- si hay override manual, el estado pasa a `manual_override`.

### 6.15 Segunda IA contable

Entrada:

- `modules/accounting/assistant.ts`

Objetivo:

Resolver sugerencia contable solo cuando la deterministica no alcanza y el usuario aporta contexto.

Condiciones para correr:

- hay `userContextText`
- hay `allowedAccounts`
- se llamo a guardar `accounting_context` o a confirmar
- no existe ya una salida persistida reutilizable

Importante:

- la segunda IA solo puede elegir IDs permitidos,
- si devuelve cuenta o concepto fuera del set permitido, se rechaza,
- si no hay cuentas permitidas, falla deterministamente,
- si devuelve baja confianza, puede bloquear confirmacion,
- si marca review manual, bloquea confirmacion.

Este punto es importante para tu problema actual:

la segunda IA no es un generador libre de asientos. Es un resolutor acotado sobre un set ya disponible.

### 6.16 Resolucion contable efectiva: orden real de verdad

Entrada:

- `modules/accounting/rule-engine.ts`
- `modules/accounting/rules.ts`

Precedencia de resolucion:

1. `manual_override`
2. `document_override`
3. `vendor_concept`
4. `concept_global`
5. `vendor_default`
6. `assistant`
7. `manual_review`

Esto significa:

- el override del usuario gana sobre todo,
- las reglas aprendidas ganan sobre la segunda IA,
- la segunda IA solo llena huecos,
- si nada cierra, el sistema queda en `manual_review`.

### 6.17 Creacion de cuenta nueva desde la revision

Entradas:

- `components/documents/document-review-workspace.tsx`
- `app/app/o/[slug]/documents/[documentId]/actions.ts`
- `modules/documents/review.ts`
- `modules/accounting/repository.ts`

Este repo ya tiene implementado un punto clave para destrabar el flujo:

si la cuenta correcta no existe todavia, el usuario puede crearla desde la misma revision, sin salir a otra pantalla.

Flujo:

1. En `Accounting Context` el usuario crea codigo y nombre.
2. Se crea cuenta postable segun `documentRole`:
   - venta -> `revenue`
   - compra -> `expense`
3. Esa cuenta se aplica enseguida como `manualOverrideAccountId`.
4. Se recalcula el draft.

Esto resuelve una parte importante del problema de UX contable inicial.

### 6.18 Sugerencia de journal

Entrada:

- `modules/accounting/suggestion-engine.ts`
- `modules/accounting/journal-builder.ts`

El journal no se construye solo por IA. Se arma con una mezcla de:

- regla aplicada,
- tratamiento IVA deterministico,
- cuentas de sistema obligatorias,
- moneda / FX,
- bloqueos de validacion.

Para compra se exige:

- cuenta principal resuelta
- `accounts_payable`
- eventualmente `vat_input_creditable`

Para venta se exige:

- cuenta principal resuelta
- `accounts_receivable`
- eventualmente `vat_output_payable`

Si falta algo, el journal queda bloqueado.

Esto es exactamente la causa de varios mensajes que viste en UI.

### 6.19 Tratamiento IVA

Entrada:

- `modules/tax/uy-vat-engine.ts`

El tratamiento IVA es deterministico y depende de:

- rol documental
- tipo documental
- hechos del documento
- categoria de operacion
- perfil fiscal
- snapshot de reglas
- linked operation type
- VAT profile de la regla aplicada
- contexto del usuario

No todo caso queda confirmable en MVP.

Algunas categorias todavia fuerzan review manual o bloqueo.

### 6.20 Que significa realmente el mensaje de bloqueo

El mensaje largo de `confirmation blocked` o `journal blocked` no es "la respuesta de la IA".

Es una composicion de varias familias de bloqueos:

- vendor blockers
- duplicate blockers
- concept blockers
- accounting context blockers
- review flags de la segunda IA
- blockers de la segunda IA
- VAT blockers
- journal blockers

Por eso en una misma tarjeta pueden convivir mensajes de:

- deterministica
- estructura contable
- segunda IA
- IVA

Este punto es clave para cualquier rediseno. Hoy la UI muestra una unica mezcla de causas heterogeneas.

### 6.21 Confirmacion del documento

Entrada:

- `modules/documents/review.ts`

La confirmacion hace mucho mas que cambiar un estado.

Flujo real:

1. Recalcula el estado contable con `runAssistant: true`.
2. Si `canConfirm = false`, responde blockers y no confirma.
3. Verifica que el periodo IVA sea mutable.
4. Persiste artefactos aprobados.
5. Genera `accounting_suggestions` y `journal_entries`.
6. Opcionalmente aprende una regla reusable.
7. Sincroniza open items.
8. Inserta `ai_decision_logs`.
9. Marca steps como confirmados.
10. Inserta `document_confirmations`.
11. Cierra / reconfirma revision.
12. Actualiza `documents.status = classified`.
13. Recalcula VAT run mensual si hay fecha documental.

O sea:

la confirmacion es el punto de consolidacion operacional del sistema.

### 6.22 Aprendizaje a partir de la aprobacion

Entradas:

- `modules/accounting/repository.ts`
- `modules/accounting/learning-suggestions.ts`

Scopes posibles de aprendizaje:

- `none`
- `document_override`
- `vendor_concept`
- `concept_global`
- `vendor_default`

Logica:

- `document_override`: para este documento puntual
- `vendor_concept`: para este proveedor + este concepto
- `concept_global`: para este concepto reusable entre proveedores
- `vendor_default`: para este proveedor recurrente, sin granularidad fina

Ademas:

- puede crear concepto canonico si no existe,
- puede crear aliases a partir de las lineas revisadas,
- puede actualizar defaults del proveedor,
- inserta `accounting_rules`,
- deja auditoria.

Este es el mecanismo por el cual el sistema se "vuelve mas inteligente" con el uso.

### 6.23 Reapertura de revision

El sistema soporta reabrir un documento ya confirmado.

Flujo:

1. clona el draft confirmado a una nueva revision abierta,
2. deja el documento en `classified_with_open_revision`,
3. obliga a reconfirmar,
4. respeta restricciones del periodo IVA.

### 6.24 Open items

Entrada:

- `modules/accounting/open-items.ts`

Cuando el documento queda confirmado:

- si es factura, crea open item,
- si es recibo/nota de credito/payment support, intenta cancelar items abiertos,
- si sobra saldo, puede crear residual negativo,
- auto-crea `customers` o `vendors` si hace falta.

Esto extiende el valor del sistema mas alla de la clasificacion documental.

### 6.25 VAT runs mensuales

Entrada:

- `modules/tax/vat-runs.ts`

Al confirmar documentos fechados:

1. se ubica el periodo mensual,
2. se agrupan latest confirmed drafts,
3. se suman ventas/compras/impuestos de importacion,
4. se calcula:
   - `output_vat`
   - `input_vat_creditable`
   - `input_vat_non_deductible`
   - `import_vat`
   - `import_vat_advance`
   - `net_vat_payable`
5. se actualiza `vat_runs`,
6. se sincroniza `tax_periods`.

Estados relevantes:

- `draft`
- `needs_review`
- `reviewed`
- `finalized`
- `locked`

Si un periodo esta `finalized` o `locked`, no deja mutar documentos sin reapertura.

### 6.26 Importaciones y planillas

Entradas:

- `modules/spreadsheets/import-runner.ts`
- `app/app/o/[slug]/imports/actions.ts`
- `modules/imports/*`

Hay dos carriles grandes aqui:

#### A. Planillas

Se soportan:

- CSV
- TSV
- XLS
- XLSX

El sistema:

1. parsea la planilla,
2. decide si usar modo `interactive` o `batch`,
3. interpreta el preview con heuristica o OpenAI,
4. deja preview confirmable,
5. materializa secciones elegidas.

Casos previstos:

- historico de liquidaciones IVA
- import de plan de cuentas
- import de templates journal

#### B. Operaciones de importacion

Se pueden:

- crear operaciones DUA/import
- vincular documentos revisados
- agregar impuestos asociados
- aprobar la operacion
- recalcular VAT run al aprobar

Esto abre un carril documental-fiscal especial para comercio exterior.

### 6.27 Exportacion

Entradas:

- `modules/exports/repository.ts`
- `modules/exports/canonical.ts`
- `modules/exports/jobs.ts`

La exportacion toma:

- VAT run
- documentos confirmados
- drafts
- identities
- line items
- confirmaciones
- suggestions
- journal entries
- import operations aprobadas
- mappings DGI
- historicos de planillas

Y construye:

- payload canonico fiscal
- resumen DGI
- artefacto exportable almacenado en bucket privado

## 7. Que parte es deterministica, que parte es IA y que parte es decision humana

### 7.1 Deterministica

Hoy es deterministico, o casi deterministico:

- redireccion post-auth
- validacion de onboarding
- bootstrap de cuentas starter
- materializacion de snapshot
- identidad de organizacion
- resolucion compra/venta basada en identidad
- identity key de factura
- deteccion de duplicados
- resolucion de proveedor por RUT/alias/nombre
- match de concepto por alias y umbrales
- precedencia de reglas contables
- tratamiento IVA
- armado del journal final
- validaciones de balance y cuentas obligatorias
- lifecycle de VAT runs

### 7.2 IA

Hoy la IA entra en:

- extraccion documental estructurada
- fallback de clasificacion documental cuando la identidad no resuelve
- interpretacion de planillas
- segunda IA contable cuando la deterministica no alcanza y el usuario aporta contexto

La IA no tiene soberania absoluta. Esta acotada por:

- schema estructurado,
- allowed sets,
- correcciones deterministicas,
- bloqueos de confirmacion.

### 7.3 Decision humana

El usuario interviene para:

- corregir facts
- cambiar rol/tipo documental
- resolver duplicados
- elegir categoria de operacion
- escribir contexto contable
- hacer manual override de cuenta/concepto/categoria
- crear cuenta nueva inline
- confirmar o reabrir
- elegir alcance de aprendizaje
- aprobar imports
- cerrar/reabrir VAT runs

## 8. Orden real de toma de decisiones en el sistema

Este es el orden practico de verdad hoy:

1. Auth y tenancy
2. Onboarding fiscal minimo
3. Cuentas starter
4. Snapshot fiscal-contable
5. Upload y cola
6. IA documental
7. Correccion deterministica del intake
8. Deteccion de duplicados
9. Resolucion de proveedor
10. Resolucion de concepto
11. Necesidad o no de `accounting_context`
12. Segunda IA solo si hay contexto del usuario y cuentas permitidas
13. Precedencia de regla contable efectiva
14. Tratamiento IVA
15. Construccion del journal
16. Validacion final `canConfirm`
17. Aprendizaje de regla
18. Open items
19. VAT run
20. Exportaciones

## 9. Etapas de decision critica

Esta seccion es la mas importante para decidir como seguir.

### 9.1 Decision critica 1: cuando una organizacion esta "lista para operar"

Hoy, conceptualmente, una organizacion se crea en onboarding. Pero operacionalmente no esta lista hasta que existan:

- perfil fiscal consistente,
- snapshot materializable,
- cuentas base,
- OpenAI e Inngest operativos,
- schema de DB alineado.

Implicancia:

crear tenant no equivale a tenant operativo.

### 9.2 Decision critica 2: quien manda sobre compra/venta

Hoy manda principalmente la identidad de la organizacion, no la IA.

Ventaja:

- reduce errores obvios del modelo.

Riesgo:

- si la identidad de la organizacion esta mal cargada o incompleta, toda la clasificacion se deforma aguas abajo.

### 9.3 Decision critica 3: cuando exigir contabilidad completa

Hoy la confirmacion exige journal confirmable.

Eso significa que para confirmar un documento deben estar resueltos:

- cuenta principal,
- cuentas de sistema,
- IVA suficiente,
- bloqueos limpios,
- balance contable.

Ventaja:

- confirmacion = documento operacionalmente fuerte.

Riesgo:

- friccion muy alta al principio,
- onboarding contable mas pesado,
- mas documentos quedan trabados aunque la informacion fiscal ya este suficientemente clara.

### 9.4 Decision critica 4: cuando aprender

Hoy el aprendizaje fuerte ocurre al confirmar.

Ventaja:

- se aprende solo desde decisiones aprobadas.

Riesgo:

- el sistema tarda en volverse util si la primera tanda de documentos no logra confirmarse,
- el aprendizaje llega tarde,
- el usuario ve muchos bloqueos antes de recibir retorno acumulativo.

### 9.5 Decision critica 5: que hacer cuando falta plan de cuentas o reglas

El repo ya avanzo en dos mitigaciones:

- cuentas starter automaticas,
- creacion de cuenta inline desde revision

Pero sigue abierta la decision mayor:

- querer confirmacion estricta aun sin configuracion fina,
- o permitir una primera confirmacion mas blanda y completar despues.

### 9.6 Decision critica 6: cuanto mezclar en una sola pantalla

Hoy la review junta:

- errores deterministas
- bloqueos fiscales
- bloqueos contables
- mensajes de segunda IA
- duplicados
- aprendizaje

Ventaja:

- todo esta en una sola cabina.

Riesgo:

- el usuario no sabe cual causa es la primaria,
- cuesta distinguir "falta dato", "falta cuenta", "la IA dijo no", "hay duplicado", "periodo IVA cerrado".

### 9.7 Decision critica 7: acoplamiento entre confirmacion documental y efectos posteriores

Hoy confirmar dispara:

- journal entry
- learning
- open items
- ai decision log
- VAT run rebuild

Ventaja:

- fuerte consistencia.

Riesgo:

- mucho acoplamiento,
- cualquier problema en una etapa frena la confirmacion total,
- es mas dificil tener un carril de aprobacion parcial.

## 10. Problemas estructurales que hoy aparecen con mas fuerza

### 10.1 El sistema exige madurez contable muy temprano

Aunque ya existe bootstrap minimo, la confirmacion sigue pidiendo una resolucion contable real. Eso hace que el primer uso sea mucho mas exigente de lo que un piloto tolera comodamente.

### 10.2 La IA contable no puede salvar un vacio estructural

Si no hay `allowedAccounts`, la segunda IA falla. Y esta bien que falle, porque hoy esta disenada para elegir dentro de un set permitido, no para inventar estructura contable.

### 10.3 Los bloqueos se presentan fusionados

El usuario recibe un gran texto compuesto, pero la arquitectura interna separa causas bastante distintas. Eso genera sensacion de "la IA no me deja" cuando a veces el bloqueo real es deterministicamente contable o fiscal.

### 10.4 El valor acumulativo del aprendizaje llega tarde

Si el aprendizaje principal se guarda al confirmar y la confirmacion es dificil, entonces la curva de mejora del sistema se vuelve lenta.

### 10.5 La salud operativa del pipeline pesa demasiado

Si falla schema, Inngest, URLs, Storage o OpenAI, el usuario siente que "el sistema no procesa", aunque el modelo de negocio este bien.

## 11. Opciones reales para decidir como seguir

### Opcion A: mantener confirmacion estricta y mejorar setup inicial

Idea:

Mantener la filosofia actual: no se confirma nada sin resolucion contable y fiscal suficientemente fuerte.

Que requeriria:

- wizard mejor de onboarding contable,
- mejor bootstrap de plan de cuentas,
- mejores reglas starter por rubro,
- UI de bloqueos por categoria,
- crear cuentas/reglas mas facil,
- mejor observabilidad del pipeline.

Ventajas:

- consistencia fuerte,
- menos basura contable,
- confirmacion significa "listo para downstream".

Riesgos:

- piloto mas pesado,
- aprendizaje mas lento,
- mas friccion para usuarios no contables.

### Opcion B: separar "confirmacion documental/fiscal" de "confirmacion contable"

Idea:

Permitir confirmar que el documento esta bien identificado y fiscalmente entendido, aunque el asiento todavia no este cerrado.

Modelo mental:

- etapa 1: documento fiscalmente validado
- etapa 2: documento contablemente resuelto

Ventajas:

- mucho menos bloqueo temprano,
- el sistema empieza a acumular conocimiento antes,
- el usuario siente progreso real.

Riesgos:

- mas estados en el dominio,
- mas complejidad de lifecycle,
- hay que decidir que downstream puede ocurrir antes del asiento final.

### Opcion C: permitir confirmacion con cuenta generica temporal

Idea:

Si todo lo fiscal esta claro, permitir confirmar con una cuenta generica temporal:

- ventas genericas
- gastos genericos

y despues reclasificar o aprender.

Ventajas:

- muy util para piloto,
- destraba onboarding,
- mantiene un journal real aunque pobre.

Riesgos:

- aumenta reprocesos,
- puede contaminar analytics contables si no se limpia despues,
- exige buen flujo de recategorizacion.

### Opcion D: aprender antes de confirmar

Idea:

Permitir que ciertas decisiones tomadas en review generen aprendizaje provisional antes de la confirmacion final.

Por ejemplo:

- cuando el usuario hace override de cuenta,
- cuando crea una cuenta y la usa,
- cuando resuelve duplicado o concepto,
- cuando define `vendor_concept` probable.

Ventajas:

- el sistema mejora mas rapido,
- la siguiente factura similar entra mejor incluso si la primera no termino confirmada.

Riesgos:

- hay que distinguir aprendizaje provisional de aprendizaje aprobado,
- se puede propagar una mala decision demasiado pronto.

## 12. Recomendacion concreta para tomar una buena decision

Si el objetivo inmediato es piloto real con varios usuarios y varias organizaciones, la recomendacion mas sana no parece ser "hacer mas permisiva la IA", sino reordenar la frontera entre etapas.

### Recomendacion de corto plazo

1. Mantener la IA acotada a schemas y allowed sets.
2. Mantener la deterministica fuerte para identidad, duplicados e IVA.
3. Reducir friccion contable inicial con:
   - bootstrap mejor,
   - creacion inline de cuenta,
   - UI de bloqueos segmentada.
4. Decidir explicitamente si la confirmacion del MVP debe ser:
   - estrictamente contable,
   - o documental/fiscal primero y contable despues.

### Recomendacion de producto

Si el dolor principal hoy es que el usuario llega a "entiendo la factura pero no puedo guardarla", entonces el cuello no esta en OpenAI sino en el punto de acoplamiento entre:

- resolucion contable completa,
- aprendizaje,
- confirmacion final.

### Recomendacion de arquitectura

La decision mas importante a tomar es esta:

`Confirmar documento` debe seguir significando "todo quedo resuelto y downstream listo", o debe pasar a significar "el documento ya es valido y puede seguir a una segunda etapa contable"?

Esa sola decision cambia mucho mas que cualquier ajuste puntual de prompt.

## 13. Checklist operativo antes de pruebas piloto serias

Antes de sumar mas usuarios/organizaciones, conviene validar siempre:

- schema de Supabase alineado con migraciones
- `APP_URL` y `NEXT_PUBLIC_APP_URL` correctas
- email templates de Supabase correctas
- Inngest sincronizado en produccion
- `OPENAI_API_KEY` disponible
- health endpoint revisado
- onboarding fiscal completo
- starter accounts presentes
- permisos de bucket/documentos/exportaciones correctos

## 14. Resumen ejecutivo

El sistema ya implementa un flujo bastante completo y potente, pero hoy esta optimizado para consistencia fuerte, no para onboarding suave.

La IA no es el unico cuello. De hecho, varios de los bloqueos clave son deterministas y estan bien fundados:

- identidad organizacional,
- duplicados,
- cuentas requeridas,
- precedencia de reglas,
- tratamiento IVA,
- balance del journal.

El verdadero punto a decidir ahora no es "hacer mejor el prompt", sino definir donde queres ubicar la frontera entre:

- documento suficientemente entendido,
- documento contablemente resoluble,
- documento definitivamente confirmado.

## 15. Archivos clave para profundizar

### Auth y onboarding

- `modules/auth/signup-service.ts`
- `modules/auth/server-auth.ts`
- `app/auth/confirm/route.ts`
- `app/onboarding/actions.ts`
- `modules/organizations/onboarding-schema.ts`

### Snapshot fiscal y settings

- `modules/organizations/rule-snapshots.ts`
- `modules/organizations/settings.ts`

### Upload y procesamiento documental

- `components/documents/upload-dropzone.tsx`
- `app/app/o/[slug]/dashboard/actions.ts`
- `app/api/v1/documents/[documentId]/processing-status/route.ts`
- `modules/documents/processing.ts`
- `modules/documents/inngest-function.ts`
- `lib/llm/openai-responses.ts`
- `modules/ai/document-intake-contract.ts`

### Deterministica documental/contable

- `modules/accounting/organization-identity.ts`
- `modules/accounting/transaction-family-resolution.ts`
- `modules/accounting/invoice-identity.ts`
- `modules/accounting/vendor-resolution.ts`
- `modules/accounting/concept-resolution.ts`
- `modules/accounting/rule-engine.ts`
- `modules/accounting/runtime.ts`
- `modules/accounting/suggestion-engine.ts`
- `modules/tax/uy-vat-engine.ts`

### Revision, aprendizaje y confirmacion

- `modules/documents/review.ts`
- `components/documents/document-review-workspace.tsx`
- `modules/accounting/repository.ts`
- `modules/accounting/learning-suggestions.ts`
- `modules/accounting/decision-log.ts`
- `modules/accounting/open-items.ts`

### IVA, imports y export

- `modules/tax/vat-runs.ts`
- `modules/spreadsheets/import-runner.ts`
- `app/app/o/[slug]/imports/actions.ts`
- `modules/imports/*`
- `modules/exports/repository.ts`
- `modules/exports/jobs.ts`

## 16. Conclusion final

El sistema ya tiene casi todas las piezas de un flujo operativo serio. El problema actual no parece ser falta de funcionalidad aislada, sino tension entre:

- rigor contable,
- friccion operativa,
- timing del aprendizaje,
- y acoplamiento entre confirmacion y efectos posteriores.

Por eso, la mejor siguiente decision no es solo tecnica. Es una decision de producto:

`queremos que el sistema confirme solo cuando todo el downstream este listo, o queremos permitir que el documento avance por etapas de madurez?`

Ese es el nodo central alrededor del cual conviene decidir el rediseno de la deterministica, los asientos contables, el rol de la IA y las decisiones posteriores.
