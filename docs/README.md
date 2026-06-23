# Documentacion Convertilabs 2.0

Este directorio queda reducido a documentacion viva y referencias tecnicas que todavia tienen valor operativo.

Si un archivo historico anterior contradice la base 2.0, gana la base 2.0.

## Lectura obligatoria

1. [Baseline de arquitectura](convertilabs-2.0-baseline-arquitectura.md)
2. [Analisis arquitectonico](analisis-arquitectura-convertilabs-2.0.md)
3. [Plan de accion por PRs](plan_de_accion_convertilabs2_PRs_analisis.md)
4. [Agent rules](agent_rules.md)
5. [Lenguaje, navegacion y dominios](convertilabs-2.0-navigation-and-domains.md)
6. [Modelo canonico y bridges legacy](convertilabs-2.0-canonical-model-and-bridges.md)

## Tesis oficial

Convertilabs no es un ERP generico ni una suite modular desconectada.

Convertilabs es el sistema operativo integral de gestion de Rontil, conectado a ZetaSoftware, web, email y procesos internos.

El centro conceptual es el hecho operativo:

```text
hecho operativo
-> party/contacto
-> work_unit/trabajo
-> document/evidencia
-> dinero
-> contabilidad
-> IVA/cumplimiento
-> tareas/procesos
-> Inicio
```

## Referencias tecnicas que sobreviven

Estas referencias no son la tesis del producto, pero siguen siendo utiles para implementacion o validacion:

- [Contrato endpoints Zeta](zetasoftware-endpoints-contract.md)
- [Notas Bandeja Zeta](zetasoftware-bandeja-contract-notes.md)
- [Validacion Zeta read-only](integrations/zeta-readonly-validation-plan.md)
- [Work intake web/email](integrations/work-intake-web-email.md)
- [Role map y plantillas contables Zeta](pr-next-zeta-posting-templates-role-map.md)
- [Playbook Nueva Palmira](playbooks/nueva-palmira-acceptance-test.md)
- [PR-13 hardening piloto interno](pr-13-hardening-piloto-interno.md)
- [Piloto interno Rontil - hallazgos](piloto-interno-rontil-hallazgos.md)
- `docs/Api ZetaSoftware collection.json` como fuente externa cruda para contratos Zeta.
- `docs/samples/*.json` para fixtures/demo de piloto.

## Documentacion retirada

Se retiraron los documentos legacy que duplicaban o contradecian la base actual:

- documento refundacional extenso;
- plan maestro v1;
- documentacion unificada historica;
- docs `00-*` a `03-*`;
- specs Zeta v1 y backlog Zeta antiguo;
- specs mobile/PWA;
- notas de PR antiguas ya absorbidas por el analisis y el plan actual;
- documento largo de tesoreria usado como prompt/especificacion temporal.

La informacion que sigue vigente fue absorbida por:

- `convertilabs-2.0-baseline-arquitectura.md`;
- `analisis-arquitectura-convertilabs-2.0.md`;
- `plan_de_accion_convertilabs2_PRs_analisis.md`;
- `agent_rules.md`.

## Hito documental

Fecha: 2026-06-23.

Commit sugerido:

```text
docs: consolidar base documental Convertilabs 2.0
```

Este hito marca el punto en que la documentacion deja de estar repartida entre refundacion, planes viejos, PR notes y specs historicas, y pasa a tener una base corta y legible para los siguientes PRs.

## Regla de mantenimiento

- No crear documentos nuevos si una seccion en los documentos base alcanza.
- No reintroducir la tesis "Convertilabs no es ERP" como prohibicion funcional.
- No volver a separar documentos, contabilidad, IVA, dinero, trabajos y procesos como productos aislados.
- Si una referencia tecnica queda obsoleta, actualizarla o retirarla en el mismo PR que la invalida.
