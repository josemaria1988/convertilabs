# Spec 01 - Perfil jurídico y tributario de la organización

**Estado:** Draft / Blocked  
**Prioridad:** P0  
**Dependencias:** ninguna  
**Bloquea:** clasificación documental seria, sugerencia contable, sugerencia fiscal, factura de venta

---

## 1. Propósito

Definir el modelo de datos, el flujo de captura y las reglas de versionado del **perfil jurídico, fiscal, contable y documental** de cada organización.

Sin este spec, cualquier clasificación de documentos será técnicamente posible pero conceptualmente defectuosa. Que es una forma elegante de decir “mal”.

---

## 2. Problema que resuelve

El alta actual de organización permite crear una entidad operativa mínima, pero no captura datos críticos para:

- decidir qué normativa aplica,
- determinar qué tipos de comprobantes corresponden,
- calcular o sugerir tratamiento tributario,
- sugerir asientos contables consistentes,
- distinguir compra, venta, importación, exportación, exento, no gravado, etc.

---

## 3. Alcance

Este spec cubre:

- los datos maestros que debe completar una organización,
- el modelo para guardar versiones históricas de su perfil,
- el gating funcional para impedir automatizaciones sin encuadre suficiente,
- el punto del flujo donde estos datos se capturan y editan.

Este spec **no** cubre todavía:

- trámites reales ante DGI / BPS / DGR,
- emisión de CFE,
- firma digital,
- comunicación con ERP externo,
- determinación automática de toda la carga tributaria de la empresa.

---

## 4. Hipótesis de diseño que NO deben codificarse como hecho

### 4.1 No mezclar ejes
El sistema debe modelar por separado:

- **forma jurídica** de la organización,
- **régimen o encuadre tributario**,
- **condición frente a IVA**,
- **condición frente a CFE**,
- **perfil contable**,
- **operaciones habilitadas** de compra y venta.

### 4.2 Un mismo ente puede cambiar con el tiempo
El perfil debe ser **versionable por vigencia**.  
Ejemplos de cambio relevantes:

- cambio de tipo societario,
- cambio de régimen tributario,
- alta como emisor electrónico,
- cambio de plan de cuentas,
- incorporación de operaciones de exportación.

### 4.3 “Tipo de empresa” no es un único campo
Debe existir una estructura compuesta. Un solo dropdown de “tipo de organización” sería cómodo para romper todo después.

---

## 5. Preguntas de negocio que este spec obliga a responder

1. ¿Qué catálogo inicial de **formas jurídicas** se soportará?
2. ¿Qué catálogo inicial de **regímenes tributarios** se soportará?
3. ¿Qué dimensión manda para la lógica fiscal: forma jurídica, régimen, actividad, o una combinación?
4. ¿La organización puede tener más de un perfil de operación de venta?
5. ¿Se permitirá historial con vigencia desde/hasta?
6. ¿Qué campos son obligatorios para habilitar procesamiento de documentos?
7. ¿Qué campos son obligatorios para habilitar sugerencia fiscal?
8. ¿Qué campos son obligatorios para habilitar sugerencia contable?

---

## 6. Requisitos funcionales

### 6.1 Captura inicial
Al crear una organización, el sistema MUST solicitar un perfil mínimo adicional antes de habilitar el procesamiento documental.

### 6.2 Edición posterior
El perfil MUST poder editarse desde `Settings`, con control de permisos.

### 6.3 Versionado
Todo cambio de perfil que afecte reglas fiscales o contables MUST generar una nueva versión con:

- `effective_from`
- `effective_to`
- `change_reason`
- `changed_by`

### 6.4 Gating
El sistema MUST impedir:
- confirmación fiscal,
- sugerencia contable final,
- clasificación final de venta,
si faltan campos mínimos del perfil.

### 6.5 Recalculo
Cuando el perfil cambie y haya drafts abiertos, el sistema SHOULD marcar sugerencias previas como `stale` y ofrecer recalcular.

### 6.6 Auditoría
Toda lectura o uso del perfil durante una sugerencia SHOULD poder rastrearse por versión usada.

---

## 7. Modelo de dominio

### 7.1 Entidades propuestas

#### `organizations`
Entidad ya existente o equivalente.

Campos relevantes:
- `id`
- `name`
- `slug`
- `status`

#### `organization_profile_versions`
Versión consolidada del perfil.

Campos:
- `id`
- `organization_id`
- `version_number`
- `status` (`draft`, `active`, `superseded`)
- `effective_from`
- `effective_to`
- `created_by`
- `created_at`
- `approved_by`
- `approved_at`
- `change_reason`

#### `organization_legal_profile`
Datos jurídicos.

Campos propuestos:
- `profile_version_id`
- `legal_form_code`
- `legal_form_label`
- `has_legal_personhood`
- `registration_refs_json`
- `incorporation_date`

#### `organization_tax_profile`
Datos tributarios.

Campos propuestos:
- `profile_version_id`
- `tax_regime_code`
- `vat_condition_code`
- `income_tax_condition_code`
- `small_taxpayer_flags_json`
- `withholding_agent_flags_json`
- `fiscal_year_close_month`
- `currency_base_code`

#### `organization_cfe_profile`
Condición frente a documentación electrónica.

Campos propuestos:
- `profile_version_id`
- `is_electronic_issuer`
- `e_invoicing_start_date`
- `e_invoicing_exception_code`
- `default_sale_document_profiles_json`
- `supports_export_documents`
- `supports_exempt_sales`
- `supports_non_taxed_sales`

#### `organization_accounting_profile`
Configuración contable base.

Campos propuestos:
- `profile_version_id`
- `chart_of_accounts_template_id`
- `journal_policy_code`
- `cost_center_policy_code`
- `posting_policy_code`
- `rounding_policy_code`

#### `organization_activity_profile`
Actividad económica y operaciones.

Campos propuestos:
- `profile_version_id`
- `activity_codes_json`
- `sector_tags_json`
- `purchase_operation_profiles_json`
- `sale_operation_profiles_json`
- `imports_enabled`
- `exports_enabled`

---

## 8. Catálogos base requeridos

Los catálogos MUST ser administrables, no hardcodeados.

### 8.1 Catálogo de forma jurídica
Ejemplos tentativos:
- SA
- SAS
- SRL
- Unipersonal
- Otro / custom

**OPEN:** catálogo exacto del V1.

### 8.2 Catálogo de régimen tributario
Ejemplos tentativos:
- IVA general
- IVA mínimo / Literal E
- Monotributo
- IVA servicios personales
- Otro / custom

**OPEN:** alcance exacto del V1.

### 8.3 Catálogo de condición CFE
Ejemplos:
- emisor electrónico obligatorio
- emisor electrónico voluntario
- exceptuado
- no definido

### 8.4 Catálogo de perfiles de operación
Ejemplos:
- compra local gravada
- compra local exenta
- importación
- venta local gravada
- venta local exenta
- exportación

**OPEN:** definir si estos perfiles viven como catálogo global o por organización.

---

## 9. Gating mínimo recomendado

### 9.1 Para habilitar procesamiento documental
Campos mínimos:
- nombre de organización
- país / jurisdicción
- forma jurídica
- régimen tributario
- condición CFE
- moneda base

### 9.2 Para habilitar sugerencia fiscal
Además de lo anterior:
- condición frente a IVA
- operación habilitada
- vigencia del perfil
- base normativa seleccionada

### 9.3 Para habilitar sugerencia contable
Además de lo anterior:
- plan de cuentas asignado
- política de asiento definida

---

## 10. UX requerida

### 10.1 Onboarding
Después de crear organización, MUST abrirse un flujo de configuración mínima antes de permitir:
- subir documentos con fines contables/tributarios,
- confirmar clasificaciones,
- generar sugerencias.

### 10.2 Settings
Debe existir una sección `Organización > Perfil fiscal y contable`.

### 10.3 Edición con impacto
Si el usuario modifica un campo crítico, la UI MUST advertir:

- qué documentos borrador podrían requerir recalculo,
- si el cambio afecta ventas, compras o ambas,
- desde qué fecha entra en vigor.

### 10.4 Vigencia temporal
La UI SHOULD permitir:
- cambio inmediato,
- cambio programado a una fecha futura,
- visualización del historial.

---

## 11. Reglas de negocio

1. El sistema MUST resolver sugerencias usando la **versión vigente del perfil** a la fecha del documento, no a la fecha actual del servidor.
2. Si no existe una versión vigente para la fecha del documento, el sistema MUST degradar a `requires_attention`.
3. Si la organización no tiene perfil suficientemente completo, el documento MAY procesarse técnicamente, pero no podrá quedar confirmado tributaria o contablemente.
4. Si cambia el perfil después de clasificar un documento, el sistema MUST registrar si el documento queda afectado o no.
5. Las ventas y compras MAY compartir parte del perfil, pero no deben forzarse a usar exactamente la misma lógica de operación.

---

## 12. API / contratos internos sugeridos

### `GET /api/organizations/:id/profile/current`
Devuelve la versión activa.

### `GET /api/organizations/:id/profile/at?date=YYYY-MM-DD`
Devuelve la versión vigente para una fecha.

### `POST /api/organizations/:id/profile/draft`
Crea o actualiza una versión borrador.

### `POST /api/organizations/:id/profile/activate`
Activa una nueva versión con fecha de vigencia.

### `GET /api/catalogs/legal-forms`
### `GET /api/catalogs/tax-regimes`
### `GET /api/catalogs/cfe-conditions`
### `GET /api/catalogs/operation-profiles`

---

## 13. Escenarios de aceptación

### Escenario A - Alta mínima correcta
**Given** una organización recién creada  
**When** completa forma jurídica, régimen tributario, condición CFE y moneda base  
**Then** queda habilitado el procesamiento documental base

### Escenario B - Perfil insuficiente
**Given** una organización sin plan de cuentas  
**When** intenta confirmar una sugerencia contable  
**Then** el sistema bloquea la confirmación y explica el faltante

### Escenario C - Cambio con impacto retroactivo no permitido
**Given** un perfil vigente desde el 2026-01-01  
**When** un usuario intenta cambiar el régimen sin definir vigencia  
**Then** el sistema exige `effective_from`

### Escenario D - Recalculo por cambio de perfil
**Given** drafts abiertos basados en una versión anterior  
**When** se activa una nueva versión del perfil  
**Then** los drafts afectados quedan marcados como `stale_profile_dependency`

---

## 14. Métricas y observabilidad

Registrar:
- porcentaje de organizaciones con perfil completo,
- cantidad de drafts bloqueados por perfil incompleto,
- cantidad de recálculos disparados por cambio de perfil,
- cantidad de confirmaciones usando perfil desactualizado evitadas.

---

## 15. Decisiones bloqueantes

1. ¿Lista exacta de formas jurídicas soportadas en V1?
2. ¿Lista exacta de regímenes tributarios soportados en V1?
3. ¿Qué cambios de perfil invalidan sugerencias previas?
4. ¿El perfil se aprueba por usuario owner o requiere rol “contador/admin fiscal”?
5. ¿Habrá múltiples perfiles de operación de venta por organización?

---

## 16. Out of scope

- cálculo anual de IRAE
- BPS
- liquidación de sueldos
- gestión societaria legal
- firma y emisión CFE
- conciliación bancaria

---
