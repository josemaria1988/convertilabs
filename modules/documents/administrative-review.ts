import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
/** A human declaration is operational evidence, never an accounting entry or ERP payment. */
export type AdministrativeReview = {
  version: 1;
  organizationId: string;
  documentId: string;
  currentDraftId: string;
  fiscalFingerprint: string;
  actorId: string;
  reviewedAt: string;
  source: { workbookSha256: string; ref: string };
  comment: string;
  classificationStatus: "confirmed" | "needs_review";
  payment: { status: "paid" | "unpaid" | "unknown"; method: string | null; date: string | null; amount: string | null; currency: string | null };
  /** This import does not authorize a reusable accounting rule. */
  futureScope: null;
};

const rec = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
function day(v: unknown) {
  const s = text(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`))
    && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s ? s : null;
}
function money(v: unknown) {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : text(v);
  if (!s || !/^\d{1,16}(?:\.\d{1,2}0*)?$/.test(s)) return null;
  const [whole, fraction = ""] = s.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.slice(0, 2).padEnd(2, "0")}`;
}

/** Bind only normalized fiscal identity; issuer names, source facts and amounts stay untouched. */
export function administrativeReviewFiscalFingerprint(facts: Row): string | null {
  const rut = text(facts.issuer_tax_id)?.replace(/\D/g, "");
  const series = text(facts.series)?.toUpperCase().replace(/\s+/g, "");
  const rawNumber = typeof facts.document_number === "number" && Number.isSafeInteger(facts.document_number) ? String(facts.document_number) : text(facts.document_number);
  const number = rawNumber && /^\d+$/.test(rawNumber) ? rawNumber.replace(/^0+(?=\d)/, "") : null;
  const date = day(facts.document_date), currency = text(facts.currency_code)?.toUpperCase(), total = money(facts.total_amount);
  if (!rut || rut.length !== 12 || !series || !number || !date || !currency || !/^[A-Z]{3}$/.test(currency) || total === null) return null;
  return `sha256:${createHash("sha256").update(JSON.stringify([rut, series, number, date, currency, total]), "utf8").digest("hex")}`;
}

export function parseAdministrativeReview(value: unknown): AdministrativeReview | null {
  const r = rec(value), p = rec(r.payment), source = rec(r.source);
  if (r.version !== 1 || !text(r.organizationId) || !text(r.documentId) || !text(r.currentDraftId) || !text(r.actorId)
    || typeof r.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(r.reviewedAt) || !day(r.reviewedAt.slice(0, 10)) || !Number.isFinite(Date.parse(r.reviewedAt))
    || typeof r.fiscalFingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/.test(r.fiscalFingerprint)
    || typeof source.workbookSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.workbookSha256) || !text(source.ref)
    || typeof r.comment !== "string" || r.comment.length > 20000 || !["confirmed", "needs_review"].includes(String(r.classificationStatus))
    || !["paid", "unpaid", "unknown"].includes(String(p.status)) || r.futureScope !== null
    || (p.method !== null && (typeof p.method !== "string" || !text(p.method)))
    || (p.date !== null && day(p.date) === null) || (p.amount !== null && money(p.amount) === null)
    || (p.currency !== null && (typeof p.currency !== "string" || !/^[A-Z]{3}$/.test(p.currency)))
    || (p.amount !== null && p.currency === null) || (p.status !== "paid" && (p.date !== null || p.amount !== null))) return null;
  return { version: 1, organizationId: text(r.organizationId)!, documentId: text(r.documentId)!, currentDraftId: text(r.currentDraftId)!,
    fiscalFingerprint: r.fiscalFingerprint, actorId: text(r.actorId)!, reviewedAt: new Date(r.reviewedAt).toISOString(),
    source: { workbookSha256: source.workbookSha256, ref: text(source.ref)! }, comment: r.comment.trim(),
    classificationStatus: r.classificationStatus as AdministrativeReview["classificationStatus"],
    payment: { status: p.status as AdministrativeReview["payment"]["status"], method: text(p.method), date: day(p.date), amount: money(p.amount), currency: text(p.currency) }, futureScope: null };
}

export function buildAdministrativeReview(input: Omit<AdministrativeReview, "version" | "fiscalFingerprint"> & { facts: Row }): AdministrativeReview {
  const fiscalFingerprint = administrativeReviewFiscalFingerprint(input.facts);
  const { facts: _facts, ...rest } = input;
  void _facts;
  const review = parseAdministrativeReview({ ...rest, version: 1, fiscalFingerprint });
  if (!review) throw new Error("administrative_review_invalid_or_incomplete");
  return review;
}

export function validateAdministrativeReviewBinding(review: AdministrativeReview | null, input: { organizationId: string; documentId: string; currentDraftId: string; facts: Row }): boolean {
  return !!review && review.organizationId === input.organizationId && review.documentId === input.documentId && review.currentDraftId === input.currentDraftId
    && review.fiscalFingerprint === administrativeReviewFiscalFingerprint(input.facts);
}
