# Convertilabs Documentation

Este directorio ya no se presenta como una sola pila de markdowns equivalentes. Desde el corte factual `2026-03-28`, la documentacion queda separada en tres capas:

- documentacion oficial y viva de producto;
- specs activas de implementacion o rollout;
- referencia conceptual e historica.

La revalidacion se hizo contra rutas activas, `modules/`, migraciones hasta `20260324_rule002_*`, APIs de health/readiness y `64` archivos `*.test.cjs`.

## Fuente de verdad

- La fuente de verdad funcional vive en los docs oficiales listados abajo.
- Las specs activas pueden mezclar implementado, parcial y pendiente.
- Si una spec contradice un doc oficial o el codigo, manda el doc oficial y luego el codigo.

## Orden recomendado de lectura

1. `agent_rules.md` y `beta_privada_alcance_y_operacion.md`
2. `00-foundations/` para vision, mapa real y estado actual
3. `04-documents/` y `06-integrations/` para `Documentos` + `Revision` + `Importacion masiva`
4. `03-accounting/` para presets, reglas, mapa contable y cierre
5. `05-tax/` para IVA, FX, importaciones y workbench fiscal
6. `02-organization/` y `01-identity/` para tenancy, onboarding y settings tabulados
7. `07-platform/` y `08-quality/` para schema, APIs, jobs, observabilidad y rollout

## Documentacion oficial y viva

### Fundaciones y alcance

- [agent_rules.md](./agent_rules.md)
- [beta_privada_alcance_y_operacion.md](./beta_privada_alcance_y_operacion.md)
- [00-foundations/00-vision-rectora-v1.md](./00-foundations/00-vision-rectora-v1.md)
- [00-foundations/01-mapa-del-repo-y-rutas.md](./00-foundations/01-mapa-del-repo-y-rutas.md)
- [00-foundations/02-estado-actual-kernel-contable-y-fiscal-2026-03-28.md](./00-foundations/02-estado-actual-kernel-contable-y-fiscal-2026-03-28.md)
- [00-foundations/product-language-and-copy-dictionary.md](./00-foundations/product-language-and-copy-dictionary.md)

### Identidad, organizacion y setup

- [01-identity/auth-tenancy-and-memberships.md](./01-identity/auth-tenancy-and-memberships.md)
- [02-organization/business-profile-onboarding-and-settings.md](./02-organization/business-profile-onboarding-and-settings.md)
- [03-accounting/chart-presets-and-plan-management.md](./03-accounting/chart-presets-and-plan-management.md)
- [03-accounting/hybrid-ai-preset-recommendation.md](./03-accounting/hybrid-ai-preset-recommendation.md)

### Superficies privadas activas

- [04-documents/01-document-intake-and-processing.md](./04-documents/01-document-intake-and-processing.md)
- [04-documents/02-document-review-classification-and-posting.md](./04-documents/02-document-review-classification-and-posting.md)
- [03-accounting/accounting-rules-admin-and-learning.md](./03-accounting/accounting-rules-admin-and-learning.md)
- [03-accounting/accounting-map-impact-graph.md](./03-accounting/accounting-map-impact-graph.md)
- [03-accounting/close-cockpit-and-period-controls.md](./03-accounting/close-cockpit-and-period-controls.md)
- [05-tax/tax-platform-vat-fx-and-imports.md](./05-tax/tax-platform-vat-fx-and-imports.md)
- [06-integrations/spreadsheets-imports-exports-and-bridge.md](./06-integrations/spreadsheets-imports-exports-and-bridge.md)
- [06-integrations/zeta-document-spreadsheet-import.md](./06-integrations/zeta-document-spreadsheet-import.md)
- [07-platform/database-api-background-jobs-and-observability.md](./07-platform/database-api-background-jobs-and-observability.md)
- [08-quality/testing-rollout-and-roadmap.md](./08-quality/testing-rollout-and-roadmap.md)

### Contratos y specs de apoyo todavia relevantes

- [04-documents/03-ui-canonical-states-and-decisions.md](./04-documents/03-ui-canonical-states-and-decisions.md)
- [04-documents/03-document-settlement-and-multi-line-posting.md](./04-documents/03-document-settlement-and-multi-line-posting.md)
- [09-future/cost-centers-jobs-and-profitability.md](./09-future/cost-centers-jobs-and-profitability.md)

## Specs activas de implementacion

- [convertilabs_mvp_launch_hardening_sdd_codex_prompt.md](./convertilabs_mvp_launch_hardening_sdd_codex_prompt.md)
- [specs-driven-development-admin-reglas-y-aprendizaje.md](./specs-driven-development-admin-reglas-y-aprendizaje.md)
- [specs-driven-development-asistente-contable.md](./specs-driven-development-asistente-contable.md)
- [spec_ui_refactor_explainability_convertilabs.md](./spec_ui_refactor_explainability_convertilabs.md)
- [specs-driven-development-erp-contable-profesional.md](./specs-driven-development-erp-contable-profesional.md)

## Referencia conceptual e historica

- [00-foundations/specs-driven-zeta-contabilidad-development.md](./00-foundations/specs-driven-zeta-contabilidad-development.md)
- [00-foundations/teoria-contable-y-estructural-convertilabs.md](./00-foundations/teoria-contable-y-estructural-convertilabs.md)

## Regla editorial

- si cambia una feature operativa, actualizar primero el doc oficial del dominio;
- si cambia alcance, rutas o estado general, actualizar tambien `00-foundations/`;
- si cambia schema, APIs, jobs o RLS, actualizar `07-platform/` y `db/README.md`;
- si el cambio solo vive en una spec, dejarlo explicitamente marcado como `spec`, `parcial` o `pendiente`, nunca como `hecho`.
