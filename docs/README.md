# Convertilabs Documentation

Este directorio reemplaza la documentacion historica dispersa en `docs/specs*`, archivos sueltos y notas tacticas de iteraciones previas.

La fuente editorial de este nuevo set es el rector funcional del 2026-03-15, pero cada documento tambien fue contrastado contra el estado real del repo, sus rutas, modulos, migraciones y pruebas.

## Reglas de lectura

- `00-foundations/` fija la vision, el alcance y el mapa real del repo.
- `01-identity/` y `02-organization/` cubren auth, tenancy, onboarding y settings.
- `03-accounting/` cubre plan de cuentas, presets y recomendacion hibrida con IA.
- `04-documents/` cubre intake, revision, clasificacion, aprendizaje y posting.
- `05-tax/` cubre VAT, perfil fiscal, importaciones y multimoneda.
- `06-integrations/` cubre spreadsheets, imports, exports y bridge al sistema externo.
- `07-platform/` cubre base de datos, APIs, background jobs y observabilidad.
- `08-quality/` cubre testing, rollout y roadmap tecnico.
- `09-future/` documenta modulos objetivo que el rector exige dejar preparados aunque todavia no existan como feature operativa.

## Estructura actual

- [00-foundations/00-vision-rectora-v1.md](./00-foundations/00-vision-rectora-v1.md)
- [00-foundations/01-mapa-del-repo-y-rutas.md](./00-foundations/01-mapa-del-repo-y-rutas.md)
- [01-identity/auth-tenancy-and-memberships.md](./01-identity/auth-tenancy-and-memberships.md)
- [02-organization/business-profile-onboarding-and-settings.md](./02-organization/business-profile-onboarding-and-settings.md)
- [03-accounting/chart-presets-and-plan-management.md](./03-accounting/chart-presets-and-plan-management.md)
- [03-accounting/hybrid-ai-preset-recommendation.md](./03-accounting/hybrid-ai-preset-recommendation.md)
- [04-documents/01-document-intake-and-processing.md](./04-documents/01-document-intake-and-processing.md)
- [04-documents/02-document-review-classification-and-posting.md](./04-documents/02-document-review-classification-and-posting.md)
- [05-tax/tax-platform-vat-fx-and-imports.md](./05-tax/tax-platform-vat-fx-and-imports.md)
- [06-integrations/spreadsheets-imports-exports-and-bridge.md](./06-integrations/spreadsheets-imports-exports-and-bridge.md)
- [07-platform/database-api-background-jobs-and-observability.md](./07-platform/database-api-background-jobs-and-observability.md)
- [08-quality/testing-rollout-and-roadmap.md](./08-quality/testing-rollout-and-roadmap.md)
- [09-future/cost-centers-jobs-and-profitability.md](./09-future/cost-centers-jobs-and-profitability.md)

## Cobertura de la documentacion legacy

- `doc_project_architecture.md`, `doc_business_logic.md`, `doc_api.md`, `doc_supabase_schema.md`:
  absorbidos por `00-foundations/`, `07-platform/` y `06-integrations/`.
- `doc_auth_signup.md`, `specs/auth-profiles.md`, `spec-driven-steps1.md`:
  absorbidos por `01-identity/`.
- `specs/onboarding-organizations.md`, `specs6/specs-driven-development-steps6-onboarding-presets-y-comentarios.md`:
  absorbidos por `02-organization/` y `03-accounting/`.
- `doc_document_intake.md`, `specs2/02..08`, `plan-separacion-flujo...`:
  absorbidos por `04-documents/`.
- `doc_accounting_entry_suggestions.md`, `doc_rule_based_tax_treatment.md`, `doc_agent_rules.md`:
  absorbidos por `03-accounting/`, `04-documents/` y `07-platform/`.
- `doc_VAT_support.md`, `docs/tax/*`, `specs5`, `specs3`, `specs2/09`:
  absorbidos por `05-tax/` y `08-quality/`.
- `doc_export_API_ready_architecture.md`, `specs/upload-dashboard.md`, `roadmap.md`:
  absorbidos por `06-integrations/`, `07-platform/` y `08-quality/`.

## Regla de mantenimiento

Cuando cambie el producto:

1. actualizar primero el documento tematico afectado;
2. si cambia alcance o arquitectura, actualizar tambien `00-foundations/`;
3. si el cambio toca schemas, rutas o jobs, actualizar `07-platform/`;
4. si el cambio aun no esta implementado, documentarlo como `preparado` o `pendiente`, nunca como `hecho`.
