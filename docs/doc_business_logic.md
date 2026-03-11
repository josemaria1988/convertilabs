# Convertilabs Business Logic

**Status:** Draft v0.1  
**Scope:** Phase 1 focused on document intake, accounting entry suggestions, VAT support, and export-ready outputs.

## Product Summary

Convertilabs converts business documents into:
- structured document records
- extracted accounting facts
- suggested journal entries
- VAT-ready classifications
- exportable accounting outputs

The product is designed for Uruguay-based SMEs, SAS entities, accountants, and software integrators.

The product is **not** positioned as a magic black box. It is a workflow engine with AI assistance and deterministic control.

## Core Value Proposition

### For businesses
Reduce manual bookkeeping time and improve consistency in document processing.

### For accountants
Review structured suggestions instead of typing every invoice manually.

### For software partners
Consume a stable accounting and tax-oriented API instead of building custom logic for each client.

## User Roles

### Organization Owner
- creates the organization
- configures defaults
- manages members
- approves strategic settings

### Accountant / Reviewer
- reviews extracted documents
- approves or edits accounting suggestions
- validates VAT treatment
- closes periods

### Operator / Staff User
- uploads documents
- fixes missing metadata
- prepares documents for review

### Developer / Integration Client
- sends documents through API
- fetches normalized outputs
- consumes exports or webhooks

## Primary Domain Concepts

### Organization
A tenant in the system. All accounting data is organization-scoped.

### Fiscal Period
A month or year used for VAT and later other taxes.

### Source Document
An uploaded invoice, receipt, credit note, contract, or related file.

### Extracted Document
Structured data derived from OCR and parsing.

### Accounting Suggestion
A draft proposal of journal entry lines derived from the document.

### Journal Entry
A balanced accounting entry that may be draft, approved, posted, or exported.

### Tax Rule
A structured condition/effect rule used to determine VAT or future tax treatment.

### Normative Package
A curated set of legal and administrative materials associated with a specific tax year and tax type.

## Main Business Flow

### 1. Organization setup
The organization is created with:
- legal entity type
- country
- tax id
- base currency
- chart of accounts
- initial fiscal settings

### 2. Document upload
A user uploads a file. The system stores the original source file and creates a document record.

### 3. Extraction and classification
The system:
- extracts text
- identifies document type
- parses date, tax id, amounts, taxes, currency, supplier/customer
- assigns confidence scores

### 4. Accounting suggestion
The system creates a suggested journal entry using:
- chart of accounts
- vendor defaults
- rule-based tax treatment
- known document patterns
- active normative package

### 5. Review and approval
A reviewer:
- accepts the suggestion
- edits it
- rejects it
- creates a persistent rule if the correction should recur

### 6. VAT period support
Approved entries and tagged sales data feed a VAT period run.

### 7. Export / integration
Approved entries can be exported in standardized format for external systems.

## Business Rules

### Tenant isolation
Every operational record belongs to exactly one organization.

### Original file immutability
Original documents are never overwritten. Any correction applies to extracted or normalized data, not the source file.

### Versioned extraction
A document can have multiple extraction versions. The latest approved extraction is the active one.

### Versioned suggestions
A document can have multiple accounting suggestions over time, but only one active suggestion version at a time.

### Balanced entries only
A journal entry must satisfy:
- total debit = total credit
- all lines use valid postable accounts
- currency and monetary formatting rules are respected

### Accounting and tax are separate layers
The same document may create:
- one accounting classification
- a different VAT treatment
- later, a different IRAE/IP treatment

### Rule precedence
Suggested precedence:
1. direct document override
2. organization-specific rule
3. organization-specific mapping
4. normative package rule
5. global default mapping

### Closed period lock
A closed period blocks routine edits. Reopening must be explicit and audited.

### Export does not equal accounting truth
An export is a transmission event. The internal approved record remains the source of truth.

## Phase 1 Scope

Included:
- organization setup
- chart of accounts
- document upload
- OCR and extraction
- accounting entry suggestions
- VAT classification support
- Zeta-compatible export
- audit logs
- manual yearly normative packages

Not included:
- automatic legal scraping/updating
- payroll and BPS
- bank reconciliation
- direct government filing
- full IRAE and IP calculation engine
- multi-country tax logic

## Future Scope

### Phase 2
- IRAE support
- Wealth tax / IP support
- better rule coverage
- external API keys and webhooks

### Phase 3
- payroll
- BPS support
- broader ERP integrations
- automation around recurrent monthly close

## Decision Principles

When there is a conflict between speed and auditability, auditability wins.  
When there is a conflict between AI convenience and deterministic correctness, deterministic correctness wins.  
When there is a conflict between automation and human control in Phase 1, human control wins.

## KPIs

Suggested KPIs for the first release:
- time from upload to approved entry
- % of documents auto-classified
- % of suggestions approved without edits
- VAT run preparation time
- duplicate document detection rate
- average review time per document
- export error rate

## Product Positioning

Convertilabs should be described as:
- AI-assisted accounting workflow infrastructure for Uruguay
- not a generic chatbot
- not a full ERP on day one
- not an autopilot for tax filing

## Summary

The business logic is simple:
1. ingest evidence
2. extract facts
3. suggest entries
4. apply explicit tax rules
5. require review where necessary
6. produce structured, exportable outcomes
