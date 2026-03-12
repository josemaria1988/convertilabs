# Spec 09 - Base normativa tributaria viva

**Estado:** Approved with follow-up  
**Prioridad:** P1  
**Dependencias:** alcance fiscal V1

---

## 1. Decision cerrada

La base normativa V1 existe para:

- guardar fuentes oficiales
- guardar items normativos
- soportar reglas derivadas
- soportar snapshots resumidos por organizacion

La publicacion de reglas sigue siendo human-in-the-loop.

---

## 2. Regla clave de producto

En runtime:

- la IA no consulta internet
- la IA no recibe el corpus completo
- la IA solo recibe el snapshot resumido y aprobado para la organizacion

La base normativa completa vive fuera del prompt.

---

## 3. Alcance implementado

Persistencia ya disponible:

- `normative_sources`
- `normative_items`
- `normative_update_runs`

Uso operativo ya disponible:

- `tax_rules` como capa deterministica
- `organization_rule_snapshots` como capa resumida para prompts

---

## 4. Pendiente

- UI administrativa completa para fuentes, diffs y aprobacion
- workflow mas rico de update runs
- busqueda normativa para usuario final
- embeddings y recuperacion avanzada

---

## 5. Relacion con V1

Aunque la base normativa pueda almacenar mas material, en V1 solo se activan reglas que impactan:

- intake documental
- IVA compras
- IVA ventas
- `vat_runs`
