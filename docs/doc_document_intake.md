# Convertilabs Document Intake

**Status:** Draft v0.1

## Objective

The document intake module transforms uploaded files into structured, reviewable business records that can drive:
- accounting suggestions
- VAT classification
- future tax workflows
- exports

The intake layer is evidence-first. The uploaded file is the source document. Everything else is derived from it.

## Supported Inputs

### Phase 1
- PDF invoices
- PDF receipts
- JPG / JPEG images
- PNG images
- credit notes
- purchase documents
- expense documents

### Deferred
- email ingestion
- WhatsApp ingestion
- XML/e-invoice direct parsing
- batch zip imports
- bank statement ingestion

## Supported Document Directions

### Purchase-side
Primary Phase 1 focus:
- supplier invoices
- expense receipts
- service invoices
- credit notes

### Sale-side
Limited support in Phase 1:
- sales invoices when uploaded directly
- summarized sales import from another system may be added before full sales-side document automation

## Intake Lifecycle

Suggested statuses:

- `uploading`
- `uploaded`
- `queued`
- `extracting`
- `extracted`
- `classified`
- `needs_review`
- `approved`
- `rejected`
- `duplicate`
- `archived`
- `error`

A single document may move through these states as processing advances.

## Processing Pipeline

### 1. Upload
User uploads a file through the UI or API.

System actions:
- create document metadata first with status `uploading`
- store original file in private storage
- finalize the row as `uploaded` when Storage confirms the object
- compute file hash
- assign organization and uploader
- capture basic metadata

### 2. Basic validation
Reject or flag when:
- file type is unsupported
- file is unreadable
- size exceeds limits
- organization context is missing

### 3. Duplicate detection
Use a two-layer approach:
- exact duplicate by file hash
- probable duplicate by vendor + date + total + document number

Probable duplicates should be flagged, not silently discarded.

### 4. OCR / text extraction
The system extracts:
- raw text
- page count
- provider metadata
- confidence metrics where available

### 5. Structured field extraction
Target fields include:
- document type
- direction
- vendor/customer name
- vendor/customer tax id
- document number
- issue date
- due date
- currency
- net amount
- tax amount
- total amount
- detected tax labels
- candidate line items when available

### 6. Classification
The system classifies:
- purchase vs sale
- invoice vs receipt vs credit note
- likely expense category
- potential tax treatment tags
- whether human review is required

### 7. Normalization
Normalize:
- dates to ISO format
- tax ids to a consistent string format
- amounts to canonical decimal strings
- currency codes to ISO-like internal values
- supplier naming variants

### 8. Review trigger
If required facts are missing or confidence is low, move the document to `needs_review`.

## Extracted Document Model

Recommended output shape:

```json
{
  "document_type": "purchase_invoice",
  "direction": "purchase",
  "vendor_name": "UTE",
  "vendor_tax_id": "211111110019",
  "document_number": "A-12345",
  "document_date": "2026-03-01",
  "currency": "UYU",
  "net_amount": "10000.00",
  "tax_amount": "2200.00",
  "total_amount": "12200.00",
  "candidate_category": "utilities",
  "confidence": 0.91
}
```

## Review Rules

A human review is required when:
- total cannot be extracted reliably
- tax amount and total do not reconcile
- vendor is unknown and category confidence is low
- purchase/sale direction is unclear
- document is likely a duplicate
- tax treatment could materially change based on missing context

## Storage Rules

### Buckets
Suggested private buckets:
- `documents-private`
- `exports-private`
- `normative-private`

### File naming
Suggested storage path:
```txt
orgs/{organization_id}/{document_id}/{sanitized_filename}
```

### Metadata
Store:
- hash
- mime type
- original filename
- size
- upload source
- uploader id

## Manual Corrections

Users must be able to correct extracted fields without changing the original document.

Corrections should:
- create a new extraction version or revision
- log who changed what
- optionally trigger re-suggestion of accounting entry

## Error Handling

Common error states:
- OCR provider timeout
- unsupported scan quality
- unreadable image
- inconsistent totals
- missing organization membership

The system should keep the document record even when extraction fails, so the user can retry or correct manually.

## Security and Privacy

Document intake processes sensitive business data. The system must:
- use private storage
- prevent cross-tenant access
- avoid exposing raw documents publicly
- log access to sensitive actions when feasible

## Non-Goals

Phase 1 intake should not try to:
- fully understand every legal edge case during extraction
- replace accounting review
- interpret payroll or banking documents comprehensively
- auto-crawl external government sources

## Summary

Document intake exists to do one job well:
- accept business evidence
- preserve it safely
- extract structured facts
- produce a clean starting point for accounting and tax workflows
