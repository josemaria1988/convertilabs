# Convertilabs Accounting Entry Suggestions

**Status:** Draft v0.1

## Objective

The accounting suggestion module converts a processed document into a proposed balanced journal entry.

It is a drafting engine, not an unconditional posting engine.

## Inputs

A suggestion may use:
- extracted document fields
- document direction and type
- chart of accounts
- vendor defaults
- organization defaults
- rule-based tax treatment
- prior approved mappings
- user-specified context

## Output

A suggestion should include:
- entry date
- document reference
- debit and credit lines
- amounts
- account references
- tax tags
- confidence score
- short explanation
- rule trace

## Suggestion Pipeline

### 1. Validate document facts
Required minimum data:
- date
- total amount
- currency
- counterparty or category
- direction
- tax amount or explicit no-tax status

If minimum data is missing, return `needs_review` instead of inventing lines.

### 2. Determine transaction direction
Examples:
- purchase invoice -> debit expense/asset + debit recoverable or non-deductible tax + credit payable/bank
- sales invoice -> debit receivable/cash + credit revenue + credit output VAT
- credit note -> reverse the original logic or create contra entry

### 3. Resolve candidate accounts
Account resolution order:
1. explicit user override
2. vendor default mapping
3. organization rule
4. document category mapping
5. safe fallback category

### 4. Apply tax treatment
Tax treatment does not create accounting by itself, but it affects line composition.

Examples:
- recoverable VAT may go to `VAT credit`
- non-deductible VAT may go to a separate expense or tax-disallowed bucket
- exempt sale may create revenue without output VAT

### 5. Build balanced lines
The engine must verify:
- entry balances
- every line uses a postable account
- amounts reconcile to document totals

### 6. Score confidence
Confidence should consider:
- extraction quality
- account mapping certainty
- rule certainty
- whether custom overrides exist
- whether key facts were manually entered

### 7. Produce explanation
The explanation should be short and auditable.

Example:
> "Mapped vendor UTE to Utilities Expense based on organization default. VAT treated as recoverable input VAT under the active period package."

## Suggestion Statuses

Suggested states:
- `drafted`
- `needs_review`
- `ready_for_review`
- `approved`
- `rejected`
- `superseded`

## Suggestion Data Model

```json
{
  "document_id": "uuid",
  "status": "needs_review",
  "confidence": 0.83,
  "entry_date": "2026-03-10",
  "currency": "UYU",
  "lines": [
    {
      "line_no": 1,
      "side": "debit",
      "account_code": "6105",
      "account_name": "Freight Expense",
      "amount": "5000.00"
    },
    {
      "line_no": 2,
      "side": "debit",
      "account_code": "6199",
      "account_name": "Non-deductible VAT",
      "amount": "1100.00",
      "tax_tag": "vat_non_deductible"
    },
    {
      "line_no": 3,
      "side": "credit",
      "account_code": "1110",
      "account_name": "Bank",
      "amount": "6100.00"
    }
  ],
  "explanation": "Transport expense linked to exempt sale. VAT input was treated as non-deductible.",
  "rule_trace": ["rule-uuid-1"]
}
```

## Approval Workflow

### Reviewer can:
- approve as-is
- edit and approve
- reject
- convert correction into persistent mapping or rule

### On approval:
- create or update a journal entry
- keep reference to source suggestion
- keep full audit trail

### On edit:
- preserve original suggestion version
- create a new approved version or linked journal entry edit

## Examples

## Example 1: Utility bill
Document:
- vendor: UTE
- total: 12,200
- net: 10,000
- VAT: 2,200

Suggested entry:
- Debit Utilities Expense 10,000
- Debit VAT Credit 2,200
- Credit Accounts Payable 12,200

## Example 2: Freight related to exempt sale
Document:
- vendor: Transportes del Litoral
- total: 6,100
- net: 5,000
- VAT: 1,100
- linked sale: exempt

Suggested entry:
- Debit Freight Expense 5,000
- Debit Non-deductible VAT 1,100
- Credit Bank 6,100

## Learning from Corrections

Corrections may become:
- vendor default account mapping
- recurring template
- organization-specific tax rule
- preferred payment account selection

A single correction should not automatically become a global truth without explicit approval.

## Non-Goals

The suggestion module should not:
- auto-post without policy approval
- invent missing totals
- force one accounting treatment when capitalization vs expense is unclear
- bypass period locks
- hide unresolved ambiguity

## Summary

A good suggestion engine does not try to be magical. It does something more useful:
- proposes a balanced entry
- explains itself
- shows confidence
- hands control to the reviewer when uncertainty matters
