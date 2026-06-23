# Convertilabs 2.0 - Modelo canonico y bridges legacy

## Estado

Documento de PR 3. Define jerarquia entre entidades canonicas y estructuras legacy.

## Canon manda sobre legacy

Para features nuevas:

- `party` manda sobre `vendor` y `customer`;
- `work_unit` manda sobre `organization_cost_centers`;
- `documents.work_unit_id` manda sobre `documents.cost_center_id`;
- `ledger_open_items.party_id` y `ledger_open_items.work_unit_id` mandan para dinero;
- `tasks.party_id` y `tasks.work_unit_id` mandan para accion operativa;
- `work_intake_items.party_id` y `work_intake_items.work_unit_id` mandan para solicitudes comerciales;
- `interactions` y `interaction_links` capturan historial, pero no reemplazan FK criticas.

## Entidades auditadas

Existentes en schema/codigo:

- `parties`
- `contacts`
- `party_roles`
- `party_identifiers`
- `work_units`
- `work_intake_items`
- `organization_cost_centers`
- `vendors`
- `customers`
- `documents`
- `documents.cost_center_id`
- `business_events`
- `entity_links`
- `evidence_refs`
- `integration_raw_records`
- `integration_entity_links`
- `document_source_refs`

## Uso permitido de legacy

`vendors`, `customers`, `organization_cost_centers` y `documents.cost_center_id` pueden sobrevivir como:

- compatibilidad con datos anteriores;
- puente de migracion;
- fuente auxiliar para completar party/work_unit;
- evidencia historica.

No deben usarse como identidad principal para nuevas features.

## Relaciones criticas

Estas relaciones deben tender a columna directa:

- `documents.party_id`
- `documents.customer_party_id`
- `documents.vendor_party_id`
- `documents.work_unit_id`
- `ledger_open_items.party_id`
- `ledger_open_items.work_unit_id`
- `tasks.party_id`
- `tasks.work_unit_id`
- `work_intake_items.party_id`
- `work_intake_items.work_unit_id`
- `interactions` via participantes/links y FK cuando aplique;
- `business_events.party_id`
- `business_events.work_unit_id`

`entity_links` se usa para vinculos flexibles, secundarios o de auditoria. No debe esconder relaciones que gobiernan tablero, dinero, filtros diarios, permisos, cierre o IVA.

## Zeta mapping

Estrategia:

- Zeta Contacto -> `party`, `contact`, `party_identifier`, `integration_entity_links`;
- Zeta CentroCosto -> `work_unit` o mapping pendiente de revision;
- Zeta Comprobante/Factura -> `document`, `document_source_refs`, `integration_raw_records`;
- Zeta raw payload -> `integration_raw_records`;
- Zeta external ID -> referencia externa, nunca PK interna.

## Intake operativo

`work_intake_items` es la bandeja previa a trabajo/documento/dinero.

Debe usarse para:

- cotizaciones recibidas desde web;
- emails comerciales revisables;
- llamadas, WhatsApp o pedidos manuales;
- oportunidades que todavia no justifican crear venta ni documento;
- seguimiento humano antes de convertir en `work_unit`.

No debe usarse para:

- reemplazar `work_unit`;
- inventar documentos;
- crear ventas finales;
- marcar oportunidades ganadas sin decision humana;
- esconder relaciones criticas en `entity_links`.

## Deuda vigente

- Hay UI y servicios que todavia presentan cost centers o proyectos legacy por compatibilidad.
- La asociacion documental debe seguir migrando hacia `work_unit_id`.
- Los casos ambiguos de Zeta deben quedar en revision humana, no crear duplicados silenciosos.
- Tesoreria y Dinero deben permanecer conectados para que open items, bancos y vales no den lecturas contradictorias.
