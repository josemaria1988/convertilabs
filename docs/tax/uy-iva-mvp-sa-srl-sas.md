# UY IVA MVP SA/SRL/SAS

Documento canónico derivado de [uy-iva-mvp-sa-srl-sas-step-driven.md](/docs/tax/uy-iva-mvp-sa-srl-sas-step-driven.md).

## Decisiones cerradas

- El motor fiscal automático V1 aplica solo a organizaciones `UY`.
- La forma jurídica soportada para automatización es `SA`, `SRL` o `SAS`.
- El gating fiscal requiere `vat_regime = GENERAL`.
- `tax_regime_code` no reemplaza a `vat_regime`; ambos conviven.
- `dgi_group` y `cfe_status` se guardan en el perfil fiscal versionado por trazabilidad futura.
- La IA no recibe normativa completa: sólo `organization_rule_snapshots`.
- Exportaciones, operaciones mixtas y casos no claramente gravados pasan a `manual review` salvo regla aprobada.

## Estado actual en código

- `organizations`, `organization_profile_versions` y `organization_rule_snapshots` guardan `vat_regime`, `dgi_group` y `cfe_status`.
- Onboarding y Settings exponen esos campos y materializan nuevas versiones/snapshots.
- El review documental usa un motor separado en `modules/tax/uy-vat-engine.ts`.
- `vat_runs` sigue reconstruyéndose desde documentos confirmados usando el tratamiento fiscal persistido.

## Feature Flags

- `VAT_UY_MVP_ENABLED`
- `VAT_UY_EXPORT_AUTO_DISABLED`
- `VAT_UY_MIXED_USE_MANUAL_REVIEW`
- `VAT_UY_SIMPLIFIED_REGIME_AUTO_DISABLED`

## Regla operativa

Si falta `vat_regime`, si es distinto de `GENERAL`, o si el caso cae fuera del catálogo seguro del MVP, el documento no queda confirmable y se marca para revisión manual.
