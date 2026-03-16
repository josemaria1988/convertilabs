# Agent Rules — Convertilabs

## Core Principle

Convertilabs **is NOT an ERP and is NOT a traditional accounting system**.

Convertilabs is a:

> **Self‑learning accounting automation engine that improves with every human decision.**

The system's purpose is to:

1. Receive financial documents
2. Extract structured facts
3. Suggest accounting treatment
4. Capture user corrections
5. Convert corrections into reusable deterministic rules
6. Automate future decisions

The goal is **progressive automation**, not pre‑encoding every accounting rule in existence.

---

# Mental Model

The system is built around a learning loop:

Document → Suggestion → Human decision → Rule creation → Automation

Example workflow:

1. Accountant uploads 50 invoices
2. System suggests treatment
3. Accountant corrects first 5
4. System learns rules
5. Remaining 45 are processed automatically

The value of the system grows as it accumulates decisions.

---

# What Convertilabs IS

Convertilabs is a **decision engine** that transforms economic events into accounting entries.

Conceptually:

```
Document
→ Extracted facts
→ Operation type
→ Accounting template
→ Learned rule selects account
→ Final journal entry
```

---

# What Convertilabs IS NOT

The system must NOT evolve into:

• a full ERP
• a generic accounting platform
• a feature-heavy bookkeeping UI

Avoid scope creep such as:

• dashboards and charts without automation value
• large manual configuration systems
• massive account libraries
• unnecessary modules

The project succeeds **only if it reduces human accounting decisions**.

---

# The Three Engines of the System

## 1. Document Engine

Responsible for ingesting real-world documents.

Pipeline:

```
upload
→ storage
→ AI extraction
→ document draft
```

Outputs structured facts:

• supplier
• dates
• amounts
• taxes
• line items

## 2. Accounting Decision Engine

Responsible for transforming facts into accounting treatment.

Pipeline:

```
factual review
→ rule engine
→ account selection
→ journal entry preview
→ posting
```

Human corrections become **new accounting rules**.

## 3. Tax Engine

Responsible for calculating taxes from posted entries.

Pipeline:

```
posted documents
→ VAT preview
→ VAT run
→ export
```

Tax logic should be deterministic and based on fiscal regulation.

---

# Role of AI in the System

AI must act as **an assistant to the deterministic engine**, not as the final decision-maker.

Allowed uses of AI:

1. Document data extraction
2. Classification suggestions
3. Pattern discovery in accounting decisions
4. Rule suggestion
5. Anomaly detection

AI must NOT:

• invent accounts
• create irreversible decisions
• bypass rule logic
• replace deterministic fiscal calculations

All final decisions must remain **auditable and deterministic**.

---

# Rule Learning Model

The system should continuously convert user decisions into rules.

Example:

```
vendor: SULO
concept: "containers"
account: inventory_containers
```

Rule generated:

```
if vendor == SULO AND concept contains "container"
→ account = inventory_containers
```

Future invoices automatically follow this rule.

The system improves as rule coverage increases.

---

# Accounting Strategy

The system should NOT attempt to implement a universal accounting model.

Instead it uses three layers:

## 1. Base Chart of Accounts

A minimal universal structure (~60 accounts).

Example groups:

• assets
• liabilities
• revenue
• expenses
• inventory

## 2. Industry Overlays

Applied during onboarding based on activity traits.

Examples:

• importer
• services company
• wholesale trade

## 3. User‑Defined Accounts

Accountants can create custom accounts.

The rule engine learns when those accounts should be used.

---

# Journal Entry Strategy

Instead of thousands of entries, the system uses **templates**.

Core templates:

1. purchase_inventory
2. purchase_expense
3. sales_invoice
4. payment
5. import_operation

Templates define structure:

```
Debit account
Debit VAT
Credit supplier
```

Rules determine **which accounts fill the template**.

---

# Temporary Accounts

When the system lacks certainty, it should fall back to provisional accounts.

Example:

```
TEMP_PURCHASES
```

Users correct the account and the system learns the correct rule.

This prevents workflow blockage.

---

# Learning Loop

```
new document
↓
AI suggestion
↓
user correction
↓
rule stored
↓
automation increases
```

Automation target:

• Early stage: ~70% suggestion
• Mature stage: ~90% automatic

---

# Long‑Term Value

The system accumulates:

• accounting rules
• decision logs
• supplier behavior patterns
• fiscal treatment history

Over time this becomes a **digital memory of the accounting logic of each company or accounting firm**.

This dataset enables advanced capabilities later:

• automated audits
• anomaly detection
• tax optimization insights
• fraud detection

---

# Design Principles

1. Prefer learning over configuration
2. Prefer templates over complex rule trees
3. Prefer deterministic logic for taxes
4. Prefer automation over manual features
5. Every human decision should create knowledge

---

# Guiding Question for Development

Every feature must answer:

> Does this improve document extraction, accounting automation, or tax calculation?

If not, it is probably **not part of the core system**.

---

# Final Reminder

Convertilabs is not building accounting software.

Convertilabs is building:

> **A self‑learning accounting automation engine.**

Every architectural decision should reinforce that goal.
