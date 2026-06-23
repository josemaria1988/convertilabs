# Convertilabs 2.0 - Baseline de arquitectura

> Documento rector de PR 1. Este archivo fija la verdad oficial de producto y arquitectura para Convertilabs 2.0. Si un documento anterior contradice este baseline, gana este baseline salvo decision explicita posterior.

## 1. Tesis oficial

Convertilabs 2.0 es el sistema operativo integral de gestion de Rontil.

No reemplaza:

- ZetaSoftware;
- la web comercial;
- el email;
- los procesos humanos existentes mientras no haya reemplazo seguro.

Convertilabs conecta, normaliza, relaciona, audita y muestra la operacion real.

La tesis anterior "Convertilabs no es ERP" queda superada como limite funcional. La formulacion correcta es:

> Convertilabs no es un ERP generico ni una suite modular desconectada. Convertilabs es el sistema operativo integral de gestion de Rontil, conectado a ZetaSoftware, web, email y procesos internos.

## 2. Centro conceptual

El centro del sistema deja de ser solamente `document`.

El centro conceptual pasa a ser el hecho operativo de empresa:

```text
hecho operativo
-> party/contacto
-> work_unit/trabajo
-> document/evidencia documental
-> dinero
-> contabilidad
-> IVA/cumplimiento
-> tarea/proceso
-> evidencia
-> Inicio
```

`document` sigue siendo una entidad clave. No se elimina ni se degrada tecnicamente. Lo que cambia es su rol: deja de ser el unico centro del producto.

## 3. Rol de sistemas externos

ZetaSoftware es una fuente externa estructurada y, mas adelante, un posible destino controlado. No es el modelo canonico interno de Convertilabs.

La web sigue siendo canal comercial, catalogo o fuente de cotizaciones/solicitudes. No se reemplaza por Convertilabs.

El email puede ser canal de captura de comunicaciones, cotizaciones, evidencias o avisos. No debe convertirse automaticamente en verdad final sin revision humana.

Los IDs externos de Zeta, web, email u otros sistemas son referencias externas. No son primary keys internas.

## 4. Modelo canónico Convertilabs 2.0

Jerarquia minima del modelo:

- `organization`
- `member`
- `party`
- `contact`
- `work_unit`
- `document`
- `document_line`
- `business_event`
- `financial_event`
- `open_item`
- `payment / collection`
- `journal_entry`
- `tax_period / tax_event`
- `task`
- `process`
- `obligation`
- `interaction`
- `evidence_ref`
- `source_ref`
- `entity_link`
- `integration_raw_record`
- `integration_entity_link`

Reglas:

- `party` es la identidad canonica para clientes, proveedores, bancos, organismos, contactos y terceros.
- `work_unit` es la identidad canonica para trabajos, proyectos, operaciones, obras o centros de costo operativos.
- `business_event` representa hechos operativos relevantes.
- `entity_link` sirve para vinculos flexibles, auxiliares o historicos.
- `entity_link` no reemplaza relaciones criticas que gobiernan dinero, tablero, filtros diarios, permisos o cierre.
- `evidence_ref` y `source_ref` preservan trazabilidad.
- `integration_raw_record` conserva la fuente externa sin perder semantica original.

## 5. Bridges legacy

Estas piezas pueden seguir existiendo por compatibilidad, pero no deben ser la fuente principal para features nuevas si existe entidad canonica:

- `vendors`;
- `customers`;
- `organization_cost_centers`;
- `documents.cost_center_id`;
- modelos o campos equivalentes basados en la tesis documental-contable anterior.

Uso permitido:

- migracion gradual;
- compatibilidad con datos existentes;
- puente hacia `party`;
- puente hacia `work_unit`;
- trazabilidad de integraciones antiguas.

Uso no permitido para features nuevas:

- modelar clientes/proveedores nuevos sin `party`;
- modelar trabajos/proyectos/operaciones solo como cost center legacy;
- resolver dinero o tablero solo por `entity_links` si la relacion es critica;
- usar IDs externos como identidad interna.

## 6. Nueva Palmira como acceptance test principal

El primer circuito operativo que debe validar Convertilabs 2.0 es:

```text
cotizacion o solicitud
-> cliente/contacto
-> trabajo Nueva Palmira
-> documentos de venta
-> documentos de gasto
-> margen documental estimado
-> deudores/acreedores
-> tareas/pendientes
-> Inicio
```

Nueva Palmira no debe ser un dashboard decorativo ni un hardcode de tenant. Debe ser un caso operativo representable con entidades reales o fixtures explicitos.

Si Nueva Palmira no puede mostrar cliente, trabajo, documentos, margen, pendientes y proximas acciones, la refundacion todavia no esta validada.

## 7. Contradicciones detectadas

Contradiccion 1: "Convertilabs no es ERP" como prohibicion.

- Tesis vieja: Convertilabs no es ERP, no es sistema generalista, no cubre ERP full.
- Tesis 2.0: Convertilabs no es ERP generico, pero si es sistema operativo integral de gestion de Rontil.
- Resolucion: la frase vieja solo puede sobrevivir si aclara "no ERP generico ni suite desconectada".

Contradiccion 2: jobs, centros de costo, rentabilidad y margen fuera del core.

- Tesis vieja: rentabilidad, jobs, centros de costo o margen estaban fuera del core o postergados.
- Tesis 2.0: `work_unit`, margen basico y relacion venta/gasto/trabajo son centrales.
- Resolucion: los docs viejos deben marcar esa exclusion como legacy.

Contradiccion 3: documento como centro unico.

- Tesis vieja: documento -> clasificacion -> asiento -> IVA era el flujo dominante.
- Tesis 2.0: hecho operativo -> party -> work_unit -> document -> dinero -> contabilidad/IVA -> tarea/proceso -> Inicio.
- Resolucion: conservar el motor documental, pero subordinarlo al modelo operativo.

Contradiccion 4: Zeta como borde tecnico versus fuente operativa.

- Tesis vieja: Zeta aparecia principalmente como integracion fiscal/contable/documental.
- Tesis 2.0: Zeta es fuente externa estructurada de contactos, comprobantes, centros de costo, datos contables y saldos cuando aplique.
- Resolucion: Zeta no manda el modelo interno; alimenta raw records, source refs y entidades canonicas.

Contradiccion 5: mobile/docs de campo con alcance reducido.

- Algunos documentos mobile excluyen rentabilidad o jobs complejos por alcance de pantalla.
- Esa restriccion puede ser valida para mobile MVP, pero no para el producto completo.
- Resolucion: aclarar "fuera de mobile MVP" en vez de "fuera de Convertilabs".

## 8. Agent rules

`docs/agent_rules.md` es la guia operativa vigente para Codex.

Debe permanecer alineado con este baseline y no debe volver a depender de documentos legacy retirados.

## 9. Documentacion legacy retirada

La reorganizacion documental de 2026-06-23 retiro o absorbio:

- documentacion unificada historica;
- plan maestro v1;
- documento refundacional extenso;
- docs `00-*` a `03-*`;
- specs mobile/PWA;
- spec Zeta v1 y backlog Zeta antiguo;
- auditoria KEEP/REWRITE/DELETE anterior;
- notas de PR antiguas ya absorbidas por el analisis y plan actual;
- documento largo de tesoreria usado como prompt/especificacion temporal.

La informacion que sobrevive queda consolidada en:

- `docs/convertilabs-2.0-baseline-arquitectura.md`;
- `docs/analisis-arquitectura-convertilabs-2.0.md`;
- `docs/plan_de_accion_convertilabs2_PRs_analisis.md`;
- `docs/agent_rules.md`;
- referencias tecnicas Zeta y piloto listadas en `docs/README.md`.

## 10. Referencias tecnicas vigentes

Siguen dentro de `docs/` por valor tecnico directo:

- `docs/zetasoftware-endpoints-contract.md`;
- `docs/zetasoftware-bandeja-contract-notes.md`;
- `docs/pr-next-zeta-posting-templates-role-map.md`;
- `docs/Api ZetaSoftware collection.json`;
- `docs/samples/*.json`;
- `docs/pr-13-hardening-piloto-interno.md`;
- `docs/piloto-interno-rontil-hallazgos.md`.

Estas referencias no reemplazan la tesis de producto. Si contradicen este baseline, se corrigen o se subordinan.

## 11. Reglas de PR 1

Este PR es documental.

No toca:

- codigo productivo;
- schema;
- migraciones;
- RLS;
- integraciones reales;
- escrituras a Zeta;
- UI productiva.

Verificacion proporcional:

- revisar busquedas de contradicciones en docs;
- confirmar archivos modificados;
- no correr migraciones;
- no correr typecheck si no se toca TypeScript.

## 12. Hito documental

Fecha: 2026-06-23.

Commit sugerido:

```text
docs: consolidar base documental Convertilabs 2.0
```

Este hito marca el punto en que la documentacion oficial deja de estar repartida en planes, backlogs y notas historicas, y pasa a tener una base reducida para PRs futuros.

## 13. Estado

Este baseline no implementa PR 2 ni siguientes.

Quedan fuera de este PR:

- cambios de navegacion;
- cambio visible `Tesoreria` vs `Dinero`;
- modelo de bridges legacy detallado;
- fixture Nueva Palmira;
- Zeta read-only validation;
- intake de cotizaciones;
- dinero canonico;
- dashboard ejecutivo nuevo;
- procesos/continuidad nuevos.
