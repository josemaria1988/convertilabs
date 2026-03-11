# Convertilabs Export and API-Ready Architecture

**Status:** Draft v0.1

## Objective

Design the system so that the same internal data can be:
- reviewed in the web app
- exported to external accounting systems
- exposed through a future public API
- consumed by integration partners

The internal data model must be canonical. Export formats are adapters, not the source of truth.

## Core Principle

**Internal canonical model first. Adapter second.**

This prevents the product from becoming "whatever one vendor CSV happened to need last Tuesday."

## Canonical Internal Objects

The export layer should depend on stable internal resources:

- organization
- chart account
- document
- extraction
- suggestion
- journal entry
- journal entry line
- tax period
- VAT run
- export job

## Export Strategy

### Phase 1
Support:
- CSV export for Zeta or similar accounting import workflows
- JSON export bundle for debugging and integration
- downloadable export artifacts from the app

### Phase 2
Add:
- API endpoints for machine consumers
- webhooks
- per-client API keys
- partner-specific adapters

## Adapter Pattern

Recommended design:

```txt
canonical journal entry
        ->
export adapter
        ->
target-specific payload
```

Examples of adapters:
- `zetaCsvAdapter`
- `genericJsonAdapter`
- `futureErpXAdapter`

Each adapter should define:
- required fields
- transformation rules
- formatting rules
- validation rules
- file naming convention

## Zeta Export Principle

The Zeta adapter should map canonical journal entries into:
- date
- debit account
- credit account
- amount
- description / reference
- optional tax tags where useful

The export adapter must not guess missing accounting information. It should fail validation if the canonical entry is incomplete.

## API-Ready Design Principles

### Stable resource IDs
Every exported or externally referenced object should have a durable ID.

### Explicit statuses
Machine clients must be able to distinguish:
- draft
- needs_review
- approved
- posted
- exported
- failed

### Versioned contracts
The public API should be versioned from the start:
- `/api/v1/...`

### Idempotent creation
Repeated integration calls must not create duplicates when the same idempotency key is used.

### Webhook-friendly events
Important state changes should emit a standard event model later.

## Suggested Event Types

- `document.uploaded`
- `document.processed`
- `suggestion.generated`
- `suggestion.approved`
- `journal_entry.created`
- `journal_entry.posted`
- `vat_run.finalized`
- `export.generated`
- `export.failed`

## Export Job Lifecycle

Suggested statuses:
- `queued`
- `generating`
- `generated`
- `downloaded`
- `failed`
- `expired`

Each export job should store:
- target system
- filter criteria
- generated payload metadata
- checksum
- storage location
- created by
- timestamps

## Public API Roadmap

### Stage 1
Internal app-only routes

### Stage 2
Documented partner API with API keys

### Stage 3
Webhook subscriptions and async callbacks

### Stage 4
Embedded API for third-party management systems

## External Client Model

Planned external entities:
- API clients
- API keys
- webhook subscriptions
- allowed organizations / scopes
- rate-limit profiles

## Data Contract Recommendations

### Money
Return as decimal strings in JSON.  
Do not use binary floats in API payloads.

### Dates
Use ISO 8601 date strings.

### Enums
Use stable enum values, not localized labels.

Example:
- good: `vat_input_non_deductible`
- bad: `IVA No Deducible`

Localization belongs in the UI, not in the API contract.

## Security

For public API exposure:
- API keys must be stored hashed
- webhooks must be signed
- exports must use private storage
- signed download URLs should expire
- tenant scoping must be enforced server-side

## Suggested Domain Layout

- `convertilabs.com` -> marketing
- `app.convertilabs.com` -> app UI
- `api.convertilabs.com` -> external API
- `docs.convertilabs.com` -> public docs

## Non-Goals

Do not start by building:
- direct write-access integrations to many ERPs
- bidirectional sync everywhere
- vendor-specific custom logic in the core domain
- public API without tenant isolation and audit logs

## Summary

The export and API design should follow one rule:
build a clean internal accounting model once, then adapt it outward cleanly for CSV, JSON, and future API clients.
