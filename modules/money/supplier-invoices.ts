import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupplierInvoiceGroup, SupplierInvoiceItem, SupplierInvoicesBoardProps } from "./supplier-invoice-types";
import { parseAdministrativeReview, validateAdministrativeReviewBinding } from "@/modules/documents/administrative-review";
import { loadZetaInvoiceCacheBase } from "@/modules/integrations/zeta/cache/report-cache";
import { readPurchaseBalanceEvidence } from "@/modules/integrations/zeta/sync/purchase-balances";
import type { ReportRow } from "@/modules/integrations/zeta/cache/report-contracts";

export type SupplierInvoicesBoardData = SupplierInvoicesBoardProps;
type Row = Record<string, unknown>;
export type SupplierInvoicesSnapshot = {
  organizationId: string;
  organizationSlug: string;
  documents: Row[];
  drafts: Row[];
  openItems: Row[];
  parties: Row[];
  contexts: Row[];
  emailSources: Row[];
  exportAttempts: Row[];
  now?: Date;
  coverage?: SupplierInvoicesBoardData["coverage"];
  evidenceIncomplete?: boolean;
  cachedPurchases?: { organizationId: string; rows: Row[]; contacts: Row[]; currencies: Row[] };
};

const rec = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const txt = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const token = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) ? String(value) : txt(value);
const rut = (value: unknown) => { const s = txt(value)?.replace(/\D/g, ""); return s?.length === 12 ? s : null; };
const currency = (value: unknown) => { const s = txt(value)?.toUpperCase(); return s && /^[A-Z]{3}$/.test(s) ? s : null; };
const serial = (value: unknown) => txt(value)?.toUpperCase().replace(/\s+/g, "") ?? null;
const numberKey = (value: unknown) => { const s = token(value); return s && /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, "") : null; };

/** Monetary comparisons and sums use integer cents, never missing-as-zero or mixed currencies. */
function cents(value: unknown): bigint | null {
  const s = typeof value === "number" && Number.isFinite(value) ? String(value) : txt(value);
  if (!s || !/^-?\d{1,16}(?:\.\d{1,2}0*)?$/.test(s)) return null;
  const [whole, fraction = ""] = s.replace(/^-/, "").split(".");
  return (BigInt(whole) * BigInt(100) + BigInt(fraction.slice(0, 2).padEnd(2, "0"))) * BigInt(s.startsWith("-") ? -1 : 1);
}
function amount(value: bigint) {
  const positive = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? "-" : ""}${positive / BigInt(100)}.${String(positive % BigInt(100)).padStart(2, "0")}`;
}
function date(value: unknown) {
  const s = txt(value), m = s?.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:$|T| )/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`, parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
function instant(value: unknown) { const s = txt(value); return s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null; }
function dueState(due: string | null, today: string): SupplierInvoiceItem["dueState"] {
  if (!due) return "no_due_date";
  if (due < today) return "overdue";
  const soon = new Date(`${today}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 7);
  return due <= soon.toISOString().slice(0, 10) ? "due_soon" : "future";
}
const invoiceTypes = new Set(["invoice", "purchase_invoice", "expense_invoice"]);
const inactiveDocuments = new Set(["rejected", "duplicate", "archived"]);
const scoped = (rows: Row[], org: string) => rows.filter(row => row.organization_id === org);
function hasEmailConflict(row: Row) {
  return row.drift_status !== "none" || rec(row.metadata_json).differences_pending_review !== false
    || typeof row.current_payload_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.current_payload_hash)
    || row.current_payload_hash !== row.payload_hash_at_materialization;
}
function sum(values: unknown[]): bigint | null {
  if (!values.length) return null;
  let total = BigInt(0);
  for (const value of values) { const n = cents(value); if (n === null) return null; total += n; }
  return total;
}

type Candidate = { doc: Row; draft: Row; facts: Row; party: Row; taxId: string | null; groupId: string; name: string; fiscalKey: string | null; item: SupplierInvoiceItem; total: bigint | null; reasons: string[] };
type BalanceEvidence = { balance: bigint; currency: string; at: string | null; source: "ledger" | "zeta"; dueAt?: string | null };

function cachedZetaEvidence(candidate: Candidate, input: SupplierInvoicesSnapshot): { evidence: BalanceEvidence | null; conflict: boolean } {
  const cache = input.cachedPurchases;
  if (!cache || cache.organizationId !== input.organizationId || !candidate.taxId || !candidate.item.currency) return { evidence: null, conflict: false };
  const supplierCodes = new Set(cache.contacts.filter(row => rut(row.RUT ?? row.Documento ?? row.DocumentoNumero) === candidate.taxId)
    .map(row => token(row.Codigo ?? row.ProveedorCodigo)).filter((v): v is string => !!v));
  const balances: BalanceEvidence[] = [];
  let conflict = false;
  for (const row of cache.rows) {
    if (!supplierCodes.has(token(row.ProveedorCodigo) ?? "") || serial(row.Serie) !== serial(candidate.facts.series)
      || numberKey(row.Numero) !== numberKey(candidate.facts.document_number)) continue;
    const supplierRuts = new Set(cache.contacts.filter(contact => token(contact.Codigo ?? contact.ProveedorCodigo) === token(row.ProveedorCodigo))
      .map(contact => rut(contact.RUT ?? contact.Documento ?? contact.DocumentoNumero)).filter((v): v is string => !!v));
    if (supplierRuts.size !== 1 || !supplierRuts.has(candidate.taxId)) { conflict = true; continue; }
    const evidence = readPurchaseBalanceEvidence(row as ReportRow);
    if (!evidence) continue; // Historical detail alone is not balance evidence.
    const header = evidence.raw, isoCodes = new Set(cache.currencies.filter(c => token(c.Codigo) === token(header.MonedaCodigo))
      .map(c => currency(c.CodigoISO ?? c.ISO ?? c.Abreviacion)).filter((v): v is string => !!v));
    if (isoCodes.size !== 1) { conflict = true; continue; }
    const iso = [...isoCodes][0];
    if (iso !== candidate.item.currency) continue;
    const issued = date(`${String(header.FacturaAnio).padStart(4, "0")}-${String(header.FacturaMes).padStart(2, "0")}-${String(header.FacturaDia).padStart(2, "0")}`);
    const total = cents(header.FacturaTotal), balance = cents(header.FacturaSaldo), at = instant(evidence.dataAsOf);
    const payable = cents(rec(rec(candidate.draft.intake_context_json).cfe_xml).payable);
    const difference = payable !== null && candidate.total !== null ? payable - candidate.total : null;
    const matchesTotal = total !== null && (total === candidate.total || (total === payable && difference !== null && difference >= -BigInt(50) && difference <= BigInt(50)));
    if (token(row.RegistroId) !== token(header.FacturaId) || token(row.ProveedorCodigo) !== token(header.ProveedorCodigo)
      || token(row.MonedaCodigo) !== token(header.MonedaCodigo) || token(row.ComprobanteCodigo) !== token(header.ComprobanteCodigo)
      || serial(header.FacturaSerie) !== serial(candidate.facts.series) || numberKey(header.FacturaNumero) !== numberKey(candidate.facts.document_number)
      || issued !== candidate.item.issuedAt || date(row.Fecha) !== issued || !matchesTotal || balance === null || balance < BigInt(0)
      || total === null || balance > total || !at || Date.parse(at) > (input.now ?? new Date()).getTime()) { conflict = true; continue; }
    balances.push({ balance, currency: iso, at, source: "zeta" });
  }
  if (balances.length > 1) return { evidence: null, conflict: true };
  return { evidence: balances[0] ?? null, conflict };
}

/** Binds the stored export to the unchanged fiscal content, including the ISO currency.
 * This reproduces the export's versionless historical fingerprint; a mismatch only
 * withholds payment evidence and never repairs or rewrites that history.
 */
function historicalFingerprint(candidate: Candidate) {
  const f = candidate.facts, numeric = Number(numberKey(f.document_number));
  if (candidate.total === null || !Number.isSafeInteger(numeric)) return null;
  const parts = [txt(f.issuer_tax_id) ?? "sin-rut", txt(rec(candidate.draft.intake_context_json).cfe_type_code) ?? "sin-tipo",
    txt(f.series) ?? "sin-serie", numeric, txt(f.document_date) ?? txt(candidate.doc.document_date) ?? "sin-fecha",
    Number(amount(candidate.total)), txt(f.currency_code) ?? "sin-moneda"];
  return `sha256:${createHash("sha256").update(parts.join("|"), "utf8").digest("hex")}`;
}

function zetaEvidence(candidate: Candidate, attempts: Row[]): { evidence: BalanceEvidence | null; conflict: boolean } {
  const matches = attempts.filter(row => row.provider === "zetasoftware" && row.entity_type === "purchase_expense_export_attempt"
    && rec(row.payload_json).document_id === candidate.doc.id && row.test_mode === false);
  const balances: BalanceEvidence[] = [];
  let conflict = false;
  for (const row of matches) {
    const p = rec(row.payload_json), status = txt(p.status) ?? txt(rec(row.metadata_json).status);
    if (!["found_in_zeta", "already_exists"].includes(status ?? "")) { conflict = true; continue; }
    const response = rec(p.response), reconciliation = rec(response.reconciliation);
    const recordId = token(reconciliation.registroId);
    const movementArray = rec(rec(p.request).Data).Movimiento;
    const preview = rec(p.preview), lines = Array.isArray(preview.lines) ? preview.lines.map(rec) : [];
    const m = Array.isArray(movementArray) && movementArray.length === 1 ? rec(movementArray[0]) : {};
    const query = rec(reconciliation.queryCompras);
    const rows = Array.isArray(query.Response) ? query.Response.map(rec).filter(r => token(r.RegistroId) === recordId) : [];
    if (!recordId || rows.length !== 1 || !candidate.taxId || !candidate.item.currency || !candidate.fiscalKey
      || p.fiscal_fingerprint !== historicalFingerprint(candidate)
      || rut(preview.supplierRut) !== candidate.taxId || token(preview.zetaSupplierCode) !== token(m.CodigoProveedor)
      || serial(m.Serie) !== serial(candidate.facts.series) || numberKey(m.Numero) !== numberKey(candidate.facts.document_number)
      || date(m.Fecha) !== candidate.item.issuedAt || token(preview.monedaCode) !== token(m.CodigoMoneda)
      || sum(lines.map(line => line.totalAmount)) !== candidate.total
      || (cents(candidate.facts.subtotal) !== null && sum(lines.map(line => line.netAmount)) !== cents(candidate.facts.subtotal))
      || (cents(candidate.facts.tax_amount) !== null && sum(lines.map(line => line.ivaAmount)) !== cents(candidate.facts.tax_amount))) {
      conflict = true; continue;
    }
    const found = rows[0], balance = cents(found.Saldo);
    if (balance === null || balance < BigInt(0) || token(found.ProveedorCodigo) !== token(m.CodigoProveedor)
      || token(found.ComprobanteCodigo) !== token(m.CodigoComprobante)
      || token(found.MonedaCodigo) !== token(m.CodigoMoneda)
      || serial(found.Serie) !== serial(m.Serie) || numberKey(found.Numero) !== numberKey(m.Numero)
      || date(found.Fecha) !== candidate.item.issuedAt || cents(found.Total) !== candidate.total
      || (cents(candidate.facts.subtotal) !== null && cents(found.Subtotal) !== cents(candidate.facts.subtotal))
      || (cents(candidate.facts.tax_amount) !== null && cents(found.IVA) !== cents(candidate.facts.tax_amount))
      || (candidate.total !== null && balance > candidate.total)) { conflict = true; continue; }
    balances.push({ balance, currency: candidate.item.currency, at: instant(p.recorded_at), source: "zeta" });
  }
  if (!balances.length) return { evidence: null, conflict };
  if (balances.some(e => e.balance !== balances[0].balance || e.currency !== balances[0].currency)) return { evidence: null, conflict: true };
  balances.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  return { evidence: balances[0], conflict };
}

function ledgerEvidence(candidate: Candidate, rows: Row[], contexts: Row[]): { evidence: BalanceEvidence | null; conflict: boolean; excluded: boolean } {
  const linked = rows.filter(row => row.source_document_id === candidate.doc.id && row.document_role === "purchase" && invoiceTypes.has(String(row.document_type)));
  const method = contexts.find(row => row.draft_id === candidate.draft.id);
  const paidByPartner = rec(method?.structured_context_json).settlement_method === "paid_by_partner";
  if (linked.some(row => rec(row.metadata).kind === "clearing") || (linked.length > 0 && paidByPartner)) {
    return { evidence: null, conflict: false, excluded: true };
  }
  if (!linked.length) return { evidence: null, conflict: false, excluded: false };
  // Multiple rows can mean allocations or duplicate bookkeeping; do not guess a sum.
  if (linked.length !== 1) return { evidence: null, conflict: true, excluded: false };
  const row = linked[0], balance = cents(row.outstanding_amount), original = cents(row.original_amount), settled = cents(row.settled_amount);
  const iso = currency(row.currency_code), kind = txt(rec(row.metadata).kind);
  const partyMatches = !!row.party_id && row.party_id === candidate.party.id;
  const valid = row.counterparty_type === "vendor" && (kind === "payable" || kind === null) && partyMatches
    && ["open", "partially_settled", "settled"].includes(String(row.status))
    && balance !== null && original !== null && settled !== null && original > BigInt(0) && settled >= BigInt(0)
    && (row.status !== "settled" || balance === BigInt(0))
    && balance >= BigInt(0) && original - settled === balance && original === candidate.total && iso !== null && iso === candidate.item.currency;
  return valid ? { evidence: { balance: balance!, currency: iso!, at: instant(row.updated_at), source: "ledger", dueAt: date(row.due_date) }, conflict: false, excluded: false }
    : { evidence: null, conflict: true, excluded: false };
}

function groups(entries: Array<{ candidate: Candidate; item: SupplierInvoiceItem }>): SupplierInvoiceGroup[] {
  const grouped = new Map<string, SupplierInvoiceGroup>();
  for (const { candidate: c, item } of entries) {
    let group = grouped.get(c.groupId);
    if (!group) { group = { id: c.groupId, name: c.name, taxId: c.taxId, totals: [], invoices: [] }; grouped.set(c.groupId, group); }
    group.invoices.push(item);
  }
  for (const group of grouped.values()) {
    const totals = new Map<string, bigint>();
    for (const item of group.invoices) { const n = cents(item.amount); if (item.currency && n !== null) totals.set(item.currency, (totals.get(item.currency) ?? BigInt(0)) + n); }
    group.totals = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([iso, n]) => ({ currency: iso, amount: amount(n) }));
    group.invoices.sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999") || (a.number ?? "").localeCompare(b.number ?? ""));
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function buildSupplierInvoicesBoard(input: SupplierInvoicesSnapshot): SupplierInvoicesBoardData {
  const org = input.organizationId, root = `/app/o/${encodeURIComponent(input.organizationSlug)}`;
  const documents = scoped(input.documents, org), drafts = scoped(input.drafts, org), parties = scoped(input.parties, org);
  const contexts = scoped(input.contexts, org), sources = scoped(input.emailSources, org), attempts = scoped(input.exportAttempts, org), openItems = scoped(input.openItems, org);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).format(input.now ?? new Date());
  const candidates: Candidate[] = [], dates: string[] = [];
  for (const doc of documents) {
    if (inactiveDocuments.has(String(doc.status))) continue;
    const draft = drafts.find(row => row.id === doc.current_draft_id && row.document_id === doc.id);
    if (!draft || draft.status === "superseded" || !invoiceTypes.has(String(draft.document_type ?? doc.document_type)) || draft.document_role !== "purchase") continue;
    const facts = rec(rec(draft.fields_json).facts), taxId = rut(facts.issuer_tax_id);
    const partyById = parties.find(p => p.id === doc.party_id);
    const matches = taxId ? parties.filter(p => p.tax_id_normalized === taxId) : [];
    const party = partyById && (!taxId || partyById.tax_id_normalized === taxId) ? partyById : matches.length === 1 ? matches[0] : {};
    const iso = currency(facts.currency_code), total = cents(facts.total_amount), cfe = rec(rec(draft.intake_context_json).cfe_xml);
    const payable = cents(cfe.payable), shown = payable !== null && payable >= BigInt(0) ? payable : total;
    const series = serial(facts.series), number = numberKey(facts.document_number), issued = date(facts.document_date ?? doc.document_date), due = date(facts.due_date);
    const reasons = [payable !== null ? "Importe informado a pagar en el CFE; no es un saldo confirmado." : "Importe del documento; falta confirmar si continúa pendiente de pago."];
    if (payable !== null && total !== null && payable !== total) reasons.push(`Total fiscal ${amount(total)} ${iso ?? "(moneda por confirmar)"}; diferencia ${amount(payable - total)}.`);
    if (!iso || shown === null) reasons.push("Falta confirmar el importe o la moneda.");
    const email = sources.filter(row => row.document_id === doc.id && row.provider === "email_inbox");
    if (email.some(hasEmailConflict)) reasons.push("Hay diferencias o evidencia incompleta entre las fuentes recibidas; revisar el documento.");
    const updated = instant(draft.updated_at) ?? instant(doc.updated_at); if (updated) dates.push(updated);
    candidates.push({ doc, draft, facts, party, taxId, groupId: txt(party.id) ?? (taxId ? `rut:${taxId}` : `document:${String(doc.id)}`),
      name: txt(party.display_name) ?? txt(facts.issuer_name) ?? "Proveedor por identificar", total,
      fiscalKey: taxId && series && number ? `${taxId}|${series}|${number}` : null,
      reasons, item: { id: String(doc.id), number: series && number ? `${series} ${number}` : txt(facts.document_number), issuedAt: issued, dueAt: due,
        dueState: dueState(due, today), currency: iso, amount: shown === null ? null : amount(shown), reviewHref: `${root}/documents/${encodeURIComponent(String(doc.id))}` } });
  }
  const confirmed: Array<{ candidate: Candidate; item: SupplierInvoiceItem }> = [], unconfirmed: typeof confirmed = [];
  const humanPaid: typeof confirmed = [], humanUnpaid: typeof confirmed = [];
  let excludedPaidCount = 0;
  const seenFiscal = new Set<string>();
  for (const candidate of candidates) {
    const duplicates = candidate.fiscalKey ? candidates.filter(c => c.fiscalKey === candidate.fiscalKey) : [candidate];
    if (candidate.fiscalKey && seenFiscal.has(candidate.fiscalKey)) continue;
    if (candidate.fiscalKey) seenFiscal.add(candidate.fiscalKey);
    if (duplicates.length > 1) {
      unconfirmed.push({ candidate, item: { ...candidate.item, amount: null, reason: "Existen varios documentos con la misma identidad fiscal; revisar duplicados e importes antes de contar la deuda." } }); continue;
    }
    const ledger = ledgerEvidence(candidate, openItems, contexts), historicalZeta = zetaEvidence(candidate, attempts), cachedZeta = cachedZetaEvidence(candidate, input);
    const zeta = cachedZeta.evidence && (!historicalZeta.evidence?.at || cachedZeta.evidence.at! >= historicalZeta.evidence.at)
      ? cachedZeta : { evidence: historicalZeta.evidence, conflict: historicalZeta.conflict || cachedZeta.conflict };
    const sourceConflict = sources.some(row => row.document_id === candidate.doc.id && row.provider === "email_inbox" && hasEmailConflict(row));
    const rawReview = rec(candidate.doc.metadata).administrative_review;
    const review = parseAdministrativeReview(rawReview);
    const bindingValid = validateAdministrativeReviewBinding(review, { organizationId: org, documentId: String(candidate.doc.id), currentDraftId: String(candidate.draft.id), facts: candidate.facts });
    const validReview = bindingValid && review && Date.parse(review.reviewedAt) <= (input.now ?? new Date()).getTime() ? review : null;
    let evidence = ledger.evidence ?? zeta.evidence;
    const reviewConflict = !!validReview && [ledger.evidence, zeta.evidence].some(e => e && (!e.at || e.at >= validReview.reviewedAt)
      && ((validReview.payment.status === "paid" && e.balance > BigInt(0)) || (validReview.payment.status === "unpaid" && e.balance === BigInt(0))));
    const sourceDisagreement = !!ledger.evidence && !!zeta.evidence && ledger.evidence.balance !== zeta.evidence.balance;
    const historicalDisagreement = sourceDisagreement && !!validReview && !!ledger.evidence?.at && !!zeta.evidence?.at
      && ledger.evidence.at < validReview.reviewedAt && zeta.evidence.at < validReview.reviewedAt;
    const conflict = input.evidenceIncomplete || ledger.conflict || zeta.conflict || sourceConflict || reviewConflict || (!!rawReview && !validReview)
      || (sourceDisagreement && !historicalDisagreement);
    if (review) candidate.item.administrativeReview = { comment: review.comment, reviewedAt: review.reviewedAt,
      paymentStatus: review.payment.status, method: review.payment.method, paymentDate: review.payment.date, paidAmount: review.payment.amount,
      paidCurrency: review.payment.currency, classificationStatus: review.classificationStatus, valid: !!validReview && !conflict };
    if (rawReview && !validReview) candidate.reasons.push("La revisión administrativa no corresponde al borrador fiscal actual; reconfirmar sus instrucciones y el pago.");
    if (reviewConflict) candidate.reasons.push("Un saldo posterior contradice el pago declarado; revisar antes de darlo por resuelto.");
    if (historicalDisagreement) candidate.reasons.push("Zeta y las cuentas por pagar conservan saldos anteriores diferentes; tu declaración posterior se mantiene y la discrepancia histórica queda pendiente de conciliación.");
    if (validReview) dates.push(validReview.reviewedAt);
    if (conflict) evidence = null;
    if (validReview && !conflict && ["paid", "unpaid"].includes(validReview.payment.status)) {
      const paid = validReview.payment.status === "paid";
      const observed = zeta.evidence ?? ledger.evidence;
      if (observed?.at) dates.push(observed.at);
      const beforeReview = !!observed?.at && observed.at < validReview.reviewedAt;
      const balanceReason = observed
        ? ` ${observed.balance === BigInt(0) ? "Sin saldo observado" : `Saldo observado ${amount(observed.balance)} ${observed.currency}`} en ${observed.source === "zeta" ? "Zeta" : "cuentas por pagar de Convertilabs"}${observed.at ? ` el ${new Date(observed.at).toLocaleString("es-UY", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}` : " (fecha no disponible)"}.${beforeReview ? " Ese saldo es anterior a tu revisión." : ""}`
        : "";
      (paid ? humanPaid : humanUnpaid).push({ candidate, item: { ...candidate.item,
        ...(observed ? { observedBalance: { source: observed.source, amount: amount(observed.balance), currency: observed.currency, asOf: observed.at, beforeHumanReview: beforeReview } } : {}),
        reason: `${paid ? "Pago" : "Pendiente de pago"} declarado en la revisión humana.${balanceReason} ${candidate.reasons.join(" ").replace("Importe del documento; falta confirmar si continúa pendiente de pago.", "Importe fiscal de referencia.").replace("Importe informado a pagar en el CFE; no es un saldo confirmado.", "Importe a pagar informado en el CFE; no es un saldo conciliado.")} Esta declaración no registra un pago contable ni modifica Zeta.` } });
      continue;
    }
    if (evidence) {
      if (evidence.at) dates.push(evidence.at);
      if (evidence.balance === BigInt(0)) { excludedPaidCount++; continue; }
      const due = evidence.source === "ledger" ? evidence.dueAt ?? null : candidate.item.dueAt;
      confirmed.push({ candidate, item: { ...candidate.item, amount: amount(evidence.balance), currency: evidence.currency, dueAt: due, dueState: dueState(due, today),
        reason: evidence.source === "zeta" ? `Saldo de proveedor observado en Zeta${evidence.at ? ` el ${new Date(evidence.at).toLocaleDateString("es-UY", { timeZone: "America/Montevideo" })}` : ""}; lectura guardada en Supabase.` : "Saldo pendiente registrado en cuentas por pagar de Convertilabs." } });
      continue;
    }
    if (ledger.excluded) candidate.reasons.push("La partida corresponde a tarjeta o socio; falta confirmar por separado el saldo del proveedor.");
    if (conflict) candidate.reasons.push("La evidencia de saldo no coincide o es incompleta; confirmar el pago y los datos actuales.");
    unconfirmed.push({ candidate, item: { ...candidate.item, reason: candidate.reasons.join(" ") } });
  }
  // Canonical payables remain visible when the source has not produced a draft.
  const seenOrphans = new Set<string>();
  for (const row of openItems) {
    if (candidates.some(c => c.doc.id === row.source_document_id) || row.document_role !== "purchase" || row.counterparty_type !== "vendor" || !invoiceTypes.has(String(row.document_type)) || rec(row.metadata).kind === "clearing") continue;
    const sourceDoc = documents.find(d => d.id === row.source_document_id);
    if (sourceDoc && (inactiveDocuments.has(String(sourceDoc.status)) || !invoiceTypes.has(String(sourceDoc.document_type)))) continue;
    const orphanKey = txt(row.source_document_id) ?? String(row.id); if (seenOrphans.has(orphanKey)) continue; seenOrphans.add(orphanKey);
    const party = parties.find(p => p.id === row.party_id) ?? {}, balance = cents(row.outstanding_amount), iso = currency(row.currency_code);
    const original = cents(row.original_amount), settled = cents(row.settled_amount), kind = txt(rec(row.metadata).kind);
    if (balance !== null && balance < BigInt(0)) continue; // credit balances are not supplier invoices due.
    const duplicates = row.source_document_id ? openItems.filter(r => r.source_document_id === row.source_document_id).length > 1 : false;
    const valid = !input.evidenceIncomplete && !!party.id && !duplicates && balance !== null && !!iso && original !== null && original > BigInt(0)
      && settled !== null && settled >= BigInt(0) && original - settled === balance && (kind === null || kind === "payable")
      && (balance === BigInt(0) ? row.status === "settled" : ["open", "partially_settled"].includes(String(row.status)));
    if (valid && balance === BigInt(0)) { excludedPaidCount++; continue; }
    const due = date(row.due_date), item: SupplierInvoiceItem = { id: `open-item:${String(row.id)}`, number: null, issuedAt: date(row.issue_date), dueAt: due, dueState: dueState(due, today), currency: iso,
      amount: valid && balance !== null ? amount(balance) : null, reviewHref: sourceDoc ? `${root}/documents/${encodeURIComponent(String(sourceDoc.id))}` : `${root}/money`,
      reason: valid ? "Saldo de cuenta por pagar; el original aún no tiene un borrador disponible." : "La partida pendiente tiene datos incompletos o inconsistentes; revisar el saldo antes de pagar." };
    const candidate: Candidate = { doc: sourceDoc ?? {}, draft: {}, facts: {}, party, taxId: rut(party.tax_id_normalized), groupId: txt(party.id) ?? `open-item:${String(row.id)}`, name: txt(party.display_name) ?? "Proveedor por identificar", fiscalKey: null, item, total: original, reasons: [] };
    (valid ? confirmed : unconfirmed).push({ candidate, item }); const at = instant(row.updated_at); if (at) dates.push(at);
  }
  const pending = documents.filter(doc => !inactiveDocuments.has(String(doc.status)) && !drafts.some(d => d.id === doc.current_draft_id && d.document_id === doc.id)).length;
  return { confirmed: groups(confirmed), unconfirmed: groups(unconfirmed), humanPaid: groups(humanPaid), humanUnpaid: groups(humanUnpaid), excludedPaidCount, updatedAt: dates.sort().at(-1) ?? null,
    coverage: input.coverage ?? { status: "complete", message: "Documentos y saldos disponibles en Convertilabs; los CFE recibidos no confirman deuda ni pago." },
    error: null, inboxPendingCount: pending, inboxPendingHref: `${root}/documents` };
}

const PAGE_SIZE = 200, MAX_ROWS = 5000, CHUNK_SIZE = 100;
type PageQuery = { data: unknown; error: unknown };
type ReadResult = { rows: Row[]; complete: boolean; available: boolean };
async function readPages(make: (from: number, to: number) => PromiseLike<PageQuery>, maxRows = MAX_ROWS, pageSize = PAGE_SIZE): Promise<ReadResult> {
  const rows: Row[] = [];
  try {
    for (let from = 0; from <= maxRows; from += pageSize) {
      const { data, error } = await make(from, Math.min(from + pageSize - 1, maxRows));
      if (error || !Array.isArray(data)) return { rows, complete: false, available: false };
      if (from === maxRows) return { rows, complete: data.length === 0, available: true };
      rows.push(...data.map(rec));
      if (data.length < pageSize) return { rows, complete: true, available: true };
    }
  } catch { return { rows, complete: false, available: false }; }
  return { rows, complete: false, available: true };
}

/** Only SELECTs against the shared copy. Caller must authenticate and authorize the organization. */
export async function loadSupplierInvoicesBoard(supabase: SupabaseClient, input: { organizationId: string; organizationSlug: string }): Promise<SupplierInvoicesBoardData> {
  if (!txt(input.organizationId) || !txt(input.organizationSlug)) throw new Error("supplier_board_organization_required");
  const org = input.organizationId;
  let cacheReadFailed = false;
  const [documents, openItems, purchaseCache] = await Promise.all([
    readPages((from, to) => supabase.from("documents").select("id,organization_id,party_id,current_draft_id,direction,document_type,status,document_date,metadata,updated_at").eq("organization_id", org).order("id").range(from, to)),
    readPages((from, to) => supabase.from("ledger_open_items").select("id,organization_id,party_id,source_document_id,document_role,document_type,counterparty_type,currency_code,original_amount,settled_amount,outstanding_amount,status,metadata,issue_date,due_date,updated_at").eq("organization_id", org).eq("document_role", "purchase").order("id").range(from, to)),
    loadZetaInvoiceCacheBase({ supabase, organizationId: org, report: "purchases" }).catch(() => { cacheReadFailed = true; return null; }),
  ]);
  const states = [documents, openItems];
  const details = async (table: string, columns: string, key: string, ids: string[], filters: Record<string, string> = {}) => {
    const rows: Row[] = [];
    for (let offset = 0; offset < ids.length; offset += CHUNK_SIZE) {
      const part = await readPages((from, to) => {
        let query = supabase.from(table).select(columns).eq("organization_id", org).in(key, ids.slice(offset, offset + CHUNK_SIZE));
        for (const [name, value] of Object.entries(filters)) query = query.eq(name, value);
        return query.order("id").range(from, to);
      });
      states.push(part); rows.push(...part.rows);
    }
    return rows;
  };
  const docIds = documents.rows.map(r => txt(r.id)).filter((id): id is string => !!id), draftIds = documents.rows.map(r => txt(r.current_draft_id)).filter((id): id is string => !!id);
  const [drafts, emailSources, exportAttempts] = await Promise.all([
    details("document_drafts", "id,organization_id,document_id,document_role,document_type,status,fields_json,intake_context_json,updated_at", "id", draftIds),
    details("document_source_refs", "id,organization_id,document_id,provider,drift_status,metadata_json,current_payload_hash,payload_hash_at_materialization", "document_id", docIds, { provider: "email_inbox" }),
    details("integration_raw_records", "id,organization_id,provider,entity_type,test_mode,payload_json,metadata_json", "external_key", docIds.map(id => `purchase_expense_invoice:${id}`), { provider: "zetasoftware", entity_type: "purchase_expense_export_attempt" }),
  ]);
  const ruts = [...new Set(drafts.map(d => rut(rec(rec(d.fields_json).facts).issuer_tax_id)).filter((v): v is string => !!v))];
  const partyIds = [...new Set([...documents.rows, ...openItems.rows].map(r => txt(r.party_id)).filter((v): v is string => !!v))];
  const [byRut, byId, contexts] = await Promise.all([
    details("parties", "id,organization_id,display_name,tax_id_normalized", "tax_id_normalized", ruts),
    details("parties", "id,organization_id,display_name,tax_id_normalized", "id", partyIds),
    details("document_accounting_contexts", "id,organization_id,draft_id,structured_context_json", "draft_id", draftIds),
  ]);
  const masterRows = purchaseCache ? await readPages((from, to) => supabase.from("integration_raw_records")
    .select("id,entity_type,codigo:payload_json->row->>Codigo,proveedor_codigo:payload_json->row->>ProveedorCodigo,rut:payload_json->row->>RUT,documento:payload_json->row->>Documento,documento_numero:payload_json->row->>DocumentoNumero,codigo_iso:payload_json->row->>CodigoISO,iso:payload_json->row->>ISO,abreviacion:payload_json->row->>Abreviacion")
    .eq("organization_id", org).eq("provider", "zetasoftware").eq("test_mode", false)
    .in("entity_type", ["contact", "currency"]).order("id").range(from, to), 10000, 1000) : null;
  if (masterRows) states.push(masterRows);
  const available = documents.available && openItems.available, complete = !cacheReadFailed && states.every(state => state.complete && state.available);
  const data = buildSupplierInvoicesBoard({ ...input, documents: documents.rows, drafts, openItems: openItems.rows, parties: [...new Map([...byRut, ...byId].map(p => [p.id, p])).values()], contexts, emailSources, exportAttempts, evidenceIncomplete: !complete,
    ...(purchaseCache && masterRows ? { cachedPurchases: { organizationId: org, rows: purchaseCache.rows,
      contacts: masterRows.rows.filter(row => row.entity_type === "contact").map(row => ({ Codigo: row.codigo, ProveedorCodigo: row.proveedor_codigo, RUT: row.rut, Documento: row.documento, DocumentoNumero: row.documento_numero })),
      currencies: masterRows.rows.filter(row => row.entity_type === "currency").map(row => ({ Codigo: row.codigo, CodigoISO: row.codigo_iso, ISO: row.iso, Abreviacion: row.abreviacion })) } } : {}),
    coverage: { status: !available && !documents.rows.length && !openItems.rows.length ? "unavailable" : complete ? "complete" : "partial",
      message: complete ? "Documentos y saldos disponibles en Convertilabs. Los importes por confirmar no son deuda confirmada ni un saldo actualizado de todos los proveedores de Zeta."
        : "Cobertura incompleta: alguna fuente no respondió o supera el límite visible de 5.000 filas por lectura. No usar estos totales como saldo completo." } });
  if (!complete) {
    // A missing source might contain a payment or a conflict: do not claim complete balance evidence.
    data.error = "No se pudo comprobar la cobertura completa de facturas y pagos.";
  }
  return data;
}
