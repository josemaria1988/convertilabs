# Agent Rules - Convertilabs 2.0

## 0. Proposito

Este archivo es la guia operativa para Codex dentro de Convertilabs.

Convertilabs 2.0 no es un motor documental-contable-fiscal aislado. Tampoco es un ERP generico ni una suite modular desconectada. Convertilabs es el sistema operativo integral de gestion de Rontil, conectado a ZetaSoftware, web, email, documentos, trabajos, contactos, ventas, compras, dinero, contabilidad, IVA, tareas, procesos, vencimientos, evidencia y tablero ejecutivo.

## 1. Fuentes oficiales

Lectura obligatoria antes de cambios importantes:

1. `docs/convertilabs-2.0-baseline-arquitectura.md`
2. `docs/analisis-arquitectura-convertilabs-2.0.md`
3. `docs/plan_de_accion_convertilabs2_PRs_analisis.md`
4. `docs/agent_rules.md`
5. `docs/README.md`

Los documentos legacy retirados o historicos no son fuente de verdad. Si aparece una referencia vieja que contradice estos documentos, gana Convertilabs 2.0.

## 2. Tesis oficial

La unidad conceptual no es solo `document`.

La unidad conceptual es el hecho operativo de empresa:

```text
hecho operativo
-> party/contacto
-> work_unit/trabajo
-> document/evidencia
-> dinero
-> contabilidad
-> IVA/cumplimiento
-> tarea/proceso
-> evidencia/source ref
-> Inicio
```

Toda decision de producto o ingenieria debe ayudar a:

1. capturar hechos reales;
2. conectar esos hechos con personas, trabajos, documentos, dinero, impuestos, tareas y evidencia;
3. reducir dependencia de memoria humana;
4. mostrar estado operativo claro;
5. preservar trazabilidad;
6. responder que esta pasando y que hay que hacer ahora;
7. convertir conocimiento repetible en proceso reusable.

## 3. Entidades canonicas

Para features nuevas, usar como modelo madre:

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
- `payment` / `collection`
- `journal_entry`
- `tax_period` / `tax_event`
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

- `party` manda sobre `vendor` y `customer`.
- `work_unit` manda sobre `cost_center` para nuevas features.
- `document` sigue siendo clave, pero no es el unico centro.
- `business_event` representa hechos operativos relevantes.
- `entity_link` sirve para vinculos flexibles, no para esconder relaciones criticas.
- Zeta external IDs son referencias externas, no primary keys internas.
- `vendors`, `customers`, `organization_cost_centers` y campos legacy equivalentes solo pueden sobrevivir como bridges o compatibilidad.

## 4. Relaciones criticas

Si una relacion gobierna dinero, tablero, filtros diarios, permisos, cierre, IVA o experiencia operativa, debe tender a FK directa o campo canonico directo.

No resolver todo con `entity_links`.

Relaciones especialmente sensibles:

- `document.party_id`
- `document.work_unit_id`
- `open_item.party_id`
- `open_item.work_unit_id`
- `task.party_id`
- `task.work_unit_id`
- `interaction.party_id`
- `interaction.work_unit_id`
- `business_event.party_id` / `business_event.work_unit_id` cuando aplique

## 5. ZetaSoftware

ZetaSoftware no se reemplaza.

Zeta es:

- fuente externa estructurada;
- proveedor de contactos, comprobantes, CFEs, centros de costo, maestros contables y saldos cuando aplique;
- posible destino controlado en etapas futuras.

Zeta no es:

- el modelo canonico interno;
- una razon para duplicar entidades;
- una fuente que permita saltarse revision humana en casos ambiguos.

Reglas:

- preservar raw records;
- conservar source refs;
- deduplicar;
- registrar external IDs como referencias;
- no escribir a Zeta sin dry-run, idempotencia, runbook y aprobacion humana;
- nunca ejecutar acciones destructivas contra Zeta por automatismo.

## 6. Web, email e intake

La web y el email no se reemplazan. Se conectan.

La captura de solicitudes, cotizaciones o comunicaciones debe entrar como intake operativo antes de convertirse en trabajo, venta, documento o decision final.

La IA puede sugerir party, trabajo, monto, ubicacion, resumen y proxima accion. No puede confirmar venta, marcar oportunidad como ganada, crear trabajo activo ambiguo, inventar importes ni escribir a sistemas externos.

## 7. UX y superficies

La navegacion objetivo inicial es:

```text
Inicio
Trabajos
Documentos
Dinero
Agenda
Mas
```

`Mas` agrupa Contactos/Directorio, Procesos, Continuidad, Contabilidad, IVA, Cierre, Integraciones, Auditoria, Ajustes y Avanzado.

Reglas UX:

- Inicio debe responder que esta pasando y que hay que hacer ahora.
- Trabajos es la superficie principal para `work_units`.
- Documentos es evidencia y workflow documental, no el centro unico.
- Dinero debe responder quien debe, a quien se debe, que vence y que afecta a cada trabajo.
- Tesoreria puede existir como subdominio de bancos, caja, vales y proyecciones.
- No usar dashboards decorativos ni KPIs inventados.
- No esconder bloqueos.
- No usar tablas gigantes como experiencia principal si hay una vista operativa mejor.

## 8. Documentos, contabilidad e IVA

El motor documental, el kernel contable multilinea, reglas, IVA Uruguay, cierre, open items, import/export y auditoria se conservan.

Pero su rol cambia:

- documentos prueban y estructuran hechos;
- contabilidad registra consecuencias;
- IVA/cierre valida cumplimiento;
- dinero muestra pendientes reales;
- Inicio muestra estado y acciones.

No degradar el producto a "subir documento -> clasificar -> asiento -> IVA" como unica historia.

## 9. IA

La IA puede:

- extraer;
- resumir;
- sugerir clasificacion;
- proponer party o work_unit probable;
- detectar bloqueos;
- proponer tareas;
- convertir notas crudas en borradores de procesos;
- explicar impacto contable, fiscal u operativo.

La IA no puede:

- inventar datos;
- crear ventas finales;
- marcar oportunidades como ganadas;
- postear contabilidad irreversible;
- confirmar IVA;
- cerrar periodos;
- escribir a Zeta;
- saltarse revision humana;
- saltarse RLS;
- fingir certeza cuando faltan datos.

Toda sugerencia accionable debe poder aceptarse, rechazarse y auditarse.

## 10. Arquitectura esperada

- `app/`: rutas, page shells, server actions y composicion.
- `components/`: UI y presentacion.
- `modules/`: logica de dominio, presenters y servicios.
- `db/schema/`: schema canonico consultable.
- `db/rls/`: politicas de seguridad.
- `supabase/migrations/`: historial real de despliegue.
- `tests/`: evidencia de comportamiento.
- `docs/`: documentacion viva y reducida.

No meter logica de negocio en componentes React.

Si una pantalla narra estado operativo, crear presenter o servicio en `modules/`.

## 11. Persistencia y RLS

Si una tarea toca persistencia:

1. actualizar schema canonico;
2. crear migracion;
3. revisar RLS;
4. agregar servicios de dominio;
5. agregar tests de tenancy;
6. verificar paridad cuando corresponda.

Ninguna tabla multi-tenant nueva puede quedar sin `organization_id`, indices minimos y politica de acceso por membresia.

## 12. Nueva Palmira

Nueva Palmira es el primer acceptance test operativo:

```text
cotizacion o solicitud
-> cliente/contacto
-> trabajo
-> venta/gasto
-> margen
-> deudores/acreedores
-> tareas/pendientes
-> Inicio
```

Si un cambio no ayuda a cerrar o estabilizar ese flujo, debe justificar por que entra antes.

## 13. Documentacion

La documentacion debe ser corta, navegable y viva.

No crear documentos nuevos por impulso. Primero revisar:

- `docs/README.md`
- `docs/convertilabs-2.0-baseline-arquitectura.md`
- `docs/analisis-arquitectura-convertilabs-2.0.md`
- `docs/plan_de_accion_convertilabs2_PRs_analisis.md`

Si un documento nuevo es necesario, debe tener:

- proposito claro;
- dueño conceptual;
- relacion con Convertilabs 2.0;
- estado: canonico, referencia tecnica o historico.

No reintroducir docs legacy que reinstalen la tesis vieja.

## 14. Testing y cierre

No cerrar una tarea sin evidencia proporcional.

- Docs-only: validar links, referencias y busquedas relevantes.
- UI: smoke manual y estados principales.
- Dominio/backend: tests del modulo tocado.
- Schema/API: migracion, RLS, contrato y smoke.
- Contabilidad/IVA/dinero: caso positivo y caso bloqueado.
- Integraciones: no forzar credenciales; separar mock, dry-run y real.

Comandos habituales segun alcance:

```bash
npm run lint
npm run typecheck
npm run test
npm run db:verify:parity
```

Si no se corren comandos relevantes, explicarlo.

## 15. Antipatrones

No crear:

- modulos isla;
- dashboards falsos;
- estados libres que gobiernen logica;
- duplicados de clientes/proveedores/trabajos;
- reglas IA sin aprobacion;
- automatismos irreversibles sin revision;
- integraciones que escriben sin runbook;
- nuevas abstracciones por si acaso;
- docs largos que contradicen o duplican la base 2.0.

## 16. Regla final

Cuando haya varias opciones razonables, elegir la que mejor ayude a operar la empresa real con trazabilidad, continuidad, menos carga mental y accion concreta.
