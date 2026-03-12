# Spec 05 - Draft editable

**Estado:** Approved  
**Prioridad:** P0  
**Dependencias:** `02`, `03`, `04`, `06`, `07`

---

## 1. Decision cerrada

V1 tiene un unico punto de aprobacion:

- confirmacion final unica

No existen confirmaciones por paso.

---

## 2. Flujo V1

El draft editable expone estos bloques:

1. preview
2. identidad
3. datos extraidos
4. importes
5. contexto de operacion
6. sugerencia contable
7. sugerencia fiscal
8. confirmacion final

La implementacion puede usar pagina o modal. Lo importante es que el draft viva como entidad persistente y editable.

---

## 3. Persistencia

El draft vive en:

- `document_drafts`
- `document_draft_steps`
- `document_draft_autosaves`
- `document_revisions`

Cada cambio guarda estado de borrador y deja traza.

---

## 4. Politicas V1

- control optimista simple
- no multiusuario concurrente pleno
- al cambiar datos upstream, asiento/IVA deben recalcularse
- cerrar la vista no puede perder trabajo guardado

---

## 5. Estado de implementacion

Implementado:

- review page org-scoped
- guardado de secciones sobre el draft
- estados por paso
- confirmacion final unica
- reapertura a nueva revision

Pendiente:

- modal multi-step mas pulido
- autosave con debounce mas fino
- highlights visuales del origen dentro del preview
