import Link from "next/link";
import { siteConfig } from "@/lib/site";

const capabilities = [
  "Extract data from invoices and receipts",
  "Suggest journal entries",
  "Apply tax treatment rules",
  "Keep year-specific regulatory logic",
  "Export to external systems and APIs",
];

const audiences = [
  {
    name: "SMEs",
    description:
      "Companies that need cleaner bookkeeping, VAT workflows, and less manual document handling.",
  },
  {
    name: "Accounting firms",
    description:
      "Teams managing multiple clients, recurring fiscal routines, and review-heavy processes.",
  },
  {
    name: "ERP / management systems",
    description:
      "Platforms that want Uruguay-specific accounting and tax logic without rebuilding it from scratch.",
  },
  {
    name: "Developers",
    description:
      "Product teams integrating tax and accounting workflows into internal tools or customer-facing software.",
  },
];

const roadmap = [
  {
    phase: "Phase 1",
    title: "Document ingestion + accounting entries + VAT",
    detail:
      "Capture invoices and receipts, extract key fields, and turn them into structured accounting with VAT logic.",
  },
  {
    phase: "Phase 2",
    title: "IRAE + Wealth Tax",
    detail:
      "Expand the fiscal engine with year-aware corporate tax and patrimonio workflows for Uruguay.",
  },
  {
    phase: "Phase 3",
    title: "Payroll + BPS",
    detail:
      "Add payroll operations and social security processes to extend the platform beyond bookkeeping.",
  },
  {
    phase: "Phase 4",
    title: "Public API for third-party systems",
    detail:
      "Open the platform for software vendors, ERPs, and partners that need reliable accounting and tax building blocks.",
  },
];

const operatingSignals = [
  { label: "Document intake", value: "Automated" },
  { label: "VAT workflows", value: "Structured" },
  { label: "Fiscal logic", value: "Year-specific" },
];

const workflowCards = [
  {
    step: "01",
    title: "Document intake",
    description: "Invoices and receipts are collected, normalized, and prepared for review.",
  },
  {
    step: "02",
    title: "Accounting logic",
    description: "The system suggests entries and applies reusable posting rules.",
  },
  {
    step: "03",
    title: "Tax treatment",
    description: "VAT and fiscal rules are applied without splitting the workflow into separate tools.",
  },
  {
    step: "04",
    title: "External output",
    description: "Structured data can be exported to external systems or exposed through APIs.",
  },
];

export default function HomePage() {
  return (
    <div className="page-shell space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[color:var(--color-border)] bg-[linear-gradient(135deg,rgba(19,24,31,0.98),rgba(31,29,26,0.94))] text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.32),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(217,119,6,0.18),transparent_18%)]" />
        <div className="absolute inset-y-0 right-0 hidden w-[42%] border-l border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] lg:block" />

        <div className="relative grid gap-10 px-6 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1.05fr)_430px] lg:px-10 lg:py-12">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/72">
              <span className="h-2 w-2 rounded-full bg-[color:var(--color-warm)]" />
              Built for Uruguay
            </span>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.07em] text-balance md:text-6xl lg:text-7xl">
                Accounting and tax infrastructure for Uruguay
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/74 md:text-xl">
                Automate document intake, accounting entries, VAT workflows, and
                fiscal logic for SMEs, firms, and software platforms.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-full bg-[color:var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-strong)]"
              >
                Request demo
              </Link>
              <a
                href="#waitlist"
                className="rounded-full border border-white/14 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Join waitlist
              </a>
            </div>

            <div className="grid gap-3 pt-2 md:grid-cols-3">
              {operatingSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                    {signal.label}
                  </p>
                  <p className="mt-3 text-xl font-semibold tracking-[-0.05em]">
                    {signal.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-4 top-10 hidden h-24 w-24 rounded-full bg-[color:var(--color-accent)]/35 blur-3xl lg:block" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,14,18,0.92),rgba(24,24,27,0.88))] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.24)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Operating preview
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                    From inbox to fiscal output
                  </p>
                </div>
                <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Uruguay 2026 logic
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {workflowCards.map((card) => (
                  <div
                    key={card.step}
                    className="rounded-[1.25rem] border border-white/8 bg-white/[0.035] p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 font-mono text-sm text-white/72">
                        {card.step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{card.title}</p>
                        <p className="mt-2 text-sm leading-6 text-white/56">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-white/8 bg-[color:var(--color-accent)]/14 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Tax engine
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    VAT first, with room to expand into IRAE, Wealth Tax, Payroll,
                    and BPS.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                    Integration model
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/80">
                    Start inside the product, then expose APIs or export flows as
                    integration points mature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.72fr_minmax(0,1fr)]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <span className="eyebrow">What it does</span>
          <div className="mt-6 space-y-4">
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance">
              From documents to structured accounting
            </h2>
            <p className="max-w-xl text-base leading-8 text-[color:var(--color-muted)]">
              The goal is not just to digitize inputs. It is to turn messy
              accounting and fiscal workflows into structured, reusable system
              logic that can serve operators and software products alike.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {capabilities.map((capability, index) => (
            <article
              key={capability}
              className={`panel p-6 ${
                index === 4 ? "md:col-span-2" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="max-w-sm text-xl font-semibold tracking-[-0.05em]">
                  {capability}
                </p>
                <span className="font-mono text-sm text-[color:var(--color-muted)]">
                  0{index + 1}
                </span>
              </div>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--color-muted)]">
                {index === 0 &&
                  "Capture supplier and expense evidence in a way that downstream accounting can actually use."}
                {index === 1 &&
                  "Keep human review in the loop while reducing repetitive posting work for accounting teams."}
                {index === 2 &&
                  "Apply fiscal classification consistently instead of relying on fragmented spreadsheets and checklists."}
                {index === 3 &&
                  "Support Uruguay-specific rules that change over time without losing auditability across fiscal years."}
                {index === 4 &&
                  "Move clean data to ERPs, internal tools, or partner systems through exports and API-ready structures."}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
        <div className="panel px-6 py-7 md:px-8 md:py-8">
          <span className="eyebrow">Built for</span>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {audiences.map((audience) => (
              <article
                key={audience.name}
                className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-white/72 p-5"
              >
                <p className="text-xl font-semibold tracking-[-0.05em]">
                  {audience.name}
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                  {audience.description}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden bg-[linear-gradient(180deg,rgba(223,245,242,0.7),rgba(255,255,255,0.72))] px-6 py-7 md:px-8 md:py-8">
          <span className="eyebrow">Uruguay-specific by design</span>
          <div className="mt-6 space-y-5">
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance">
              A product surface for operators, with an infrastructure mindset underneath.
            </h2>
            <p className="max-w-xl text-base leading-8 text-[color:var(--color-muted)]">
              Convertilabs is positioned as application software first, but its
              structure is meant to support a deeper platform model over time:
              reusable document processing, accounting rules, tax treatments, and
              eventually external integrations.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Current scope
                </p>
                <p className="mt-2 text-sm leading-7">
                  Document intake, journal suggestions, VAT workflows, and fiscal
                  rule handling for Uruguay.
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  Expansion path
                </p>
                <p className="mt-2 text-sm leading-7">
                  Add deeper tax coverage, payroll, BPS, and a public API when the
                  domain model is stable enough.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel px-6 py-7 md:px-8 md:py-8" id="roadmap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-4">
            <span className="eyebrow">Roadmap</span>
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance">
              A phased rollout for accounting and fiscal coverage
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[color:var(--color-muted)]">
            The roadmap starts with the workflows that generate the most leverage
            for Uruguay teams, then expands into a broader operating layer.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {roadmap.map((item, index) => (
            <article
              key={item.phase}
              className="rounded-[1.5rem] border border-[color:var(--color-border)] bg-white/72 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-[color:var(--color-accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent-strong)]">
                  {item.phase}
                </span>
                <span className="font-mono text-sm text-[color:var(--color-muted)]">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.05em]">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[color:var(--color-muted)]">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="waitlist"
        className="panel overflow-hidden bg-[linear-gradient(135deg,rgba(255,252,247,0.92),rgba(223,245,242,0.56))] px-6 py-7 md:px-8 md:py-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl space-y-4">
            <span className="eyebrow">Early access</span>
            <h2 className="text-4xl font-semibold tracking-[-0.06em] text-balance">
              Request a demo or join the waitlist for Uruguay-focused accounting infrastructure.
            </h2>
            <p className="text-base leading-8 text-[color:var(--color-muted)]">
              Early conversations are especially relevant for firms, SMEs, and
              software teams dealing with local accounting and tax workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-full bg-[color:var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/86"
            >
              Request demo
            </Link>
            <a
              href={`mailto:${siteConfig.contactEmail}?subject=Convertilabs%20waitlist`}
              className="rounded-full border border-[color:var(--color-border)] bg-white/80 px-5 py-3 text-sm font-semibold"
            >
              Join waitlist
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
