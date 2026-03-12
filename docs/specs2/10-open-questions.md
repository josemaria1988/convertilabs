# Open questions - Paquete SDD Convertilabs v1

**Estado:** Activo  
**Objetivo:** cerrar decisiones antes de codificar comportamiento no definido

---

## Instrucciones de uso

- Marcar cada pregunta como `Respondida`, `Postergada` o `Fuera de alcance`.
- No mover un spec a `Approved` mientras tenga preguntas P0 sin resolver.
- Si una respuesta cambia el comportamiento del sistema, registrar también un ADR o decision log asociado.

---

## P0 - Bloqueantes absolutas

| ID | Pregunta | Por qué importa | Respuesta |
|---|---|---|---|
| P0-01 | ¿Qué formas jurídicas entraremos a soportar explícitamente en V1? | Afecta onboarding, catálogos y lógica normativa | |
| P0-02 | ¿Qué regímenes tributarios entraremos a soportar explícitamente en V1? | Sin esto no existe encuadre fiscal real | |
| P0-03 | ¿La factura de venta entra en V1 o V1.1? | Define alcance real del producto | |
| P0-04 | Si entra factura de venta, ¿Convertilabs la procesa desde PDF o también la emite/preemite? | Cambia por completo arquitectura y riesgos | |
| P0-05 | ¿Qué tributos o dominios fiscales cubre el V1? | Delimita motor fiscal y base normativa | |
| P0-06 | ¿Qué campos mínimos del perfil organizacional son obligatorios para habilitar clasificación, fiscal y asiento? | Define gating del sistema | |
| P0-07 | ¿El usuario puede confirmar fiscal y asiento por separado, o solo existe confirmación final única? | Afecta estados y UX | |
| P0-08 | ¿Qué roles pueden confirmar, reabrir y reconfirmar? | Afecta permisos y auditoría | |
| P0-09 | ¿Qué catálogo inicial de operaciones de compra y venta se soportará? | Afecta reglas y formularios | |
| P0-10 | ¿Qué ocurre si cambia el perfil organizacional con drafts abiertos? | Afecta consistencia del sistema | |

---

## P1 - Muy importantes

| ID | Pregunta | Por qué importa | Respuesta |
|---|---|---|---|
| P1-01 | ¿PDF solamente en V1 o también imágenes? | Afecta pipeline técnico y UX | |
| P1-02 | ¿Se bloquean documentos duplicados por hash o solo se advierte? | Afecta trazabilidad y experiencia | |
| P1-03 | ¿Compra V1 incluye importaciones y servicios del exterior? | Cambia taxonomía fiscal y contable | |
| P1-04 | ¿Venta V1 incluye exportación desde el inicio? | Cambia perfiles de operación y normativa | |
| P1-05 | ¿Los usuarios pueden agregar líneas manuales al asiento? | Afecta UI y control | |
| P1-06 | ¿Centro de costo y auxiliares son obligatorios? | Afecta modelo contable | |
| P1-07 | ¿Se puede confirmar con warnings o todo warning bloquea? | Afecta UX y prudencia del sistema | |
| P1-08 | ¿El usuario verá texto extraído crudo y/o highlights del origen? | Afecta transparencia y UI | |
| P1-09 | ¿Habrá multiusuario concurrente editando el mismo draft? | Afecta locking/versionado | |
| P1-10 | ¿La normativa interna mostrará texto completo, resumen o ambos? | Afecta almacenamiento y UX | |

---

## P2 - Convenientes para evitar retrabajo

| ID | Pregunta | Por qué importa | Respuesta |
|---|---|---|---|
| P2-01 | ¿Habrá catálogo de proveedores y clientes desde el inicio? | Enriquece sugerencias | |
| P2-02 | ¿Se soportará multi-moneda desde el primer corte? | Afecta importes, asiento y fiscal | |
| P2-03 | ¿Se versionarán plantillas contables por vigencia? | Afecta mantenimiento | |
| P2-04 | ¿La reapertura de un clasificado pedirá motivo obligatorio? | Afecta auditoría | |
| P2-05 | ¿Existirá aprobación doble para cambios fiscales sensibles? | Afecta seguridad del proceso | |
| P2-06 | ¿Se generarán embeddings normativos desde el inicio o en fase siguiente? | Afecta arquitectura de búsqueda | |
| P2-07 | ¿La base normativa debe cubrir solo Uruguay en esta etapa? | Afecta diseño multi-jurisdicción | |
| P2-08 | ¿Se permitirá override de reglas por organización? | Afecta flexibilidad vs control | |

---

## Respuestas ya sugeridas por el análisis, pero NO cerradas

### 1. Separar forma jurídica de régimen tributario
Se recomienda modelarlos por separado. No cerrar un único campo “tipo de empresa”.

### 2. Versionar por vigencia
Se recomienda que el perfil organizacional y las reglas tengan vigencia temporal.

### 3. Todo automático vive primero como draft
Se recomienda que ningún output automático salte directamente a estado definitivo.

### 4. Factura de venta requiere spec propio
Se recomienda no ocultarla dentro de “otros documentos”.

---

## Checklist de salida antes de implementar

- [ ] P0 respondidas
- [ ] Catálogos iniciales aprobados
- [ ] Estados del documento aprobados
- [ ] Estados del draft aprobados
- [ ] Roles y permisos aprobados
- [ ] Alcance fiscal de V1 aprobado
- [ ] Alcance de venta aprobado
- [ ] Política de recalculo aprobada

---
