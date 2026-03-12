# Open questions - Paquete SDD Convertilabs v1

**Estado:** Updated  
**Objetivo:** registrar que decisiones quedaron cerradas y cuales siguen postergadas

---

## P0 - Resueltas

| ID | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P0-01 | Formas juridicas V1 | Respondida | `SA`, `SRL`, `SAS`, `UNIPERSONAL` |
| P0-02 | Regimenes V1 | Respondida | `IRAE_GENERAL`, `IRAE_LITERAL_E` |
| P0-03 | Venta entra en V1 o V1.1 | Respondida | Entra en V1 |
| P0-04 | Venta procesa o emite | Respondida | Procesa; no emite ni pre-emite |
| P0-05 | Dominios fiscales V1 | Respondida | Solo IVA |
| P0-06 | Minimo del perfil organizacional | Respondida | `country_code='UY'`, `tax_id`, `legal_entity_type`, `tax_regime_code` |
| P0-07 | Confirmaciones por paso o final | Respondida | Solo confirmacion final unica |
| P0-08 | Roles de confirmar/reabrir | Respondida | Confirmar: owner/admin/accountant/reviewer. Reabrir: owner/admin |
| P0-09 | Catalogo inicial de operaciones | Respondida | Compras: goods_resale, services, admin_expense, transport, fuel_and_lubricants, professional_fees, rent. Ventas: taxed_basic_22, taxed_minimum_10, exempt_or_export, non_taxed |
| P0-10 | Cambio de perfil con drafts abiertos | Respondida | Drafts viejos quedan congelados y muestran advertencia |

---

## P1 - Resueltas

| ID | Pregunta | Estado | Respuesta |
|---|---|---|---|
| P1-01 | PDF o imagen | Respondida | PDF, JPG y PNG |
| P1-02 | Duplicados por hash | Respondida | Warning, no bloqueo |
| P1-03 | Compra incluye importaciones | Respondida | No en automatizacion V1 |
| P1-04 | Venta incluye exportacion | Respondida | Si, dentro de la categoria resumida `exempt_or_export` |
| P1-05 | Lineas manuales al asiento | Postergada | No cerrado para una UI rica; la implementacion actual prioriza sugerencia estructurada |
| P1-06 | Centro de costo y auxiliares obligatorios | Respondida | No obligatorios en V1 |
| P1-07 | Confirmar con warnings | Postergada | La implementacion actual bloquea por faltantes criticos, no por cualquier warning |
| P1-08 | Texto crudo / highlights | Respondida | Texto crudo visible; highlights postergados |
| P1-09 | Multiusuario concurrente | Respondida | No en V1; control optimista simple |
| P1-10 | Norma completa o resumen | Respondida | Resumen en runtime; corpus interno curado fuera del prompt |

---

## P2 - Postergadas

- catalogo inicial de proveedores/clientes enriquecido
- multi-moneda
- doble aprobacion fiscal
- embeddings normativos
- overrides normativos por organizacion

---

## Checklist de salida

- [x] P0 respondidas
- [x] Catalogos iniciales aprobados
- [x] Estados del documento aprobados
- [x] Roles y permisos aprobados
- [x] Alcance fiscal V1 aprobado
- [x] Alcance de venta aprobado
- [x] Politica de recalculo aprobada
