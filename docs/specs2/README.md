# Specs2 - Paquete SDD Convertilabs V1

**Estado del paquete:** Approved with follow-up

Este paquete ya no esta bloqueado por decisiones de alcance.

Decisiones cerradas:

- Uruguay only
- IVA only
- compra automatizable
- venta incluida en V1
- sin emision
- confirmacion final unica
- OpenAI `gpt-4o-mini` server-side para intake documental
- snapshots resumidos por organizacion en lugar de normativa completa en prompt

## Estado de specs

| Spec | Estado |
|---|---|
| 00-scope-map.md | Approved |
| 01-organization-tax-profile.md | Approved |
| 02-document-extraction-pipeline.md | Approved with follow-up |
| 03-purchase-invoice-processing.md | Approved |
| 04-sales-invoice-processing.md | Approved |
| 05-editable-draft-wizard.md | Approved |
| 06-journal-entry-suggestion.md | Approved with follow-up |
| 07-tax-treatment-suggestion.md | Approved |
| 08-final-confirmation-and-reopen.md | Approved |
| 09-tax-regulation-knowledge-base.md | Approved with follow-up |
| 10-open-questions.md | Updated |

## Regla de trabajo

Los follow-ups que siguen abiertos ya no son de producto base sino de hardening:

- worker/cola para procesamiento documental
- UI normativa completa
- mapping contable mas rico
- highlights de origen y mejor autosave
