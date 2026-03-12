# Spec 01 - Perfil juridico y tributario de la organizacion

**Estado:** Approved  
**Prioridad:** P0  
**Dependencias:** ninguna  
**Bloquea:** clasificacion documental, sugerencia contable, sugerencia fiscal y venta V1

---

## 1. Decision cerrada

El sistema modela por separado:

- forma juridica
- regimen tributario
- pais
- tax id

En V1 el minimo operativo para desbloquear clasificacion fiscal y contable es:

- `country_code = 'UY'`
- `tax_id`
- `legal_entity_type`
- `tax_regime_code`

---

## 2. Catalogo V1 aprobado

### Formas juridicas soportadas explicitamente

- `SA`
- `SRL`
- `SAS`
- `UNIPERSONAL`

`Literal E` no es forma juridica. Se trata como regimen fiscal.

Otras formas pueden existir en datos, pero caen en modo generico sin reglas fiscales especificas en V1.

### Regimenes tributarios soportados explicitamente

- `IRAE_GENERAL`
- `IRAE_LITERAL_E`

No hay soporte explicito V1 para:

- monotributo puro
- exportacion pura como regimen
- regimenes especiales fuera de IVA V1

---

## 3. Versionado

El perfil organizacional se versiona en `organization_profile_versions`.

Reglas:

- cada cambio relevante crea una nueva version
- cada version puede materializar un `organization_rule_snapshot`
- el snapshot es el contexto que usa la IA
- los drafts viejos quedan congelados con el snapshot con el que nacieron
- solo documentos nuevos usan la nueva configuracion

La UI debe advertir claramente cuando un draft fue generado con configuracion anterior.

---

## 4. Comportamiento V1

### Onboarding

El onboarding captura desde el inicio:

- forma juridica
- RUT
- regimen tributario

### Settings

Settings expone:

- version activa del perfil
- historial de versiones
- snapshot activo
- formulario para activar nueva version

No existe recalculo automatico de drafts abiertos al cambiar el perfil.

---

## 5. Reglas de negocio

1. La fecha efectiva del perfil importa para trazabilidad, pero en V1 la politica operativa es conservadora: drafts existentes no cambian.
2. Si falta el perfil minimo, el documento puede procesarse tecnicamente, pero no queda listo para confirmar.
3. El snapshot por organizacion es la unica fuente de contexto normativo que se manda al modelo.

---

## 6. Estado de implementacion

Implementado:

- onboarding minimo
- `organization_profile_versions`
- `organization_rule_snapshots`
- bootstrap automatico del primer perfil
- vista de settings con historial y activacion de nueva version

Pendiente:

- aprobacion multinivel de cambios de perfil
- historial mas rico de impactos sobre drafts antiguos
