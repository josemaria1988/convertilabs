# Convertilabs VAT (IVA) Support

**Status:** Draft v0.1  
**Scope:** Uruguay-oriented VAT support for Phase 1

## Objective

Provide structured VAT support so that approved accounting data can be grouped, reviewed, and summarized by tax period.

This module is not a full legal filing system in Phase 1. It is a reviewable tax-support layer.

## Product Boundaries

This document defines product behavior, workflow, and data requirements.  
Actual legal criteria must come from the active normative package and explicit tax rules.

## Phase 1 Scope

Included:
- input VAT tagging on purchase documents
- output VAT tagging on sales data
- non-deductible VAT support
- exempt / non-taxed / export-like status tagging
- monthly period aggregation
- reviewable VAT run outputs

Deferred:
- full prorata logic
- import-specific edge cases
- complex adjustments and retroactive corrections
- direct filing with tax authorities

## Required Inputs

The VAT module needs:
- approved or review-ready accounting entries
- tax tags on relevant lines
- sales data or sales entries
- organization and fiscal period
- active normative package for the period
- organization-specific tax rules when applicable

## VAT Status Model

Recommended internal statuses:
- `vat_standard`
- `vat_reduced`
- `vat_exempt`
- `vat_non_taxed`
- `vat_export`
- `vat_input_creditable`
- `vat_input_non_deductible`
- `vat_adjustment`

These statuses must be attached to structured lines, not inferred from unstructured text at reporting time.

## Core Rules

### 1. Accounting and VAT are separate
An expense can be valid in accounting while its VAT is non-creditable.

### 2. VAT treatment is period-aware
The system must use the normative package valid for the selected period.

### 3. Tax treatment requires context
Some VAT outcomes depend on the relation between documents and operations, not on the invoice alone.

Example:
- transport related to an exempt sale may result in non-deductible input VAT

### 4. Missing context should block certainty
If an invoice could be:
- general overhead, or
- directly linked to an exempt operation

the system must request clarification or flag review.

## VAT Run Lifecycle

Suggested statuses:
- `draft`
- `needs_review`
- `reviewed`
- `finalized`
- `locked`

## VAT Calculation Model

### Output VAT
Derived from sales-side taxable lines.

### Input VAT creditable
Derived from purchase-side lines tagged as creditable.

### Input VAT non-deductible
Tracked separately and excluded from recoverable credit.

### Net VAT position
Suggested calculation view:
- output VAT
- minus input VAT creditable
- plus/minus adjustments
- equals period net payable or carry-forward

## Example Output

```json
{
  "period": "2026-03",
  "output_vat": "22000.00",
  "input_vat_creditable": "12000.00",
  "input_vat_non_deductible": "1100.00",
  "adjustments": "0.00",
  "net_vat_payable": "10000.00"
}
```

## Review Flags

A VAT run should raise review flags when:
- a document has missing VAT status
- an entry mixes taxable and exempt context without allocation
- a line total does not reconcile with its source document
- the normative package for that period is missing
- the period contains documents still in `needs_review`

## Linking Rules and Operations

To support non-obvious VAT treatment, the system should allow:
- linking a purchase document to a sale document
- linking a purchase document to an operation or project
- storing explicit contextual tags

This is important for cases such as:
- transport related to exempt sales
- costs tied to export operations
- mixed-use expenses

## Recommended Reports

Phase 1 should be able to generate:
- VAT run summary by period
- supporting line detail
- list of non-deductible VAT documents
- exceptions list requiring review
- exportable summary for accountant use

## Limitations

The first version should not pretend to solve every VAT edge case. That way lies software nonsense and broken tax periods.

Known limitations in early phases:
- partial credit allocation can be limited
- very complex legal interpretations remain manual
- historical recalculations should be controlled tightly
- direct tax authority submissions are out of scope

## Example Scenario

### Case
A transport invoice is uploaded:
- net amount: 5,000
- VAT: 1,100
- linked operation: sale classified as exempt

### Expected treatment
- accounting expense remains recognized
- input VAT is tagged `vat_input_non_deductible`
- VAT run excludes that 1,100 from recoverable credit
- explanation references the matching rule

## Summary

VAT support in Convertilabs should produce:
- structured tagging
- period summaries
- clear exceptions
- reviewable outputs
- auditable application of explicit rules
