Convenciones base para esta etapa

- Uruguay only en V1
- IVA only en V1
- compra automatizable y venta incluida sin emision
- confirmacion final unica; al aprobar se genera `journal_entry.status = draft`
- OpenAI entra en V1 solo para intake documental y siempre desde servidor
- la IA nunca recibe toda la normativa DGI; solo snapshots resumidos y aprobados por organizacion

## Matriz de estado

| Area | Backend implementado | Visible en UI | Pendiente |
|---|---|---|---|
| Onboarding fiscal minimo | Si | Si | validaciones y guiado asistido |
| Upload privado | Si | Si | nada bloqueante |
| Intake OpenAI | Si | Parcial | worker/cola real |
| Draft persistente | Si | Si | autosave mas fino |
| Sugerencia IVA | Si | Si | exportacion, mixtos y excepciones por rubro |
| Sugerencia contable | Si | Si | mapping completo a plan de cuentas |
| Confirmacion/reapertura | Si | Si | motivo obligatorio al reabrir |
| VAT runs | Si | Si | backoffice fiscal mas rico |
| Perfil versionado | Si | Si | politicas avanzadas de aprobacion |
| Base normativa curada | Si | Parcial | backoffice normativo completo |

## Etapa aplicada en esta iteracion

### 1. UX org-scoped

- dashboard privado enlaza al draft real
- existe pagina org-scoped de documentos
- existe review page con preview, datos editables, sugerencia IVA y sugerencia contable
- `Tax`, `Settings` y `Journal entries` pasan a resolver contra la organizacion activa

### 2. Confirmacion y trazabilidad

- confirmar desde UI crea `document_confirmations`
- reabrir clona a nueva revision y mueve el documento a `classified_with_open_revision`
- confirmar actualiza `vat_runs` del periodo
- confirmar crea `journal_entry` draft y conserva trace contable/fiscal

### 3. Settings y snapshots

- settings muestra perfil activo, historial y snapshots
- settings permite activar nueva version del perfil
- el perfil fiscal versionado incluye `vat_regime`, `dgi_group` y `cfe_status`
- los drafts anteriores no se recalculan automaticamente

## Follow-up tecnico

- mover el procesamiento documental a una cola/worker real
- mejorar autosave y experiencia de edicion concurrente
- enriquecer plan de cuentas y lineas de journal con mapping completo
- agregar backoffice de normativa y reglas derivadas
