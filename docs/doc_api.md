# Convertilabs API Draft

**Status:** Draft v0.1  
**Style:** REST-like JSON API with a stable canonical data model  
**Base path:** `/api/v1`

## API Design Goals

The API should support three use cases:
1. the web application itself
2. internal background processing
3. future external integration clients

The API should expose a canonical accounting workflow, not leak UI-specific behavior.

## Authentication

### Phase 1
Web app requests use authenticated Supabase sessions.

### Phase 2
External machine clients use:
- `X-API-Key`
- optional `X-Organization-Id`

## Conventions

### IDs
Use UUIDs for primary resources.

### Amounts
Return monetary values as strings, not floats.

Example:
```json
{ "amount": "1220.00" }
```

### Timestamps
Use ISO 8601 UTC timestamps.

### Idempotency
POST endpoints that create business records should accept:
- `Idempotency-Key`

### Pagination
Collection endpoints should support:
- `limit`
- `cursor` or `page`

### Error format
```json
{
  "error": {
    "code": "validation_error",
    "message": "Document total must be greater than zero.",
    "details": {
      "field": "total_amount"
    }
  }
}
```

## Core Resources

### Organizations
Represents a tenant.

### Documents
Represents the uploaded source evidence.

### Extractions
Represents structured facts derived from the document.

### Suggestions
Represents a draft accounting suggestion.

### Journal Entries
Represents balanced accounting records.

### Tax Rules
Represents explicit condition/effect rules.

### Tax Periods
Represents monthly or yearly tax periods.

### VAT Runs
Represents a VAT calculation snapshot for a period.

### Exports
Represents generated outputs for external systems.

## Endpoints

## Health

### GET `/api/v1/health`
Returns service status.

Response:
```json
{
  "status": "ok",
  "service": "convertilabs",
  "version": "v1"
}
```

## Auth

### POST `/api/v1/auth/signup`
Create a web-app user in Supabase Auth.

Request:
```json
{
  "fullName": "Jose Maria Sosa",
  "email": "jose@convertilabs.com",
  "password": "lab2026seguro"
}
```

Response:
```json
{
  "data": {
    "status": "signup_requested",
    "email": "jose@convertilabs.com",
    "message": "Check your inbox to confirm access.",
    "next_step": "check_email"
  }
}
```

Notes:
- use backend validation before calling Supabase
- return generic success for already-registered emails to reduce account enumeration
- store `full_name` in auth user metadata
- keep service-role user creation for admin-only flows, not public signup
- default redirect after email confirmation: `/login?signup=confirmed`

## Organizations

### POST `/api/v1/organizations`
Create an organization.

Request:
```json
{
  "name": "Rontil SAS",
  "slug": "rontil-sas",
  "country_code": "UY",
  "base_currency": "UYU",
  "legal_entity_type": "sas",
  "tax_id": "219999990012"
}
```

### GET `/api/v1/organizations/:id`
Fetch organization details.

## Chart of Accounts

### GET `/api/v1/chart-of-accounts`
List accounts for the active organization.

### POST `/api/v1/chart-of-accounts`
Create an account.

Request:
```json
{
  "code": "6105",
  "name": "Freight Expense",
  "account_type": "expense",
  "normal_side": "debit",
  "is_postable": true
}
```

## Documents

### POST `/api/v1/documents`
Upload a document.

Recommended request:
- `multipart/form-data`

Fields:
- `file`
- `direction` (`purchase` | `sale` | `other`)
- `document_type` optional
- `notes` optional

Response:
```json
{
  "id": "uuid",
  "status": "uploaded",
  "filename": "invoice-001.pdf"
}
```

### GET `/api/v1/documents/:id`
Fetch document metadata, status, extraction summary, and linked suggestion.

### POST `/api/v1/documents/:id/process`
Trigger extraction and classification.

Response:
```json
{
  "id": "uuid",
  "status": "processing_started"
}
```

### PATCH `/api/v1/documents/:id/extracted-fields`
Manually correct extracted data.

Request:
```json
{
  "vendor_name": "Transportes del Litoral",
  "document_date": "2026-03-10",
  "net_amount": "5000.00",
  "tax_amount": "1100.00",
  "total_amount": "6100.00"
}
```

## Suggestions

### GET `/api/v1/documents/:id/suggestions`
List suggestion versions for a document.

### POST `/api/v1/documents/:id/suggestions`
Generate or regenerate a suggestion.

Response:
```json
{
  "id": "uuid",
  "status": "needs_review",
  "confidence": 0.81,
  "entry_date": "2026-03-10",
  "lines": [
    {
      "side": "debit",
      "account_code": "6105",
      "amount": "5000.00",
      "label": "Freight Expense"
    },
    {
      "side": "debit",
      "account_code": "6199",
      "amount": "1100.00",
      "label": "Non-deductible VAT"
    },
    {
      "side": "credit",
      "account_code": "1110",
      "amount": "6100.00",
      "label": "Bank"
    }
  ],
  "tax_treatment": {
    "vat_status": "non_deductible_input_vat"
  },
  "explanation": "Transport cost linked to an exempt sale under the active rule set."
}
```

### POST `/api/v1/suggestions/:id/approve`
Approve a suggestion and create or update a journal entry.

Request:
```json
{
  "create_rule_from_override": false
}
```

Response:
```json
{
  "journal_entry_id": "uuid",
  "status": "approved"
}
```

### POST `/api/v1/suggestions/:id/reject`
Reject a suggestion.

## Journal Entries

### GET `/api/v1/journal-entries`
List entries with filters:
- `status`
- `period_id`
- `document_id`
- `date_from`
- `date_to`

### GET `/api/v1/journal-entries/:id`
Fetch a single entry.

### POST `/api/v1/journal-entries`
Create an entry manually.

### PATCH `/api/v1/journal-entries/:id`
Edit a draft or review-stage entry.

### POST `/api/v1/journal-entries/:id/post`
Mark entry as posted, subject to rules and permissions.

## Tax Rules

### GET `/api/v1/tax-rules`
List applicable tax rules.

Filters:
- `tax_type`
- `active`
- `year`

### POST `/api/v1/tax-rules`
Create a rule.

Request:
```json
{
  "name": "transport_related_to_exempt_sale",
  "tax_type": "VAT",
  "priority": 100,
  "valid_from": "2026-01-01",
  "conditions": [
    { "field": "linked_sale_vat_status", "operator": "eq", "value": "exempt" },
    { "field": "expense_category", "operator": "eq", "value": "transport" }
  ],
  "effects": [
    { "field": "purchase_vat_credit", "value": "disallow" }
  ]
}
```

## Tax Periods

### GET `/api/v1/tax-periods`
List tax periods for the organization.

### POST `/api/v1/tax-periods`
Create a period.

### POST `/api/v1/tax-periods/:id/close`
Close the period. Closed periods are locked by default.

## VAT Runs

### POST `/api/v1/vat-runs`
Create a VAT run.

Request:
```json
{
  "period_id": "uuid"
}
```

Response:
```json
{
  "id": "uuid",
  "status": "draft",
  "period_id": "uuid"
}
```

### GET `/api/v1/vat-runs/:id`
Fetch calculation results.

Example:
```json
{
  "id": "uuid",
  "status": "draft",
  "totals": {
    "output_vat": "22000.00",
    "input_vat_creditable": "12000.00",
    "input_vat_non_deductible": "1100.00",
    "net_vat_payable": "10000.00"
  }
}
```

### POST `/api/v1/vat-runs/:id/finalize`
Finalize a reviewed VAT run.

## Exports

### POST `/api/v1/exports/zeta`
Generate a Zeta-compatible export.

Request:
```json
{
  "period_id": "uuid",
  "entry_ids": ["uuid-1", "uuid-2"]
}
```

Response:
```json
{
  "id": "uuid",
  "status": "generated",
  "target_system": "zeta",
  "download_url": null
}
```

### GET `/api/v1/exports/:id`
Fetch export metadata and status.

## Future Integration Endpoints

Planned later:
- API key management
- webhook subscriptions
- sales import endpoints
- normative package management
- IRAE/IP runs
- payroll/BPS endpoints

## Webhook Events (Planned)

Suggested events:
- `document.uploaded`
- `document.extracted`
- `suggestion.created`
- `suggestion.approved`
- `journal_entry.posted`
- `vat_run.finalized`
- `export.generated`

## Response Model Principles

Every business-critical response should include:
- stable ids
- current status
- timestamps
- links to related resources
- audit-relevant metadata where appropriate

## Summary

The API should expose a clean workflow:
1. upload document
2. extract and classify
3. generate suggestion
4. review and approve
5. run VAT support
6. export accounting data
