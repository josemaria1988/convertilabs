# Convertilabs Project Architecture

**Status:** Draft v0.1

## Architecture Goal

Build a product that can launch quickly as a usable application while remaining structurally ready to become:
- a multi-tenant SaaS
- an integration API
- an export engine for accounting systems
- a rule-driven tax workflow platform

The first release should avoid premature microservice theater. A modular monolith is the correct starting point.

## Architecture Principles

### 1. Modular monolith first
Start with one deployable application and clear module boundaries.

### 2. API-first design
Even if the web app is the first interface, internal actions should map cleanly to service endpoints and stable resource models.

### 3. Multi-tenant from day one
Every business record is organization-scoped.

### 4. Deterministic fiscal core
LLMs assist with extraction, classification, and explanation. Final tax treatment logic must be expressible as structured rules.

### 5. Provider abstraction
OCR and AI providers must be replaceable.

### 6. Auditability over cleverness
Every important operation should be replayable and explainable.

## Recommended Phase 1 Stack

### Frontend and application layer
- Next.js App Router
- TypeScript
- Server Actions and Route Handlers where appropriate
- Deployed on Vercel

### Data and auth
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Row Level Security

### AI and OCR
- OCR provider adapter
- LLM provider adapter
- prompt templates and structured outputs stored inside the application

### Background processing
Initial implementation options:
- job table in Postgres plus scheduled/background runners
- simple async processing triggered after upload

Later extraction path:
- dedicated worker process
- queue system
- separate API and worker runtimes

## High-Level Modules

Recommended internal module boundaries:

Keep business rules inside `/modules`. Use `/components` for shared UI, `/styles` for global styling, and `/public` for static assets so presentation concerns do not absorb domain logic.

```txt
/app
  /(marketing)
  /dashboard
  /api

/components
/public
/styles

/modules
  /auth
  /organizations
  /documents
  /document-intake
  /accounting
  /tax
  /rules
  /exports
  /audit
  /ai

/lib
  /db
  /storage
  /ocr
  /llm
  /utils

/supabase
  /migrations
  /policies
  /seed

/docs
```

## Runtime Architecture

### Web application
Responsible for:
- authentication
- dashboards
- upload flows
- review screens
- settings
- exports

### Application API
Responsible for:
- CRUD operations
- document processing triggers
- suggestion approvals
- VAT run creation
- export generation requests

### Database
Responsible for:
- primary source of truth
- tenant isolation
- audit records
- job coordination in early stages

### Storage
Responsible for:
- original files
- processed exports
- normative package files

### AI/OCR services
Responsible for:
- text extraction
- classification support
- structured fact extraction
- explanation generation

## Core Data Flow

### 1. Document upload
User uploads file -> file stored -> document row created -> status `uploaded`

### 2. Intake processing
OCR and parsing run -> extracted fields stored -> document classified -> status `extracted`

### 3. Suggestion generation
Accounting and tax modules consume extracted fields -> suggestion created -> status `needs_review` or `ready_for_review`

### 4. Human review
Reviewer edits or approves suggestion -> journal entry created or updated

### 5. VAT support
Approved entries and sales data are grouped by tax period -> VAT run calculated -> reviewable result

### 6. Export
Approved entries are transformed by an adapter into:
- CSV
- JSON
- later external API payloads

## Deployment Model

### Phase 1
Single web/application deployment on Vercel backed by Supabase.

### Phase 2
Introduce:
- dedicated worker runtime
- public API subdomain
- separate docs site
- webhook dispatch worker

### Suggested domain layout
- `convertilabs.com` for marketing
- `app.convertilabs.com` for the application
- `api.convertilabs.com` for external API
- `docs.convertilabs.com` for API and integration docs

## Security Model

### Authentication
- Supabase session for app users
- API key or service credential for machine clients later

### Authorization
- organization-scoped membership model
- role-based access checks
- RLS policies on all tenant tables

### Storage
- private buckets only
- signed URLs for controlled access
- avoid public document exposure

### Audit
Log:
- who uploaded
- who edited extracted fields
- who approved a suggestion
- who changed a rule
- who exported data

## Observability

Minimum recommended telemetry:
- request logs
- processing job logs
- OCR provider latency
- AI provider latency
- failed extraction count
- failed export count
- VAT run duration
- audit trail for business-critical changes

## Scalability Path

The design should support a gradual evolution:

### Stage 1
Next.js + Supabase as a modular monolith

### Stage 2
Separate worker runtime for document processing and exports

### Stage 3
Public API with API keys, rate limiting, webhooks, and integration docs

### Stage 4
Dedicated rule engine and broader tax modules

## Architectural Boundaries

### AI should do
- document understanding
- classification
- explanation
- suggestion drafting

### AI should not do alone
- final posting decisions
- legal package selection without metadata
- closed-period mutation
- stable export formatting without adapter rules

## Non-Goals

Do not start with:
- microservices for each module
- multiple databases
- a custom event bus
- auto-updating legal crawlers
- payroll/BPS engine in the first milestone

## Summary

The architecture should launch as a modular monolith with strong boundaries:
- Vercel-hosted app
- Supabase-backed data model
- AI/OCR adapters
- deterministic accounting and tax modules
- clear path to API and worker separation
