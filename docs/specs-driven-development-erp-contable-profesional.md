# specs-driven-development-erp-contable-profesional.md

**Estado editorial:** propuesto / no implementado salvo donde se indique explícitamente  
**Fecha:** 2026-03-20  
**Estado editorial 2026-03-28:** hoy funciona como roadmap de fase posterior. El cierre base, los threads del asistente y el admin de reglas ya quedaron absorbidos por la documentacion oficial y el codigo.  
**Estado actual 2026-03-20:** la epica inmediata de cierre base ya fue absorbida por la documentacion oficial y materializada en cockpit, validator, estados de periodo y trazabilidad IA transversal.  
**Objetivo:** consolidar, en un único documento de trabajo para Codex, el salto de Convertilabs desde un kernel contable-fiscal document-driven hacia una plataforma de cierre contable-fiscal y auditoría externa asistida por IA, con trazabilidad completa, human-in-the-loop y foco de producto en Uruguay.

---

## 1. Síntesis ejecutiva

La idea central de esta especificación es simple y estructural:

> **Hoy la unidad de confianza fuerte es el asiento inmutable. El siguiente salto de producto es que la unidad de confianza fuerte pase a ser el período cerrado.**

Eso cambia el eje del sistema:

- de **documento -> sugerencia -> asiento**;
- a **evidencia -> propuesta -> aprobación humana -> ledger -> cierre de período -> snapshot -> reporting formal -> auditoría**.

La segunda idea estructural es esta:

> **La IA no debe ser una caja negra ni un atajo al ledger. Debe operar como un analista junior trazable dentro del sistema.**

Eso implica que la IA:

- tiene identidad estable dentro del producto;
- propone, no impone;
- siempre deja rastro de qué vio, qué sugirió, por qué, cuándo y con qué evidencia;
- nunca cierra períodos ni postea asientos finales sin aprobación humana;
- nunca sustituye el motor determinístico, los snapshots, la auditoría ni la historia contable.

La tercera idea estructural es esta:

> **Cuando un período queda hard closed, debe existir un artefacto inmutable de cierre: `close_snapshots`.**

Ese snapshot debe congelar, al menos:

- trial balance exacto del cierre;
- VAT run oficial asociado;
- conciliación DGI del mes;
- open items del corte;
- FX usados;
- asientos manuales y ajustes del período;
- checks de integridad y sus waivers;
- hashes o digest canónicos para prueba futura.

La consecuencia práctica es que el primer entregable visible de alto valor no es un PDF, sino un **Cockpit de Cierre** por período, con estado, semáforos, blockers, checklist, trazabilidad y asistencia contextual.

---

## 2. Qué ya existe hoy y qué todavía falta

### 2.1 Lo ya existente que sirve como base sólida

Convertilabs ya tiene varios cimientos fuertes:

- tenancy y trazabilidad por organización/usuario;
- onboarding y business profile versionado;
- intake documental separado de revisión;
- motor determinístico de clasificación contable/fiscal con IA acotada al desempate/contexto;
- posting provisional y final;
- `source_events`, `source_event_facts` y `posting_proposals`;
- `journal_entries` y `journal_entry_lines` con inmutabilidad y linaje;
- subledger de open items y settlement links;
- trial balance, balance sheet e income statement como read models;
- workflow y lifecycle de IVA;
- conciliación DGI base;
- bridge de exportación contable/fiscal;
- `audit_log` y `ai_decision_logs` como base de observabilidad. 

Eso significa que el repo ya puede sostener un circuito serio de contabilidad documental y liquidación mensual de IVA, pero todavía no un cierre contable/fiscal anual integral ni una experiencia de auditoría externa nativa. 

### 2.2 Lo faltante crítico

Los gaps más importantes no están en el kernel base sino en la capa de cierre:

- workflow de cierre mensual formal;
- asientos manuales y ajustes de cierre;
- revaluación FX de cierre;
- lock operativo/fiscal/contable por estado de período;
- cierre anual de resultados;
- apertura automática del siguiente ejercicio;
- estados financieros formales;
- conciliación bancaria;
- módulos auxiliares de activo fijo, inventario/costo y payroll;
- motores tributarios más allá de IVA;
- workspace de auditor externo y pack anual auditable.

---

## 3. Tesis de producto actualizada

### 3.1 Posicionamiento

Convertilabs **no** debería moverse hacia un ERP generalista. La posición correcta sigue siendo:

- capa de decisión fiscal para Uruguay;
- capa de estructuración contable explicable;
- capa de control operativo por documento, cierre y evidencia;
- puente de exportación hacia ERP, estudio o planilla;
- y, a partir de ahora, **sistema operativo de cierre contable-fiscal y evidencia de auditoría**.

### 3.2 Nueva promesa de producto

La promesa de producto evoluciona a esta secuencia:

1. recibir evidencia documental y datasets operativos;
2. extraer y normalizar hechos;
3. resolver propuesta contable/fiscal con motor determinístico + IA acotada;
4. permitir revisión humana, override controlado y aprendizaje explícito;
5. postear al ledger inmutable;
6. gestionar cierre mensual y anual por período;
7. congelar snapshots de cierre;
8. emitir reporting financiero/fiscal;
9. asistir al contador, administrativo y auditor externo con IA trazable.

---

## 4. Principios no negociables

### 4.1 IA propone, humano decide

Toda acción material debe seguir este patrón:

```text
IA sugiere -> humano revisa -> humano aprueba/rechaza/corrige -> sistema materializa
```

Nunca:

```text
IA decide -> IA postea -> ledger cambia sin firma humana
```

### 4.2 El motor determinístico sigue siendo el núcleo

La IA se apoya sobre el sistema, no lo reemplaza.

Orden deseado:

1. reglas y validaciones determinísticas;
2. snapshots y contexto versionado;
3. explainability basada en hechos reales;
4. IA para sugerencia, narrativa, priorización o muestreo.

### 4.3 No reescritura retrospectiva

Nada de esta especificación debe violar la política actual de historia:

- cambios de plan, traits, reglas o presets operan hacia adelante;
- documentos ya confirmados solo cambian vía reapertura explícita;
- períodos cerrados no se mutan silenciosamente;
- correcciones post-cierre se registran como reapertura formal o como asientos del período abierto según política.

### 4.4 Un solo carril transaccional

No debe existir un bypass “IA -> journal”.

Toda materialización contable, aunque sea manual o sugerida por IA, debe converger al mismo carril conceptual:

```text
evidencia/contexto -> source_event -> posting_proposal -> approval -> journal_entry -> read models
```

### 4.5 Explainability transversal

El usuario final debe poder saber, para toda decisión material:

- quién la inició;
- si intervino IA;
- qué motor/regla/persona decidió;
- qué evidencia se usó;
- qué política/version snapshot estaba vigente;
- qué cambió y qué no;
- por qué quedó bloqueado o aprobado.

### 4.6 Menor privilegio y segregación de funciones

En cierres y auditoría, el sistema debe tender a:

- separación maker/checker para ajustes materiales;
- roles acotados por acción;
- lectura de auditor externo sin permisos de escritura sobre libros;
- service role solo para orquestación interna, no como identidad de negocio visible al usuario.

---

## 5. Modelo operativo de IA dentro del sistema

## 5.1 La IA como actor del sistema

### Requisito conceptual obligatorio

La IA debe tener una identidad estable y rastreable en el sistema. La implementación exacta la puede decidir Codex, pero la semántica mínima es obligatoria.

### Semántica mínima obligatoria

Cada intervención de IA debe registrar:

- `actor_id` estable del asistente;
- organización y contexto de negocio;
- usuario humano que la solicitó o a quien se le presentó;
- modelo, proveedor y versión;
- template/prompt/version hash;
- inputs relevantes y su hash;
- output estructurado;
- rationale o justificación;
- evidencia y referencias consultadas;
- confianza y warnings;
- estado de resolución humana;
- timestamps de generación, revisión y resolución.

### Implementación sugerida

Codex puede resolverlo de dos formas compatibles con el stack actual:

**Opción A — recomendada:** perfil de sistema en `profiles` con metadata `is_system=true`, `system_kind=ai_assistant`.  
**Opción B — alternativa:** tabla dedicada `system_actors`, manteniendo una referencia visible equivalente en logs y UI.

Si se elige A, el objetivo no es “loguear” a la IA, sino darle una identidad consistente y visible en trazabilidad.

### Recomendación concreta

Usar un actor estable tipo:

- `system_ai_assistant`

Y complementar con una noción de **persona operativa** o **modo**:

- `document_reviewer_assistant`
- `close_assistant`
- `tax_assistant`
- `audit_assistant`

La persona puede vivir como enum, metadata o campo en la corrida, sin necesidad de multiplicar perfiles físicos.

---

## 5.2 Tablas transversales propuestas para asistencia inteligente

> Los nombres exactos quedan abiertos a Codex. Lo importante es la semántica y que no se creen 8 logs incompatibles entre sí.

### 5.2.1 `assistant_runs`

Registro universal de cualquier intervención IA nueva fuera de intake/preset.

Campos mínimos sugeridos:

- `id`
- `organization_id`
- `requested_by_profile_id`
- `actor_profile_id` o `system_actor_id`
- `persona`
- `scope` (`documents`, `close`, `vat`, `reconciliation`, `audit`, `reporting`, `cost_center`, `bank_rec`, etc.)
- `target_kind`
- `target_id`
- `input_hash`
- `prompt_template_key`
- `prompt_template_version`
- `provider`
- `model`
- `model_version`
- `status`
- `confidence`
- `rationale_markdown` o `rationale_json`
- `output_json`
- `warnings_json`
- `created_at`
- `completed_at`
- `error_code`
- `error_message`

### 5.2.2 `assistant_run_evidence_refs`

Rastrea qué objetos vio la IA.

Campos mínimos sugeridos:

- `assistant_run_id`
- `source_kind` (`document`, `journal_entry`, `vat_run`, `reconciliation_run`, `open_item`, `close_check`, etc.)
- `source_id`
- `snapshot_ref`
- `source_hash_at_read`
- `excerpt_ref` o `excerpt_hash`

### 5.2.3 `assistant_suggestions`

Cuando la IA no solo narra sino propone una acción concreta.

Campos mínimos sugeridos:

- `assistant_run_id`
- `suggestion_type` (`manual_entry_draft`, `fx_revaluation_draft`, `dgi_justification_draft`, `variance_alert`, `audit_sample_candidate`, `duplicate_alert`, etc.)
- `proposed_payload_json`
- `resolution_status` (`pending`, `accepted`, `rejected`, `edited`, `expired`, `superseded`)
- `resolved_by_profile_id`
- `resolved_at`
- `resolution_comment`

### 5.2.4 Reutilización de logs existentes

No romper lo que ya existe.

Recomendación:

- mantener `ai_decision_logs` para intake/documentos y compatibilidad histórica;
- mantener `organization_preset_ai_runs` para onboarding/presets;
- agregar `assistant_runs` como capa transversal nueva;
- con el tiempo, si Codex lo ve razonable, enlazar los logs viejos al nuevo estándar en lugar de reescribirlos.

---

## 5.3 Ciclo de vida de una sugerencia IA

```text
requested
  -> generated
  -> presented_to_human
  -> accepted / rejected / edited
  -> materialized_if_applicable
  -> sealed_in_audit_log
```

Reglas:

- una sugerencia rechazada no desaparece;
- una sugerencia editada mantiene el payload original y la versión aprobada;
- si la sugerencia desemboca en asiento/posting/cierre, debe quedar linkeada a ese artefacto final;
- si la sugerencia es solo narrativa o priorización, debe quedar igualmente auditable.

---

## 5.4 Qué puede y qué no puede hacer la IA

### Sí puede

- resumir;
- justificar;
- sugerir;
- redactar notas;
- preparar borradores de asientos;
- detectar anomalías;
- sugerir partidas para muestreo;
- reconstruir explainability usando hechos persistidos;
- proponer acciones de cierre.

### No puede

- cerrar períodos por sí sola;
- cambiar estados finales del ledger por sí sola;
- crear reglas duras efectivas sin aprobación humana;
- reabrir historia sin evento formal;
- mutar snapshots;
- “inventar” cuentas o políticas fuera del set permitido;
- saltarse el workflow de aprobación;
- operar como actor oculto.

---

## 6. Asistencia inteligente por perfil de usuario

## 6.1 Administrativo / operator / admin_processing

### Objetivo

Reducir basura de entrada, prevenir errores operativos y acelerar la bandeja.

### Casos de uso válidos

- alerta de posibles duplicados semánticos;
- detección de faltantes en hechos documentales;
- sugerencia de asignación de centro de costo o job cuando esas entidades existan realmente;
- sugerencia de settlement o relación entre factura/recibo/pago;
- detección de documentos que deberían ir a revisión humana prioritaria.

### Restricciones

- no puede confirmar documentos finales por sí sola;
- no puede crear reglas contables activas sin aprobación;
- no puede postear al diario final.

## 6.2 Contador / accountant / admin

### Objetivo

Acelerar cierres y elevar calidad técnica del balance y de IVA.

### Casos de uso válidos

- borrador de asiento manual de ajuste;
- propuesta de diferencia de cambio;
- análisis de variaciones del trial balance;
- borrador de nota de justificación DGI;
- detección de cuentas provisionales o partidas abiertas incoherentes;
- explicación de por qué un documento fue clasificado de cierta manera;
- sugerencia de checklist de cierre pendiente.

### Restricciones

- el contador humano aprueba, corrige o rechaza;
- si el asiento queda materializado, debe quedar trazado a la corrida IA y a la aprobación humana.

## 6.3 Auditor externo

### Objetivo

Entender criterio aplicado, pedir evidencia, seleccionar muestras y revisar cierres sin tocar libros.

### Casos de uso válidos

- botón “explicar este asiento”;
- reconstrucción de la precedencia real aplicada por el motor;
- scoring de riesgo para muestreo;
- comparación entre snapshot, diario, open items y reporting formal;
- generación de borrador de hallazgo o pregunta PBC.

### Restricciones

- rol estrictamente read-only sobre libros y configuración;
- puede crear notas/hallazgos/workpapers, pero no cambiar períodos ni asientos;
- sus corridas IA también deben quedar registradas.

---

## 7. Cierre mensual como nuevo núcleo funcional

## 7.1 La máquina de estados del período (`fiscal_periods`)

Este es el corazón del salto de producto.

### Estados propuestos

1. `open`
2. `ready_to_close`
3. `soft_closed`
4. `tax_locked`
5. `hard_closed`
6. `audit_frozen`

### Semántica de cada estado

| Estado | Qué permite | Qué bloquea | Rol típico dominante |
|---|---|---|---|
| `open` | operación normal, posting documental, ajustes permitidos según política | nada especial | operator / reviewer / accountant |
| `ready_to_close` | resolver pendientes del mes, cerrar bandejas, terminar revisiones ya ingresadas | intake operativo “nuevo” para ese período | admin_processing / accountant |
| `soft_closed` | solo ajustes/manual entries de cierre, reclasificaciones y regularizaciones controladas | nuevos documentos operativos para el período | accountant |
| `tax_locked` | reporting contable no tributario, consultas, preparación de cierre final | cualquier cambio que altere IVA del período | accountant / admin |
| `hard_closed` | solo lectura + emisión del snapshot + reporting del cierre | todo cambio directo del período | accountant / admin |
| `audit_frozen` | lectura absoluta y auditoría externa | toda mutación | external_auditor / viewer |

### Reglas de transición sugeridas

- `open -> ready_to_close`
  - requiere intención explícita;
  - registra quién inicia pre-cierre y por qué.

- `ready_to_close -> soft_closed`
  - requiere que la bandeja operativa del período esté razonablemente cerrada o que los waivers queden explícitos.

- `soft_closed -> tax_locked`
  - requiere VAT run finalizado;
  - requiere política clara sobre reapertura impositiva.

- `tax_locked -> hard_closed`
  - requiere close validator en verde o con waivers aprobados;
  - genera `close_snapshot`.

- `hard_closed -> audit_frozen`
  - opcional;
  - se usa cuando el cierre entra en ciclo de auditoría o queda congelado para emisión.

### Reaperturas sugeridas

- `ready_to_close` y `soft_closed` pueden volver a `open` con log formal y reason code.
- `tax_locked` puede reabrirse solo invalidando explícitamente el lock fiscal y dejando rastro.
- `hard_closed` y `audit_frozen` no deberían reabrirse en operación normal; la corrección por defecto debe ser vía asiento en período abierto actual, salvo política de excepción con log reforzado.

### Persistencia recomendada

Codex debería evaluar:

- agregar `status` enum a `fiscal_periods`;
- agregar `status_changed_at`, `status_changed_by`;
- agregar `close_policy_snapshot_id`;
- crear `fiscal_period_transition_logs` para historial completo de transiciones.

---

## 7.2 Close validator: motor determinístico de integridad de cierre

Antes de cerrar, el sistema debe responder de forma determinística si el período está listo.

### No debe depender de IA

La IA puede resumir o priorizar, pero el validator debe ser de reglas explícitas.

### Resultado deseado

Un `close_check_run` con checks individuales:

- `pass`
- `warning`
- `blocker`
- `waived`

### Familias de check mínimas

#### Documentos y workflow

- documentos en draft;
- documentos `needs_review`;
- provisionales sin confirmación final si la política no los tolera;
- documentos reabiertos después de cierto punto del cierre;
- documentos del período cargados fuera de ventana definida.

#### Contabilidad

- `v_trial_balance` balancea;
- no hay asientos draft/materialmente incompletos;
- no hay cuentas provisionales por encima de tolerancia;
- asientos manuales materiales tienen soporte;
- asientos materiales tienen aprobación requerida;
- no hay partidas abiertas incoherentes.

#### Fiscal

- VAT run finalizado cuando corresponda;
- VAT no fue reabierto luego del lock;
- conciliación DGI cerrada o waivada con nota;
- diferencias materiales justificadas.

#### Multimoneda

- revaluación FX ejecutada cuando aplique;
- snapshot de tasas sellado.

#### Operación auxiliar

- conciliación bancaria completada o waivada;
- activo fijo depreciado si el módulo existe y aplica;
- inventario/costo cerrados si el negocio lo exige.

### Diseño sugerido

- `close_check_runs`
- `close_check_results`
- catálogo de checks versionado
- severidad + materialidad + waiver + approved_by

---

## 7.3 `close_snapshots`: el artefacto de auditoría del período

### Objetivo

Cuando el período pasa a `hard_closed`, el sistema debe crear una foto inmutable y reconsultable del cierre.

### Contenido mínimo obligatorio

- período y organización;
- estado del período al momento del snapshot;
- timestamp exacto de sellado;
- quién cerró;
- hash canónico del snapshot;
- `v_trial_balance` exacto;
- `v_balance_sheet` y `v_income_statement` del corte;
- VAT run asociado;
- conciliación DGI asociada;
- open items del corte;
- exportaciones emitidas;
- FX usados y fuente;
- listado de asientos manuales/ajustes del período;
- resultado del close validator;
- snapshot de configuración/políticas aplicables.

### Recomendación fuerte

No limitarse a guardar “IDs”. Guardar también un payload canónico serializado o artefactos adjuntos inmutables para que la reproducción futura no dependa de read models cambiantes.

### Tablas sugeridas

#### `close_snapshots`

Campos mínimos:

- `id`
- `organization_id`
- `fiscal_period_id`
- `status_at_seal`
- `sealed_at`
- `sealed_by_profile_id`
- `close_hash`
- `validator_run_id`
- `vat_run_id`
- `dgi_reconciliation_run_id`
- `policy_snapshot_ref`
- `notes`

#### `close_snapshot_artifacts`

Para colgar datasets y blobs canónicos.

Tipos sugeridos:

- `trial_balance_json`
- `balance_sheet_json`
- `income_statement_json`
- `open_items_json`
- `fx_rates_json`
- `journal_digest_json`
- `close_check_results_json`
- `exports_manifest_json`
- `annual_pack_pdf` (más adelante)

### Estrategia de hash

Puede ser simple y suficiente:

```text
sha256(canonical_json(sorted_keys(snapshot_payload)))
```

No hace falta prometer criptografía sofisticada si no existe, pero sí un digest estable, reproducible y verificable.

### Política de reemisión

Si un `hard_closed` se invalida por reapertura excepcional, el snapshot viejo no se borra.

Debe quedar:

- snapshot original;
- evento de invalidación;
- snapshot nuevo;
- relación de supersession entre ambos.

---

## 7.4 Cockpit de Cierre (UI/UX)

### Tesis

El primer entregable visual de alto impacto no es un reporte final. Es una pantalla operativa por período donde el contador vea:

- estado del período;
- salud general;
- blockers y warnings;
- checklist;
- qué falta para cerrar;
- qué puede hacer su rol;
- qué sugirió la IA;
- quién aprobó qué.

### Superficies sugeridas

- `/app/o/[slug]/close`
- `/app/o/[slug]/close/[periodId]`

### Secciones mínimas del cockpit

#### Resumen superior

- mes / ejercicio;
- estado del período;
- semáforo general;
- fecha de último cambio;
- responsable actual del cierre.

#### Panel de blockers

Ejemplos:

- 🔴 15 documentos en draft;
- 🟡 conciliación DGI con diferencias temporales;
- 🔴 revaluación FX no ejecutada;
- 🟢 trial balance balanceado;
- 🟡 3 open items sin soporte/aging inconsistente.

#### Checklist de cierre

Agrupado por:

- documentos;
- contabilidad;
- IVA/DGI;
- bancos;
- FX;
- reporting;
- auditoría.

#### Ajustes del período

- asientos manuales;
- asientos propuestos por IA;
- pendientes de aprobación;
- reversos programados.

#### Snapshot / pack / auditoría

- último snapshot generado;
- exportaciones emitidas;
- enlaces a working papers futuros.

#### Asistente contextual

Un panel IA que:

- resume blockers;
- explica por qué el período no puede cerrar;
- propone próximos pasos;
- redacta borradores de justificación;
- nunca cambia el estado sin acción humana.

### Criterio UX

Cada blocker debe responder tres preguntas:

1. qué pasa;
2. por qué importa;
3. qué acción concreta lo destraba.

---

## 8. Asientos manuales y ajustes de cierre

## 8.1 Por qué son críticos

Hoy el repo llega muy lejos desde documentos, pero no alcanza para cierre integral sin carril robusto de ajustes.

### Casos mínimos obligatorios

- provisiones;
- devengamientos;
- amortizaciones;
- depreciaciones;
- reclasificaciones;
- ajustes impositivos;
- diferencia de cambio;
- regularizaciones sin documento fuente directo;
- asiento de cierre anual;
- asiento de apertura.

## 8.2 Principio de diseño

Los asientos manuales no deben ser un “editor suelto” por fuera del kernel.

Deben integrarse al carril formal:

```text
manual context / support -> source_event(sintético) -> posting_proposal -> approval -> journal_entry immutable
```

## 8.3 Requisitos funcionales mínimos

### Estructura

- múltiples líneas;
- validación de partida doble en tiempo real;
- multimoneda;
- selector de fecha y período;
- soporte documental adjunto;
- memo/justificación obligatoria;
- terceros y centros de costo cuando aplique.

### Clasificación del ajuste

Campo sugerido:

- `adjustment_type`
  - `ordinary`
  - `accrual`
  - `provision`
  - `depreciation`
  - `amortization`
  - `reclassification`
  - `tax_adjustment`
  - `fx_revaluation`
  - `year_close`
  - `year_opening`

### Metadata de control

- preparado por;
- aprobado por;
- si nació de IA;
- si requiere reverso automático;
- si ajusta otro asiento;
- si revierte otro asiento.

## 8.4 Requisitos de auditoría

Todo asiento manual material debe dejar:

- soporte;
- justificación;
- aprobación humana;
- trazabilidad temporal;
- vínculo a la política o checklist que lo disparó.

## 8.5 Recomendación técnica concreta

Codex debería evaluar agregar o reutilizar:

- `journal_entries.entry_origin`
- `journal_entries.adjustment_type`
- `journal_entries.prepared_by_profile_id`
- `journal_entries.approved_by_profile_id`
- `journal_entries.assistant_run_id`
- `journal_entries.support_required`
- `journal_entries.support_count`

Y/o una tabla satélite `journal_entry_controls` si prefieren no recargar `journal_entries`.

## 8.6 Aprobación maker/checker

Regla sugerida:

- ajustes pequeños pueden aprobarse por el mismo `accountant` si la política lo permite;
- ajustes por encima de umbral, de tipo `year_close`, `fx_revaluation` o generados por IA deben requerir aprobación separada.

## 8.7 Reversión automática

Muy importante para devengamientos y provisiones temporales.

Se debe permitir:

- reverso manual;
- reverso automático en primer día hábil del próximo período;
- trazabilidad entre asiento original y reverso.

El schema actual ya ayuda con:

- `reverses_journal_entry_id`
- `reversed_by_journal_entry_id`
- `adjusts_journal_entry_id`

---

## 9. Revaluación FX de cierre

## 9.1 Diseño esperado

La revaluación FX no debe ser un asiento libre “hecho a mano” salvo override excepcional.

Debe existir una corrida formal:

- identifica cuentas con `include_fx_revaluation`;
- toma saldos monetarios/open items en moneda original;
- valoriza a tipo de cambio de cierre;
- compara contra funcional;
- genera borrador de asiento;
- deja dataset de cálculo auditable;
- opcionalmente revierte según política.

## 9.2 Artefactos sugeridos

- `fx_revaluation_runs`
- `fx_revaluation_run_lines`
- `assistant_run` opcional para explicación narrativa
- `journal_entry` materializado cuando el humano aprueba

## 9.3 Regla de producto

El cockpit debe mostrar con claridad:

- FX pendiente de ejecutar;
- FX ya ejecutado;
- diferencia total del período;
- cuentas afectadas;
- fecha y tipo de cambio usado.

---

## 10. IVA mensual y relación con cierre

## 10.1 El IVA ya es un carril fuerte

No hace falta reescribirlo. Hace falta integrarlo más fuerte con el cierre.

## 10.2 Qué debe pasar

### En `ready_to_close`

- visibilidad compacta de estado IVA del período.

### En `soft_closed`

- puede haber ajuste manual contable todavía;
- pero debe quedar claro si afecta IVA o no.

### En `tax_locked`

- el VAT run debe estar finalizado;
- cualquier reapertura debe invalidar ese estado y dejar rastro.

### En `hard_closed`

- el VAT run usado queda sellado dentro del `close_snapshot`.

## 10.3 IA útil en IVA

- resumen del VAT run;
- draft de justificación de diferencias DGI;
- explicación de cambios vs período anterior;
- alertas de edge cases.

Nunca:

- finalización automática sin aprobación.

---

## 11. Reporting formal y cierre anual

## 11.1 Reporting mensual serio

Las vistas `v_balance_sheet` y `v_income_statement` ya existen como base de cálculo, pero no como módulo formal de emisión.

El objetivo es pasar de workspace de inspección a módulo de reporting.

### Requisitos mínimos

- balance general formal;
- estado de resultados formal;
- comparativos intermensuales;
- acumulado anual;
- columnas apertura / movimientos / cierre;
- filtros por período cerrado;
- exportación cerrada ligada al snapshot.

## 11.2 Cierre anual de resultados

Proceso requerido:

1. identificar cuentas de ingresos y gastos;
2. saldarlas contra resultado del ejercicio;
3. materializar asiento de cierre anual;
4. dejarlo enlazado al snapshot anual.

## 11.3 Apertura del ejercicio siguiente

Proceso requerido:

1. tomar cuentas patrimoniales cerradas del ejercicio N;
2. resetear cuentas de resultado;
3. generar asiento de apertura de N+1;
4. mantener linaje explícito con el cierre de N.

## 11.4 Annual close pack

Más adelante debe existir un pack anual que reúna:

- balance general;
- estado de resultados;
- trial balance;
- IVA mensuales del año;
- conciliaciones DGI;
- ajustes manuales;
- close snapshots mensuales y anual;
- exportaciones emitidas;
- movimientos posteriores al cierre;
- working papers/hallazgos si aplica.

---

## 12. Workspace de auditoría externa

## 12.1 Nuevo rol sugerido

Agregar un rol explícito:

- `external_auditor`

### Principios

- acceso por organización;
- read-only sobre libros;
- puede ver snapshots, read models, evidencias y hallazgos;
- no puede postear, cerrar, reabrir ni cambiar reglas.

## 12.2 Superficies sugeridas

- `/app/o/[slug]/audit`
- `/app/o/[slug]/audit/[periodId]`

## 12.3 Capacidades mínimas

- navegar snapshots por período;
- ver lead schedules por rubro;
- drill-down balance -> mayor -> asiento -> evidencia;
- pedir explicación del asiento;
- armar muestra de auditoría;
- registrar hallazgos y PBC requests;
- comparar dos snapshots o snapshot vs. emisión final.

## 12.4 IA útil para auditoría

### Explainability a demanda

Botón: **Explicar este asiento**

Debe reconstruir:

- si vino de documento, manual entry o corrida formal;
- qué reglas tuvieron precedencia;
- si hubo intervención IA y cuál fue;
- qué usuario aprobó;
- qué evidencia originó el posting.

### Scoring de riesgo para muestra

La IA puede priorizar asientos por patrones como:

- manuales fuera de horario;
- montos redondos inusuales;
- cambios post-cierre;
- cuentas sensibles;
- falta de soporte;
- frecuencia anómala.

Regla crítica:

- esto **sugiere** muestra;
- no reemplaza criterio profesional del auditor.

## 12.5 Tablas futuras sugeridas

- `audit_workpapers`
- `audit_findings`
- `audit_sampling_runs`
- `audit_sampling_candidates`
- `audit_requests`

Estas pueden venir después del núcleo de cierre, no antes.

---

## 13. Mapeo conceptual al repo actual

> Los nombres exactos quedan a confirmación de Codex. Esta sección da anclajes, no una promesa de path definitivo.

### 13.1 Persistencia / migraciones

Probables zonas de trabajo:

- `supabase/migrations/`
- schemas de contabilidad, identidad y fiscalidad ya existentes

### 13.2 Módulos a extender

| Dominio | Anclajes existentes | Extensiones sugeridas |
|---|---|---|
| identidad/roles | `modules/auth/*`, `profiles`, `organization_members` | actor IA estable, rol `external_auditor`, permisos por acción |
| accounting kernel | `modules/accounting/runtime.ts`, `journal-entry-builder.ts`, `kernel.ts`, `rule-engine.ts` | manual entries, entry origins, close adjustments, FX revaluation |
| tax | `modules/tax/vat-runs.ts`, `dgi-reconciliation.ts` | tax lock, reporting integrado al cierre, drafts IA de justificación |
| documents | workflow documental y review workspace | visibilidad de freeze por período, blockers para cierre |
| presentation/reporting | read models y presentation helpers | reporting formal, close cockpit, close pack |
| platform/observability | `audit_log`, `ai_decision_logs`, wrapper OpenAI, Inngest | `assistant_runs`, observabilidad transversal, panel de cierre |

### 13.3 Nuevos módulos probables

- `modules/close/*`
- `modules/copilot/*` o `modules/assistant/*`
- `modules/accounting/manual-entries.ts`
- `modules/accounting/fx-revaluation.ts`
- `modules/audit/*` (más adelante)

### 13.4 Nuevas superficies probables

- `app/app/o/[slug]/close/page.tsx`
- `app/app/o/[slug]/close/[periodId]/page.tsx`
- `app/app/o/[slug]/manual-entries/page.tsx`
- `app/app/o/[slug]/audit/page.tsx` (fase posterior)

### 13.5 Reutilización importante

El diseño debe aprovechar lo ya presente:

- `source_events`
- `source_event_facts`
- `posting_proposals`
- `journal_entries`
- `ledger_open_items`
- `vat_runs`
- `dgi_reconciliation_runs`
- `audit_log`
- `ai_decision_logs`

---

## 14. Plan de acción recomendado

## Fase 0 — Fundaciones transversales mínimas

### Objetivo

Preparar trazabilidad y permisos antes de ampliar UI y cierres.

### Entregables

1. identidad estable para la IA;
2. tabla transversal de corridas/sugerencias IA (`assistant_runs` + satélites);
3. rol `external_auditor` preparado aunque aún sin workspace completo;
4. catálogo de permisos por acción sensible;
5. convención de logs de aprobación humana.

### Criterios de aceptación

- toda nueva sugerencia IA queda auditada end-to-end;
- se puede mostrar en UI “propuesto por IA / aprobado por humano”; 
- ningún cambio material ocurre sin actor visible;
- la base queda lista para que los features siguientes no inventen logs ad hoc.

---

## Fase 1 — Máquina de estados del período + close validator + cockpit base

### Objetivo

Convertir al período en objeto de cierre real.

### Entregables

1. `fiscal_periods.status` con estados robustos;
2. transición formal con historial;
3. close validator determinístico;
4. cockpit base por período;
5. semáforos y blockers;
6. freeze de intake/operación por estado.

### Criterios de aceptación

- el usuario puede ver por qué un período no está listo;
- el sistema distingue claramente `open`, `ready_to_close`, `soft_closed`, `tax_locked`, `hard_closed`, `audit_frozen`;
- los guards de posting/intake cambian por estado;
- el cierre ya no depende de un booleano simple.

### Nota

Esta fase **no necesita** reporting formal ni auditor workspace completo para dar valor.

---

## Fase 2 — Asientos manuales y ajustes de cierre

### Objetivo

Cerrar el mayor gap funcional del kernel contable.

### Entregables

1. UI de manual entries;
2. soporte multimoneda;
3. clasificación de `adjustment_type`;
4. soporte documental + memo obligatorio;
5. maker/checker configurable;
6. reversión automática opcional;
7. integración al carril formal `source_event -> posting_proposal -> journal_entry`.

### Criterios de aceptación

- se puede cerrar un mes con provisiones/devengamientos/reclasificaciones dentro del sistema;
- cada ajuste queda trazado, aprobado y explicable;
- los asientos manuales aparecen naturalmente en diario, trial balance y snapshot posterior.

---

## Fase 3 — Close snapshots + tax lock + hard close real

### Objetivo

Volver auditable el cierre mensual como artefacto.

### Entregables

1. `close_snapshots`;
2. digest/hash canónico;
3. sellado de VAT run, conciliación DGI y open items del período;
4. invalidación formal si hay reapertura excepcional;
5. vista de snapshot en UI.

### Criterios de aceptación

- cada período `hard_closed` tiene snapshot consultable;
- se puede demostrar qué trial balance exacto correspondía al cierre;
- el sistema no depende de reconstrucción “viva” para responder a auditoría futura.

---

## Fase 4 — Cierre anual + apertura + reporting formal

### Objetivo

Convertir balancetes mensuales cerrados en balance anual sostenible.

### Entregables

1. asiento de cierre de resultados;
2. asiento de apertura de siguiente ejercicio;
3. reporting formal mensual/anual;
4. comparativos;
5. annual close pack base.

### Criterios de aceptación

- se puede cerrar el ejercicio dentro del sistema;
- se puede abrir N+1 con linaje al cierre de N;
- el producto ya emite estados más cercanos a un estándar profesional.

---

## Fase 5 — Asistencia IA por perfil + auditor workspace

### Objetivo

Llevar la IA de intake a co-piloto de trabajo profesional.

### Entregables

1. panel de asistente contextual en cockpit;
2. drafts IA de asientos de ajuste;
3. drafts IA de notas DGI y variaciones;
4. explainability a demanda por asiento;
5. scoring de muestreo para auditor externo;
6. workspace audit read-only.

### Criterios de aceptación

- administrativo, contador y auditor externo reciben asistencia diferente según rol;
- toda sugerencia queda auditada;
- la IA aumenta productividad sin quitar control ni trazabilidad.

---

## Fase 6 — Profundización contable y tributaria

### Objetivo

Completar calidad de cierre para más tipos de empresa.

### Entregables

1. FX revaluation run formal;
2. conciliación bancaria;
3. activo fijo;
4. inventario/costo;
5. payroll/BPS;
6. otros tributos.

### Criterios de aceptación

- el sistema deja de depender de papeles externos para rubros críticos del cierre anual.

---

## 15. Orden táctico recomendado para Codex

Si hubiera que empezar mañana, el orden sugerido es este:

### Sprint 1

- actor IA estable;
- `assistant_runs`;
- estado robusto en `fiscal_periods`;
- transition logs.

### Sprint 2

- close validator;
- cockpit base;
- guards por estado.

### Sprint 3

- manual entries multi-línea/multimoneda;
- approval flow;
- reversals.

### Sprint 4

- close snapshots;
- hard close real;
- vista de snapshot.

### Sprint 5

- drafts IA para ajustes + resúmenes de cierre;
- notas DGI asistidas;
- variance assistant.

### Sprint 6

- year close + opening entry;
- reporting formal.

### Sprint 7+

- auditor workspace;
- scoring de muestreo;
- FX/bancos/activo fijo según prioridad comercial.

---

## 16. Criterio de "done" para cada módulo nuevo

Tomar como regla editorial y técnica:

Un módulo solo se considera implementado cuando existan estas tres cosas:

1. **código de dominio**;
2. **persistencia o contrato real**;
3. **superficie visible o prueba operativa**.

Aplicado a estas specs:

- una tabla sin UI ni tests = `preparado`;
- una UI sin reglas/guards reales = `parcial`;
- un prompt sin trazabilidad = no cumple;
- una sugerencia IA sin actor/resolución humana = no cumple.

---

## 17. Riesgos si se implementa mal

### Riesgo 1 — Bypass de ledger

Si la IA o los asientos manuales entran por un carril paralelo, se rompe la integridad del kernel.

**Mitigación:** un solo carril formal de materialización.

### Riesgo 2 — Cierre sin snapshot

Si el período cambia de estado pero no existe snapshot, el cierre no es defendible en auditoría.

**Mitigación:** `hard_closed` siempre genera `close_snapshot`.

### Riesgo 3 — Booleanos pobres de período

`is_closed=true/false` no alcanza para modelar realidad operativa, fiscal y auditora.

**Mitigación:** máquina de estados explícita.

### Riesgo 4 — IA invisible

Si la ayuda IA no deja rastro, el producto pierde credibilidad profesional.

**Mitigación:** actor estable + corridas + evidencias + resolución humana.

### Riesgo 5 — UI linda sin motor de checks

Un cockpit sin validator real solo maquilla el problema.

**Mitigación:** determinismo primero, narrativa después.

---

## 18. Decisiones tempranas que Codex debería tomar bien

1. **Si el actor IA vive en `profiles` o en una tabla paralela**, pero con identidad estable visible.
2. **Si `assistant_runs` se crea como estándar transversal** o si se extiende demasiado `ai_decision_logs`.
3. **Cómo se modela `fiscal_periods.status`** y si habrá tabla de transiciones separada.
4. **Cómo se serializa un `close_snapshot`** para que sea estable y reconsultable.
5. **Si los asientos manuales reutilizan `posting_proposals`** o crean un artefacto intermedio nuevo.
6. **Cómo se define maker/checker** sin fricción excesiva para pymes pero con rigor suficiente.
7. **Cómo se introducen permisos nuevos** sin romper RLS y UX actual.

---

## 19. No-objetivos inmediatos

Para no dispersar el foco, esto **no** debería ir antes del núcleo de cierre:

- tesorería bancaria avanzada full;
- stock operativo en tiempo real;
- CRM/compras completos;
- hiperautomatización tributaria fuera de IVA sin haber cerrado bien el mes contable;
- sampling IA sofisticado antes de tener snapshots y cockpit sólidos.

---

## 20. Recomendación final de producto

La tesis más potente para Convertilabs no es:

> “software que procesa documentos contables con IA”

Sino esta:

> **infraestructura de cierre contable-fiscal y evidencia de auditoría, con IA trazable y human-in-the-loop**

Ese posicionamiento aprovecha mejor lo que el repo ya tiene:

- motor determinístico;
- ledger inmutable;
- linaje documental;
- open items;
- IVA fuerte;
- export bridge;
- logs y snapshots.

Y ordena el desarrollo futuro alrededor de algo profesionalmente muy defendible:

- cierre mensual serio;
- balance anual serio;
- auditoría externa asistida;
- IA útil sin caja negra.

---

## 21. Próximo paso recomendado para Codex

Si hubiera que elegir **una sola épica inmediata**, debería ser esta:

### Épica inmediata

**Cerrar el mes contable bien.**

Con este alcance concreto:

1. máquina de estados del período;
2. close validator;
3. cockpit de cierre;
4. asientos manuales y ajustes;
5. actor IA trazable + sugerencias auditadas.

Porque ese bloque:

- no reescribe la base;
- aprovecha todo lo ya construido;
- eleva muchísimo el valor profesional del producto;
- y deja allanado el camino para snapshots, cierre anual y auditoría externa.
