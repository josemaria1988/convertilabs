# Estado Actual Del Proyecto, Kernel Contable Y Motor Fiscal

Fecha de corte: `2026-03-19`
Branch analizada: `testing`
Commit base: `b61af8e`

## 1. Resumen ejecutivo

Convertilabs ya no es solo un intake documental con IA. En el estado actual del repo ya existe una arquitectura contable y fiscal bastante avanzada para un MVP:

- entrada documental por archivo original;
- entrada masiva por planilla auditada con staging y preview;
- extraccion factual estructurada;
- motor deterministico de clasificacion contable y fiscal;
- segunda IA acotada para desempate o contexto;
- posting provisional y final;
- libro diario inmutable;
- partidas abiertas;
- balance de comprobacion;
- preview y corrida oficial de IVA;
- conciliacion DGI base;
- bridge de exportacion contable y fiscal.

La base arquitectonica para operar cierres mensuales de IVA y generar balancetes existe y es seria.

La parte que todavia no esta cerrada para un circuito contable-financiero completo de estudio o empresa es otra: faltan piezas de cierre contable mensual/anual, ajustes manuales, cierre de resultados, arrastre de saldos, reportes financieros formales y motores tributarios mas alla de IVA.

En otras palabras:

- el proyecto ya puede sostener una contabilidad documental y fiscal operativa de IVA;
- el proyecto ya puede producir un trial balance mensual basado en asientos posteados e inmutables;
- el proyecto todavia no tiene completo el proceso de cierre anual y emision de estados contables generales.

## 2. Que es hoy Convertilabs

Segun `docs/00-foundations/00-vision-rectora-v1.md`, el producto se posiciona como:

- capa de decision fiscal para Uruguay;
- capa de estructuracion contable explicable;
- capa de control operativo por documento;
- puente hacia ERP, estudio o planilla externa.

El repositorio ya materializa esa tesis en superficies reales:

- `Documentos`: bandeja operativa, revision y posting.
- `Auditoria`: importacion masiva auditada por planilla con preview antes de materializar.
- `Contabilidad`: balance, diario y open items como read models.
- `Impuestos`: IVA mensual, lifecycle y conciliacion DGI.
- `Mapa contable`: navegacion e impacto del plan.
- `Configuracion`: perfil fiscal, plan de cuentas, presets, conexiones y soporte.

## 3. Modulos funcionales ya existentes

### 3.1 Identidad, tenancy y seguridad

El stack de identidad y tenancy ya esta operativo con Supabase SSR:

- `profiles`
- `organizations`
- `organization_members`
- guards server-side en `modules/auth/server-auth.ts`

Esto significa que los datos contables/fiscales ya estan pensados para trabajar por organizacion, con roles y trazabilidad por usuario.

### 3.2 Organizacion, perfil fiscal y bootstrap

La organizacion no es solo un tenant vacio. Tiene bootstrap operativo:

- perfil fiscal versionado;
- snapshots normativos;
- business profile por actividad y traits;
- preset recommendation engine;
- aplicacion de presets sobre plan de cuentas.

Eso vive principalmente en:

- `modules/organizations/*`
- `modules/accounting/presets/*`
- `app/app/o/[slug]/settings/page.tsx`

El efecto importante para contabilidad es que la configuracion no reescribe historia. Los documentos confirmados quedan anclados al snapshot vigente al momento de postear.

### 3.3 Plan de cuentas y roles sistemicos

El plan de cuentas ya tiene metadata suficiente para contabilidad real:

- `account_type`
- `normal_side`
- `natural_balance`
- `chapter_code`
- `presentation_code`
- `statement_section`
- `external_code`
- `tax_profile_hint`
- `currency_policy`
- `requires_party`
- `reconciliable`
- `include_fx_revaluation`
- `cost_center_policy`

Eso esta en `db/schema/03_master_data.sql`.

Ademas, el kernel usa `account_role_bindings` y roles sistemicos para resolver cuentas estructurales:

- ventas
- gastos
- IVA compras
- IVA ventas
- cuentas a cobrar
- cuentas a pagar
- caja
- banco
- clearing de tarjeta
- clearing de cheque
- cuentas temporales para contado no probado

Eso permite que la decision contable no dependa solo de “una cuenta principal”, sino de una plantilla con roles.

### 3.4 Documentos y Auditoria

Hoy hay dos carriles de entrada documental:

1. `Documentos`
   - upload de originales;
   - pipeline IA/OCR;
   - revision contable/fiscal;
   - posting;
   - bandeja operativa.

2. `Auditoria`
   - importacion masiva desde planillas;
   - background run;
   - preview estructurado;
   - aceptacion/rechazo total o parcial;
   - materializacion controlada;
   - historico por usuario, fecha y batch.

Esto ya resuelve un problema clave del MVP: no mezclar operatoria diaria con carga masiva de historicos o spreadsheets de terceros.

### 3.5 Contabilidad

La capa contable esta separada en dos mundos:

1. decision contable sobre borradores;
2. ledger posteado e inmutable.

Esto es correcto y sano.

### 3.6 Impuestos

El motor fiscal activo real hoy es IVA Uruguay:

- preview mensual;
- corrida oficial;
- estados `draft / needs_review / reviewed / finalized / locked`;
- export fiscal;
- baseline manual de conciliacion DGI;
- soporte inicial de IVA importacion y anticipos.

### 3.7 Exportaciones e integraciones

Existe un bridge real de salida:

- dataset contable exportable;
- dataset fiscal de IVA;
- resumen DGI canonico;
- external layouts;
- soporte para planillas y ERP externo.

## 4. Flujo de trabajo end-to-end

## 4.1 Ingreso documental

Los documentos pueden entrar:

- por upload privado de PDF/JPG/PNG;
- por correo CFE;
- por planilla auditada en `Auditoria`;
- por carriles especiales de importaciones/DUA.

El intake extrae:

- identidad;
- fecha;
- emisor/receptor;
- moneda;
- cotizacion;
- subtotal;
- IVA;
- total;
- lineas/conceptos;
- hints de settlement;
- evidencia textual.

El contrato de extraccion esta tipado en `modules/ai/document-intake-contract.ts`.

## 4.2 Enriquecimiento contable y fiscal

Una vez extraido el draft, el sistema deriva:

- vendor resolution;
- invoice identity y duplicate detection;
- concept resolution;
- accounting context;
- settlement context;
- tratamiento IVA;
- preview de asiento.

La funcion central hoy es `deriveDocumentAccountingState(...)` en `modules/accounting/runtime.ts`.

## 4.3 Revision humana

La UI de revision permite:

- corregir hechos;
- confirmar montos;
- decidir operacion;
- agregar contexto contable;
- override manual;
- aprobar aprendizaje reusable;
- postear provisional;
- confirmar final.

## 4.4 Posting

El posting ya no es un simple “guardar sugerencia”. El flujo real crea artefactos formales:

- `source_events`
- `source_event_facts`
- `posting_proposals`
- `journal_entries`
- `journal_entry_lines`
- `ledger_open_items`
- `ledger_settlement_links`

Esto es muy importante: el sistema ya tiene un kernel transaccional serio, no solo un asistente documental.

## 5. Como funciona hoy el kernel contable

## 5.1 Naturaleza del kernel

El kernel vive principalmente en:

- `modules/accounting/runtime.ts`
- `modules/accounting/suggestion-engine.ts`
- `modules/accounting/rule-engine.ts`
- `modules/accounting/template-resolver.ts`
- `modules/accounting/journal-entry-builder.ts`
- `modules/accounting/kernel.ts`

La secuencia del kernel es:

1. cargar contexto runtime;
2. resolver proveedor;
3. resolver conceptos;
4. leer contexto manual persistido;
5. evaluar razonabilidad geografica;
6. decidir si hace falta contexto humano;
7. opcionalmente correr segunda IA;
8. resolver regla contable por precedencia;
9. resolver settlement;
10. resolver tratamiento IVA;
11. construir preview de asiento;
12. consolidar blockers y readiness.

## 5.2 Precedencia real del motor

La precedencia contable actual es:

1. `manual_override`
2. `document_override`
3. `vendor_concept_operation_category`
4. `vendor_concept`
5. `concept_global`
6. `vendor_default`
7. `assistant`
8. `manual_review`

Esto esta definido en `modules/accounting/rules.ts` y `modules/accounting/rule-engine.ts`.

La implicancia es muy buena:

- el sistema favorece reglas auditables y reutilizables;
- la IA entra tarde, acotada;
- si no hay confianza suficiente, cae a revision, no inventa.

## 5.3 Settlement como parte del modelo contable

Uno de los avances mas importantes del repo es que el settlement ya esta modelado como parte del kernel, no como un apendice.

Hoy el sistema distingue:

- `sale_invoice`
- `purchase_invoice`
- `customer_receipt`
- `supplier_payment`
- `sale_credit_note`
- `purchase_credit_note`
- `card_settlement`
- `bank_transfer_settlement`
- `manual_settlement_adjustment`

Y tambien modela:

- `paymentTerms`: contado / credito / unknown
- `settlementMethod`: efectivo / transferencia / tarjeta / cheque / mixed / unknown
- `settlementStatus`
- `settlementAllocations`
- `openItemKind`

Esto esta en `modules/accounting/types.ts` y `modules/accounting/template-resolver.ts`.

Con esto el sistema ya puede diferenciar, por ejemplo:

- factura a credito que abre cuenta corriente;
- factura contado que liquida en el propio documento;
- factura contado con clearing por medio no probado;
- recibo de cobranza separado;
- pago a proveedor separado;
- liquidacion de tarjeta posterior.

## 5.4 Open items y subledger

El proyecto ya tiene subledger operativo para cuentas a cobrar y pagar:

- `ledger_open_items`
- `ledger_settlement_links`
- `modules/accounting/open-items.ts`
- UI en `/open-items`

Cuando el documento es factura a credito:

- crea open item.

Cuando el documento es recibo/pago/nota de credito:

- intenta cancelar partidas previas;
- crea settlement links;
- puede dejar residual credit balance.

Esto es una base muy fuerte para cierres mensuales y analisis de saldos.

## 5.5 Inmutabilidad y trazabilidad del libro

Una fortaleza muy importante del diseño actual es la inmutabilidad del ledger.

`journal_entries` tiene:

- `entry_number`
- `fiscal_period_id`
- `immutable_at`
- `reverses_journal_entry_id`
- `reversed_by_journal_entry_id`
- `adjusts_journal_entry_id`
- `economic_hash`
- `source_hash`

Y el schema ya impone:

- no postear fuera del periodo;
- no postear en periodo cerrado/bloqueado;
- no finalizar asientos descuadrados;
- no mutar lineas de asientos inmutables;
- solo permitir cambios muy acotados sobre asientos inmutables.

Eso esta en `db/schema/05_accounting.sql`.

Desde el punto de vista de auditoria y estudio contable, esta es una base excelente.

## 6. Read models y reporting contable existentes

## 6.1 Libro diario

Existe vista de lectura:

- `v_journal_entries_read`
- UI en `/journal-entries`

Muestra:

- asiento;
- fecha;
- estado;
- fuente;
- periodo;
- referencia;
- total funcional;
- linaje;
- open items;
- settlements;
- snapshot y source event.

## 6.2 Balance de comprobacion

Existe `v_trial_balance` y UI en `/trial-balance`.

Hoy el balance:

- agrupa por cuenta;
- filtra por periodo mensual;
- filtra por fuente;
- muestra debe/haber/saldo;
- muestra mayor por cuenta;
- muestra totales de balance general y estado de resultados.

Tambien existen las vistas:

- `v_balance_sheet`
- `v_income_statement`

Y funciones de presentacion en `modules/accounting/read-models.ts`.

Esto quiere decir que el proyecto ya puede calcular:

- saldo por cuenta;
- totales patrimoniales;
- totales de ingresos y gastos.

## 6.3 Limitacion actual del reporting

Aunque esas vistas existen, hoy la experiencia visible sigue siendo un workspace de inspeccion, no un modulo formal de estados contables.

Faltan:

- reporte formal de balance general;
- reporte formal de estado de resultados;
- comparativos intermensuales;
- acumulado anual;
- columnas apertura / movimientos / cierre;
- arrastre entre ejercicios;
- emision cerrada de estados.

## 7. Como funciona hoy el motor IVA

## 7.1 Arquitectura fiscal actual

El motor de IVA se concentra en:

- `modules/tax/uy-vat-engine.ts`
- `modules/tax/vat-run-preview.ts`
- `modules/tax/vat-runs.ts`
- `modules/tax/dgi-reconciliation.ts`
- `app/app/o/[slug]/tax/page.tsx`
- `app/app/o/[slug]/tax/reconciliation/page.tsx`

## 7.2 Logica de determinacion IVA

El engine ya distingue:

- ventas;
- compras;
- buckets output/input;
- credito directo;
- credito indirecto;
- no deducible;
- prorrata;
- IVA importacion;
- anticipos.

Tambien integra:

- perfil fiscal organizacional;
- snapshot normativo;
- location risk;
- categoria operativa;
- linked operation type;
- hints del documento;
- montos originales y funcionales.

## 7.3 Preview y corrida oficial

Para cada mes, hoy el sistema ya puede:

1. construir preview del periodo;
2. generar corrida oficial;
3. revisar;
4. finalizar;
5. bloquear;
6. reabrir;
7. exportar.

Esto vive en `modules/tax/vat-runs.ts` y `app/app/o/[slug]/tax/page.tsx`.

La UI actual del workspace ya soporta seleccion de mes y año, diferenciando:

- periodo abierto sin cierre;
- periodo con corrida oficial;
- periodo cerrado/reporte.

## 7.4 Conciliacion DGI

Existe un carril base de conciliacion DGI:

- carga manual de baseline por bucket;
- comparacion contra dataset del run;
- buckets de diferencia;
- notas de justificacion;
- cierre de corrida de conciliacion.

Esto es util, pero todavia es una conciliacion manual/asistida, no una integracion directa contra DGI.

## 8. Que ya existe para cierres mensuales

Hoy el repo ya tiene varias piezas correctas para un cierre mensual:

- documentos versionados por revision;
- posting provisional y final;
- period guardrails;
- libro inmutable;
- balance de comprobacion mensual;
- open items;
- IVA mensual por periodo;
- conciliacion DGI base;
- exportacion contable;
- exportacion fiscal;
- trazabilidad por usuario;
- snapshots de configuracion hacia adelante.

Eso significa que febrero 2026, por ejemplo, ya puede tratarse como unidad operativa:

- se filtran documentos de febrero;
- se postean;
- se corre IVA de febrero;
- se ve trial balance de febrero;
- se ve diario de febrero;
- se ven open items abiertos en ese corte.

## 9. Que falta para un cierre mensual contable realmente completo

Este es el bloque mas importante para trabajar con contadores.

## 9.1 Cierre contable mensual formal

Existe `fiscal_periods`, pero falta una experiencia completa de cierre mensual contable.

Hoy hay:

- auto-apertura mensual al postear;
- bloqueo por periodo cerrado o lock;
- guardrails de fecha.

Falta:

- UI dedicada de apertura/cierre/lock del periodo contable;
- checklist de cierre mensual;
- semaforos de “periodo listo para cerrar”;
- control de pendientes por area:
  - documentos sin revisar
  - provisionales sin recategorizar
  - partidas abiertas sin soporte
  - IVA no finalizado
  - conciliacion DGI pendiente
  - export pendiente

## 9.2 Asientos manuales y ajustes de cierre

Este es probablemente el gap mas grande del kernel para estudio/empresa.

Hoy el sistema genera asientos desde documentos y eventos relacionados, pero no vi una UI madura para:

- asiento manual puro;
- provisiones;
- devengamientos;
- depreciaciones;
- amortizaciones;
- reclasificaciones contables de cierre;
- ajustes impositivos;
- diferencias de cambio de cierre;
- regularizaciones no respaldadas por documento.

Sin eso, el trial balance existe, pero no alcanza para un cierre contable integral.

## 9.3 Revaluacion y diferencia de cambio de cierre

El proyecto ya soporta:

- moneda original;
- funcional UYU;
- FX rate;
- BCU lookup;
- snapshots monetarios.

Pero falta el proceso de cierre multimoneda:

- reexpresar saldos monetarios al cierre;
- calcular diferencias de cambio no realizadas;
- postear asiento de revaluacion;
- revertir o arrastrar esas diferencias segun politica.

Esto es clave si vas a cerrar balances con cuentas en USD.

## 9.4 Bancos y conciliacion bancaria

Hoy el settlement documental y open items ayudan mucho, pero no sustituyen:

- conciliacion bancaria;
- import de extractos;
- matching contra recibos/pagos;
- control de partidas en transito.

Para balance anual serio, bancos sin conciliacion siguen siendo un riesgo fuerte.

## 9.5 Activo fijo

No existe todavia un subledger de activo fijo con:

- altas;
- bajas;
- vida util;
- depreciacion mensual;
- valor residual;
- ajustes.

Esto impacta directamente en balance general y resultado.

## 9.6 Inventario y costo de ventas

No existe un modulo productivo de stock/costo:

- sin valorizacion de existencias;
- sin costo de ventas automatico;
- sin cierre de inventario.

Para empresas comerciales/industriales esto limita la calidad del balance anual y del resultado mensual.

## 9.7 Payroll, BPS y otras obligaciones

No estan operativos:

- payroll;
- BPS;
- IRAE;
- IPAT;
- ICOSA;
- retenciones varias como motor completo.

IVA esta adelantado; el resto todavia no.

## 10. Que falta especificamente para balance anual general

Si el objetivo es confluir balancetes mensuales en un balance anual general, hoy faltan al menos estas capacidades:

## 10.1 Cierre de resultados

No aparece implementado un proceso formal de:

- cierre de cuentas de ingresos;
- cierre de cuentas de gastos;
- determinacion del resultado del ejercicio;
- traspaso a patrimonio / resultados acumulados.

Hoy puede verse el estado de resultados mensual, pero no el cierre anual del ejercicio.

## 10.2 Apertura del ejercicio siguiente

No veo implementado un servicio formal para:

- generar asiento de apertura;
- arrastrar solo cuentas patrimoniales;
- resetear cuentas de resultado;
- mantener linaje entre cierre y apertura.

## 10.3 Estados financieros formales

Existen las bases de datos y algunos agregados, pero faltan:

- balance general formal por fecha de cierre;
- estado de resultados acumulado anual;
- comparativo contra ejercicio anterior;
- notas/anexos;
- estructura presentacional configurable para asesores.

## 10.4 Reporte anual fiscal-contable consolidado

Tampoco existe un “cierre anual pack” que reúna:

- balance;
- resultados;
- trial balance;
- IVA mensuales del año;
- conciliaciones DGI;
- exportaciones emitidas;
- ajustes manuales;
- movimientos posteriores al cierre.

## 10.5 Control de integridad de cierre

Falta un motor de validacion de cierre que responda preguntas como:

- hay cuentas provisionales pendientes;
- hay documentos de un mes cerrados despues del cierre;
- hay partidas abiertas incoherentes;
- el IVA del mes fue reabierto;
- el diario del periodo tiene asientos draft;
- el libro esta balanceado despues de ajustes;
- existen diferencias materiales no justificadas.

## 11. Evaluacion del IVA frente al objetivo operativo

Para liquidar IVA mensual, el proyecto ya tiene bastante base real.

Fortalezas actuales:

- engine deterministico;
- tax buckets;
- preview del periodo;
- corrida oficial;
- lifecycle;
- import VAT;
- export dataset;
- baseline DGI;
- bloqueo por reapertura/cierre.

Gaps para operacion fiscal mas madura:

- UX de cierre y seguimiento mas compacta;
- report pack mensual mas formal;
- conectores o imports mas sistematicos para baseline DGI;
- mayor cobertura de edge cases fiscales;
- mas explainability fiscal transversal.

## 12. Evaluacion del balancete frente al objetivo operativo

Para balancete mensual, la base es buena:

- diario inmutable;
- lineas balanceadas;
- trial balance por mes;
- mayor por cuenta;
- balance sheet / income statement como vistas;
- partidas abiertas como subledger.

Pero todavia es un balancete de inspeccion operativa, no un cierre mensual integral.

Le falta:

- asientos manuales y ajustes;
- cierre mensual formal;
- consistencia con bancos, activo fijo, inventario, payroll e impuestos no IVA;
- estados financieros listos para emision.

## 13. Calidad, testing y confiabilidad tecnica

La suite es amplia para el tamaño del MVP.

Hay `52` archivos de prueba, incluyendo cobertura sobre:

- kernel contable;
- sugerencia contable;
- read models;
- period guardrails;
- open items;
- VAT preview;
- DGI reconciliation;
- imports;
- spreadsheets;
- audit preview;
- document processing;
- FX BCU;
- chart map;
- export adapters.

No reemplaza UAT contable/fiscal, pero muestra que la arquitectura esta siendo validada por dominio y no solo por UI.

## 14. Diagnostico sintetico por capa

### Muy bien encaminado

- trazabilidad documental;
- kernel transaccional;
- inmutabilidad del diario;
- open items;
- IVA mensual;
- auditabilidad de importaciones;
- plan de cuentas con metadata rica;
- read models contables.

### Operativo pero aun parcial

- multimoneda end-to-end;
- explainability uniforme;
- conciliacion DGI profunda;
- bridge ERP especifico;
- importaciones internacionales completas.

### Faltante critico para cierre anual

- asientos manuales;
- workflow de cierre mensual contable;
- workflow de cierre anual;
- traspaso de resultado del ejercicio;
- apertura de ejercicio siguiente;
- revaluacion FX de cierre;
- estados financieros formales;
- modulos auxiliares para activo fijo, bancos, inventario y payroll.

## 15. Recomendacion de roadmap

Si el objetivo de negocio inmediato es poder liquidar IVA, cerrar meses y construir un balance anual general, el roadmap sugerido seria:

### Fase 1: cerrar bien el IVA mensual

- consolidar UX de `Impuestos` por periodo;
- checklist de cierre IVA;
- reporte mensual exportable;
- endurecer conciliacion DGI;
- validar edge cases con asesores.

### Fase 2: cerrar el mes contable

- UI de periodos contables;
- asientos manuales y ajustes;
- checklist de cierre mensual;
- lock contable operacional;
- alertas de provisionales, documentos reabiertos y open items.

### Fase 3: sostener balance anual

- cierre de ingresos/gastos;
- asiento de resultado del ejercicio;
- apertura de ejercicio siguiente;
- balance general y estado de resultados formales;
- comparativos y pack anual.

### Fase 4: profundizar calidad contable

- revaluacion FX;
- conciliacion bancaria;
- activo fijo;
- inventario/costo;
- obligaciones tributarias no IVA.

## 16. Conclusion

Convertilabs ya tiene hoy una arquitectura suficientemente madura para dejar de pensarlo como “OCR + sugerencia contable” y empezar a gobernarlo como un mini-core contable/fiscal document-driven.

El proyecto ya puede soportar:

- IVA mensual;
- balancetes mensuales tecnicamente consistentes;
- diario y subledger trazables;
- exportacion y auditabilidad.

Lo que todavia no puede hacer de punta a punta, sin desarrollos adicionales, es:

- cierre mensual contable integral;
- cierre anual del ejercicio;
- emision completa de balance general anual con todos los auxiliares y ajustes necesarios.

La buena noticia es que los cimientos para construir eso ya estan puestos en el schema, el ledger, el motor de decision y los read models. El siguiente tramo no parece una reescritura; parece una expansion ordenada sobre una base correcta.
