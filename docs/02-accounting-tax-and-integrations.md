# 02 - Accounting, Tax And Integrations

## Para Que Existe Este Documento

Este documento define como contabilidad, IVA, cierre e integraciones sobreviven a la refundacion y se conectan al modelo operativo de empresa.

Leerlo si vas a tocar:

- kernel contable;
- templates, roles y reglas;
- IVA Uruguay;
- cierre;
- open items, pagos, cobros o settlements;
- Zeta e integraciones externas;
- imports/exports.

## 1. Regla Principal

Contabilidad, IVA y cierre no son islas. Son consecuencias estructuradas de hechos operativos de empresa.

Flujo objetivo:

```text
business_event
-> party
-> work_unit
-> document/evidence
-> money
-> accounting
-> tax
-> task/blocker
-> Inicio
```

## 2. Modelo Contable Conservado

Se conserva el modelo multilinea:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> cuentas por rol
-> preview multilinea
-> posting
-> open item / settlement cuando aplica
```

Una factura no se reduce a elegir una cuenta. El template, la contrapartida, el IVA, el party y el work unit importan.

## 3. Conexion Con El Modelo Madre

Las nuevas integraciones contables deben apuntar a:

- `party_id` como contraparte canonica;
- `work_unit_id` como trabajo, proyecto, operacion o centro de costo canonico;
- `business_event_id` cuando haya hecho operativo;
- `evidence_ref_id` o source refs para prueba;
- `entity_links` para relaciones no criticas o transversales.

Mientras se migra, `vendors`, `customers` y `organization_cost_centers` pueden seguir funcionando como puente legacy, pero el codigo nuevo debe preferir `parties` y `work_units`.

## 4. Open Items, Pagos Y Cobros

`ledger_open_items` es la base tecnica existente para deudores y acreedores.

El dominio `money` debe elevarlo a experiencia operativa:

- cuentas a cobrar;
- cuentas a pagar;
- vencimientos;
- pagos;
- cobros;
- settlements;
- banco y caja en etapas posteriores;
- resumen por party y work unit.

## 5. IVA Uruguay

IVA Uruguay sigue siendo la vertical fiscal inicial.

Se conserva:

- calculo deterministico;
- preview operativo separado de corrida oficial;
- bloqueo cuando faltan datos criticos;
- trazabilidad por periodo;
- exportaciones fiscales cuando correspondan.

Se agrega:

- visibilidad en Inicio;
- obligaciones y tareas asociadas;
- relacion con work units cuando una operacion lo requiera;
- bloqueos accionables para cierre y continuidad.

## 6. Cierre

El cierre conserva su enfoque validator-first.

Debe conectarse con:

- documentos pendientes;
- open items;
- IVA;
- tareas;
- obligaciones;
- bloqueos visibles en Inicio;
- evidencia de decisiones.

Un cierre no debe ocultar por que algo no puede avanzar.

## 7. Reglas Y Aprendizaje

Se conserva la idea de convertir decisiones humanas en memoria reusable.

La memoria ya no es solo contable. Puede abarcar:

- clasificacion de proveedores;
- asociacion habitual a trabajos;
- formas de pago;
- pasos administrativos;
- documentos requeridos por contador;
- criterios de bloqueo;
- preparacion de tramites.

Las reglas criticas requieren aprobacion humana y trazabilidad.

## 8. Zeta E Integraciones

Zeta es fuente o destino externo, no modelo interno.

Mapeo objetivo:

```text
Zeta Contacto -> party
Zeta RUT -> party_identifier
Zeta CentroCostos -> work_unit o mapping externo
Zeta CFE -> document + source ref
Zeta asiento -> journal_entry externo o export
Zeta Bandeja Entrada Asientos -> destino de export
```

Regla:

> Zeta se adapta a Convertilabs; Convertilabs no se subordina a Zeta.

## 9. Integracion Auditable

Todo import/export debe preservar:

- raw record;
- sync run;
- payload hash;
- source refs;
- mapping a entidad local;
- errores visibles;
- usuario o proceso que confirmo;
- estado de drift si el origen cambia.

No materializar datos externos ambiguos como verdad final sin staging, regla segura o revision.

## 10. Tests Esperados

Cuando esta capa se toque, agregar o mantener pruebas para:

- asiento multilinea balanceado;
- party/work_unit preservados;
- open item generado correctamente;
- settlement con moneda segura;
- IVA sin perdida de elegibilidad;
- cierre con bloqueo visible;
- integracion externa sin fuga entre organizaciones.
