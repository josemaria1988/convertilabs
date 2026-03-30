# 02 - Accounting, tax and integrations

## Para que existe este documento

Este documento resume el kernel contable, el motor fiscal y los carriles de integracion externa sobre los que se apoya hoy Convertilabs.

Leelo si vas a tocar:

- clasificacion o rule engine;
- chart of accounts y presets;
- reglas administrables y aprendizaje;
- posting multi-linea;
- close y periodos;
- VAT, DGI, FX o import operations;
- importaciones, auditoria, bridge y exports.

## 1. Modelo contable oficial

Convertilabs no modela la contabilidad como una sola cuenta por documento.

El modelo correcto es:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> cuentas por rol
-> preview multi-linea
-> posting
```

Implicancia:

- el template y el settlement importan;
- el IVA es una linea separada;
- el documento puede abrir saldos;
- el posting final no se reduce a elegir una cuenta.

## 2. Regla de precedencia contable

La precedencia operativa vigente es:

1. `manual_override`
2. `document_override`
3. `vendor_concept_operation_category`
4. `vendor_concept`
5. `concept_global`
6. `vendor_default`
7. `assistant`
8. `manual_review`

Regla madre:

- el usuario puede sobreescribir;
- las reglas administradas mandan sobre IA;
- el asistente no bypassa el motor deterministico;
- `manual_review` es el fallback conservador.

## 3. Superficies activas de reglas

Rutas activas:

- `/app/o/[slug]/rules`
- `/app/o/[slug]/rules/new`
- `/app/o/[slug]/rules/[ruleId]`
- `/app/o/[slug]/rules/[ruleId]/version`

La administracion de reglas ya soporta:

- listado y filtros;
- lifecycle;
- versionado;
- timeline;
- simulaciones;
- auditoria;
- soporte asistido con IA controlada.

## 4. Aprendizaje y memoria

El sistema debe convertir decisiones humanas en reglas reutilizables.

Alcances activos de aprendizaje:

- `none`
- `document_override`
- `vendor_concept_operation_category`
- `vendor_concept`
- `concept_global`
- `vendor_default`

Regla operativa:

- el aprendizaje no reemplaza el posting;
- primero se resuelve el documento;
- luego se decide si esa resolucion merece memoria reusable.

## 4.1 Identidad de factura y politica de duplicados

La identidad documental no depende del nombre del archivo.

Politica oficial:

- usar RUT del emisor cuando exista; si no, usar nombre normalizado como fallback conservador;
- normalizar serie + numero de factura;
- comparar monto total redondeado y moneda;
- tratar como duplicado exacto una coincidencia de proveedor o emisor + numero + total + moneda;
- tratar como duplicado exacto tambien un mismo archivo ya visto por hash;
- mantener los duplicados difusos como sospecha bloqueante revisable, no como autoaceptacion.

Efecto esperado:

- duplicado exacto = rechazo duro del documento antes de review normal;
- duplicado sospechoso = bloqueo visible y resolucion humana;
- un duplicado no debe pasar a posting como si fuera un caso valido.

## 5. Templates, settlement y posting multi-linea

El motor contable vigente es settlement-aware y multi-linea.

Elementos canonicos:

- `operationKind`
- `paymentTerms`
- `settlementMethod`
- `settlementEvidenceSource`
- `postingTemplateCode`
- `accountRoleCode`

El sistema resuelve:

- template contable;
- cuenta principal;
- cuenta fiscal;
- contrapartida;
- open item cuando aplica;
- links de settlement posterior.

Regla UX derivada:

- el reviewer debe presentar esta resolucion como `plantilla contable -> asiento tipo -> cuentas por rol -> preview`;
- la cuenta principal puede aparecer como evidencia util, pero no como la narrativa principal del paso contable ni del resumen final;
- la vista previa multi-linea sigue siendo la fuente de verdad del Debe, Haber e IVA.

Tablas y artefactos clave:

- `posting_proposals`
- `journal_entries`
- `journal_entry_lines`
- `ledger_open_items`
- `ledger_settlement_links`

## 6. Chart of accounts y presets

La estrategia oficial del chart es:

1. base minima;
2. overlays por actividad;
3. overlays por traits;
4. cuentas definidas por el usuario;
5. cuentas temporales o provisionales cuando falta certeza.

Rutas y superficies activas:

- `/app/o/[slug]/settings?tab=chart`
- `/app/o/[slug]/imports?focus=chart_of_accounts_import`
- `/app/o/[slug]/settings/chart-of-accounts/export`

Catalogo actual:

- base `uy-base-sa-general.v1`;
- overlays por actividad `ciiu-*`;
- overlays por traits como `importer`, `exporter`, `mixed-vat`, `multi-currency`, `recurring-services`, `tenders-public-sector`.

### Recommendation engine y modo hibrido

El onboarding y settings soportan:

- recomendacion por reglas;
- alternativas;
- `hybrid_ai_recommended`;
- persistencia en `organization_preset_ai_runs`.

Endpoint activo:

- `/api/preset-ai-recommendation`

Carril cerrado en MVP V1:

- `/api/preset-ai-recommendation/cost-center-draft` responde `410`.

## 7. Mapa contable y lecturas contables

Superficies activas:

- `/app/o/[slug]/chart-map`
- `/app/o/[slug]/trial-balance`
- `/app/o/[slug]/journal-entries`
- `/app/o/[slug]/open-items`

El mapa contable sirve para:

- entender estructura del chart;
- entender impacto por documento;
- navegar relaciones entre regla, template y cuentas;
- inspeccionar read models sin abrir la UI documental.

## 8. Motor fiscal IVA

Uruguay IVA es la vertical fiscal activa.

Reglas oficiales:

- separar preview operativo de corrida oficial;
- no vender conciliacion DGI como filing automatico;
- usar calculo deterministico;
- bloquear o degradar cuando falte dato fiscal critico.

Superficies activas:

- `/app/o/[slug]/tax`
- `/app/o/[slug]/tax/reconciliation`

Tablas y artefactos clave:

- `vat_runs`
- `dgi_reconciliation_runs`
- `dgi_reconciliation_buckets`
- `vat_form_exports`

## 9. Import operations, DUA y FX

Soporte activo hoy:

- import operations;
- documentos asociados;
- tributos de importacion;
- location risk;
- FX policy;
- snapshots monetarios y razonabilidad.

Reglas duras:

- no asumir `fxRate = 1` salvo misma moneda;
- no cruzar settlements entre monedas distintas;
- si falta snapshot confiable, degradar a asistido o bloqueado.

## 10. Cierre y control de periodos

El cockpit de cierre vive en:

- `/app/o/[slug]/close`

Estados fiscales o contables activos:

- `open`
- `ready_to_close`
- `soft_closed`
- `tax_locked`
- `hard_closed`
- `audit_frozen`

Regla de guardrail:

Un documento no debe poder mutar un periodo `soft_closed`, `tax_locked`, `hard_closed` o `audit_frozen` sin proceso formal.

## 11. Imports, auditoria y bridge externo

### `/imports`

Carril de soporte para:

- importacion de chart;
- historicos IVA;
- import operations;
- lotes auxiliares de soporte.

### `/audit`

Carril auditado para planillas mensuales de compras y ventas:

- staging;
- preflight;
- aceptacion o rechazo;
- materializacion a documentos.

Regla de coherencia:

- el carril por planilla debe aplicar la misma politica de duplicados exactos por identidad documental;
- no puede ser mas permisivo que el upload binario normal.

### `/exports`

Carril de salida para:

- export contable por periodo;
- export fiscal de IVA;
- bridge hacia layouts externos.

Tambien existe soporte para conexiones CFE por email y layouts como Zeta.

## 12. Limites actuales y roadmap

### Fuerte hoy

- chart admin;
- rules admin;
- settlement-aware posting;
- VAT Uruguay base;
- DGI reconciliation base;
- close cockpit;
- imports auditados y bridge.

### Parcial

- FX end-to-end mas profundo;
- adapters ERP especificos;
- hard close real con snapshots mas profundos;
- explainability perfectamente uniforme.

### Preparado

- cost centers;
- jobs;
- rentabilidad;
- mas impuestos;
- multi-country.
