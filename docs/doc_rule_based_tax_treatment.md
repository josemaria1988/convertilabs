# Convertilabs Rule-Based Tax Treatment

**Status:** Draft v0.1

## Purpose

This document defines how tax treatment should be determined through structured rules rather than free-form AI opinion.

Phase 1 focuses on VAT. The same design should later support IRAE and IP.

## Why a Rules Engine Exists

Tax treatment is not reliably solved by document reading alone. Many outcomes depend on:
- document context
- relation to another operation
- fiscal period
- organization-specific policy
- legal rules effective for a specific year

A rules engine gives:
- determinism
- versioning
- explainability
- testability
- auditable overrides

## Rule Layers

Suggested precedence order:

1. direct transaction override
2. organization-specific rule
3. organization-specific default mapping
4. normative package rule
5. global fallback rule

Higher-priority rules win when they conflict.

## Rule Structure

Each rule should contain:

- `id`
- `name`
- `tax_type`
- `scope` (`global` | `package` | `organization`)
- `priority`
- `active`
- `valid_from`
- `valid_to`
- `conditions`
- `effects`
- `source_reference`
- `created_by`
- `notes`

## Example Rule Shape

```json
{
  "name": "transport_related_to_exempt_sale",
  "tax_type": "VAT",
  "scope": "organization",
  "priority": 100,
  "active": true,
  "valid_from": "2026-01-01",
  "valid_to": null,
  "conditions": [
    { "field": "document.direction", "operator": "eq", "value": "purchase" },
    { "field": "document.category", "operator": "eq", "value": "transport" },
    { "field": "linked_sale.vat_status", "operator": "eq", "value": "vat_exempt" }
  ],
  "effects": [
    { "field": "tax.vat_input_credit", "value": "disallow" },
    { "field": "tax.vat_status", "value": "vat_input_non_deductible" }
  ],
  "source_reference": "internal-accounting-policy-001"
}
```

## Fact Model

Rules must evaluate against structured facts, not raw OCR text.

Suggested fact sources:
- document fields
- extraction outputs
- linked document fields
- organization settings
- chart-of-accounts metadata
- fiscal period metadata
- user-provided context

## Rule Evaluation Process

### 1. Collect facts
Build a normalized fact object for the document or transaction.

### 2. Load active rules
Load all rules where:
- tax type matches
- organization scope applies
- period falls within validity
- rule is active

### 3. Sort rules
Sort by:
- priority descending
- scope specificity
- explicitness of match

### 4. Apply effects
Apply rule effects to a temporary tax treatment result.

### 5. Resolve conflicts
Conflicts should be resolved by precedence rules. The engine should not silently merge contradictory effects.

### 6. Produce trace
Store which rules matched and what effect each rule had.

## Rule Effect Examples

Possible rule effects:
- allow/disallow input VAT credit
- set VAT status
- mark expense as needs review
- reclassify tax component to non-deductible bucket
- require linked operation evidence
- require manual approval
- flag mixed treatment

Later for IRAE/IP:
- deductible / non-deductible
- capitalization required
- asset inclusion / exclusion
- valuation method flag

## Year-Specific Normative Packages

Rules attached to legal criteria should belong to a package or reference one.

Package behavior:
- packages are loaded manually by year in early phases
- each package has validity metadata
- multiple packages may coexist historically
- the engine selects the correct package by period

This prevents a common accounting software disaster: applying 2026 logic to 2023 data because someone thought time was optional.

## AI vs Rule Engine

### AI may:
- extract facts
- classify candidate category
- suggest possible rule matches
- generate explanation text

### Rule engine must:
- decide structured tax outcome
- enforce validity dates
- apply organization overrides
- keep traceable deterministic results

## Rule Authoring Guidelines

Rules should be:
- narrow
- explicit
- testable
- valid for a clear time range
- linked to a source reference or internal policy record

Avoid:
- vague conditions
- giant catch-all rules
- rules that mix accounting and tax in one effect blob
- hidden prompt-only logic

## Testing Requirements

Each rule should have:
- positive match cases
- negative match cases
- boundary date cases
- conflict cases
- explanation snapshot

## Example Cases

### Case 1: Transport linked to exempt sale
Result:
- expense recognized
- VAT input non-deductible
- explanation references matched rule

### Case 2: General office transport with no exempt link
Result:
- may remain creditable if no disallowing rule applies
- no exempt-link rule match should occur

### Case 3: Missing linked operation
Result:
- no certainty
- `needs_review` flag
- block auto-finalization

## Rule Persistence from User Corrections

A user correction may become a rule only when:
- user has permission
- rule is reviewed
- scope is defined
- validity dates are defined
- effect is explicit

## Summary

The tax engine should behave like this:
- facts in
- rules applied
- outcome produced
- trace stored
- explanation generated
- no invisible magic
