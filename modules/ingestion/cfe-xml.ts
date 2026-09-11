import { createHash } from "node:crypto";
import { SaxesParser } from "saxes";
import type { DocumentIntakeFactMap, DocumentIntakeAmountBreakdown, DocumentIntakeLineItem } from "@/modules/ai/document-intake-contract";

// DGI Formato CFE 25.2: https://www.efactura.dgi.gub.uy/files/formato_cfe_v25-2-pdf?es=
// This is a bounded intake parser, not an XSD or electronic-signature validator.
const namespace = "http://cfe.dgi.gub.uy";
const signatureNamespace = "http://www.w3.org/2000/09/xmldsig#";
export const maxCfeXmlBytes = 5 * 1024 * 1024;
type XmlNode = { name: string; uri: string; text: string; children: XmlNode[] };
export type CfeXmlInvoice = {
  fiscalKey: string; semanticHash: string; typeCode: string; documentType: "invoice" | "purchase_payment_support"; facts: DocumentIntakeFactMap;
  amountBreakdown: DocumentIntakeAmountBreakdown[]; lineItems: DocumentIntakeLineItem[];
  warnings: string[]; amountsRequireReview: boolean; paymentTerms: "cash" | "credit" | "unknown";
  source: { cfeIndex: number; amountsIncludeVat: boolean; total: number; payable: number | null;
    nonBillable: number | null; exchangeRate: number | null; totals: Record<string, string>;
    lines: Array<Record<string, string>>; paymentEvidence: string[]; signatureVerified: false };
};
export type CfeXmlResult = { invoices: CfeXmlInvoice[]; pending: Array<{ cfeIndex?: number; reason: string }> };

function fail(code: string): never { throw new Error(`cfe_xml_${code}`); }
function parseTree(bytes: Buffer) {
  if (!bytes.length || bytes.length > maxCfeXmlBytes) fail("size_limit");
  const declaration = bytes.subarray(0, 200).toString("ascii").match(/<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)/i)?.[1]?.toLowerCase();
  if (declaration && !["utf-8", "utf8", "iso-8859-1"].includes(declaration)) fail("encoding_unsupported");
  let xml: string;
  try { xml = new TextDecoder(declaration === "iso-8859-1" ? "iso-8859-1" : "utf-8", { fatal: true }).decode(bytes); }
  catch { fail("encoding_invalid"); }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) fail("dtd_forbidden");
  const parser = new SaxesParser({ xmlns: true });
  const stack: XmlNode[] = []; let root: XmlNode | null = null; let nodes = 0;
  parser.on("doctype", () => fail("dtd_forbidden"));
  parser.on("error", () => fail("malformed"));
  parser.on("opentag", (tag) => {
    if (++nodes > 30_000 || stack.length >= 48 || Object.keys(tag.attributes).length > 30) fail("structure_limit");
    // Vendor-specific Adenda children are opaque evidence, never fiscal fields.
    const withinAdenda = stack.some((entry) => entry.uri === namespace && entry.name === "Adenda");
    if (tag.uri !== namespace && tag.uri !== signatureNamespace && !withinAdenda) fail("namespace_invalid");
    const node: XmlNode = { name: tag.local, uri: tag.uri, text: "", children: [] };
    if (stack.length) stack[stack.length - 1].children.push(node);
    else { if (root) fail("multiple_roots"); root = node; }
    stack.push(node);
  });
  const text = (value: string) => {
    if (!stack.length) return;
    const node = stack[stack.length - 1]; node.text += value;
    if (node.text.length > 250_000) fail("text_limit");
  };
  parser.on("text", text); parser.on("cdata", text); parser.on("closetag", () => { stack.pop(); });
  parser.write(xml).close();
  if (!root) fail("empty");
  return root as XmlNode;
}
function children(node: XmlNode, name: string) { return node.children.filter((entry) => entry.uri === namespace && entry.name === name); }
function one(node: XmlNode, name: string, required = true): XmlNode | null {
  const found = children(node, name);
  if (found.length > 1 || (required && found.length !== 1)) fail(`field_${name}`);
  return found[0] ?? null;
}
function value(node: XmlNode, name: string, required = false): string | null {
  const entry = one(node, name, required);
  if (!entry) return null;
  if (entry.children.length) fail(`scalar_${name}`);
  const result = entry.text.trim();
  if (required && !result) fail(`field_${name}`);
  return result || null;
}
function decimal(node: XmlNode, name: string, required = false, signed = false): number | null {
  const raw = value(node, name, required); if (raw === null) return null;
  if (!(signed ? /^-?\d{1,12}(\.\d{1,8})?$/ : /^\d{1,12}(\.\d{1,8})?$/).test(raw)) fail(`number_${name}`);
  const result = Number(raw); if (!Number.isFinite(result) || Math.abs(result) > 1e10) fail(`number_${name}`);
  return result;
}
function scalarFields(node: XmlNode) {
  const result: Record<string, string> = {};
  for (const entry of node.children.filter((child) => child.uri === namespace && !child.children.length)) {
    if (Object.hasOwn(result, entry.name)) fail(`field_${entry.name}`);
    result[entry.name] = entry.text.trim();
  }
  return result;
}
const money = (number: number) => Math.round((number + Number.EPSILON) * 100) / 100;
function date(node: XmlNode, name: string, required = false) {
  const result = value(node, name, required); if (!result) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))
    || new Date(result).toISOString().slice(0, 10) !== result) fail(`date_${name}`);
  return result;
}
function rut(node: XmlNode, name: string) {
  const result = value(node, name, true)!;
  if (!/^\d{12}$/.test(result)) fail(`rut_${name}`);
  return result;
}

function extractInvoice(cfe: XmlNode, index: number, expectedRut: string): CfeXmlInvoice {
  const bodies = cfe.children.filter((entry) => entry.uri === namespace);
  if (bodies.length !== 1 || !["eFact", "eTck"].includes(bodies[0].name)) fail("type_unsupported");
  const body = bodies[0], header = one(body, "Encabezado")!, id = one(header, "IdDoc")!;
  const typeCode = value(id, "TipoCFE", true)!;
  if ((body.name === "eFact" && typeCode !== "111") || (body.name === "eTck" && typeCode !== "101")) fail("type_unsupported");
  const issuer = one(header, "Emisor")!, receiver = one(header, "Receptor")!;
  if (value(receiver, "TipoDocRecep", true) !== "2" || value(receiver, "CodPaisRecep", true) !== "UY") fail("recipient_unverified");
  const receiverRut = rut(receiver, "DocRecep"), issuerRut = rut(issuer, "RUCEmisor");
  if (receiverRut !== expectedRut || issuerRut === expectedRut) fail("recipient_mismatch");
  const series = value(id, "Serie", true)!, number = value(id, "Nro", true)!;
  if (!/^[A-Z]{1,2}$/.test(series) || !/^\d{1,7}$/.test(number) || Number(number) <= 0) fail("identity_invalid");
  const totals = one(header, "Totales")!, currency = value(totals, "TpoMoneda", true)!;
  if (!/^[A-Z]{3}$/.test(currency)) fail("currency_invalid");
  const total = decimal(totals, "MntTotal", true)!, payable = decimal(totals, "MntPagar", false, true);
  const nonBillable = decimal(totals, "MontoNF", false, true);
  const bruto = value(id, "MntBruto"); if (bruto !== null && !["1", "2", "3"].includes(bruto)) fail("bruto_invalid");
  // Other gross modes are retained for review, never treated as ordinary VAT.
  const amountsIncludeVat = bruto === "1";
  const warnings = ["XML recibido por correo: firma electrónica no verificada; requiere revisión humana."];
  let amountsRequireReview = bruto !== null && bruto !== "1";
  if (amountsRequireReview) warnings.push("Indicador de montos brutos especial: revisar importes antes de registrar.");
  const breakdown: DocumentIntakeAmountBreakdown[] = [];
  const amounts = [
    ["MntNoGrv", "No gravado", 0], ["MntNetoIvaTasaMin", "Neto IVA mínimo", 10],
    ["MntNetoIVATasaBasica", "Neto IVA básico", 22],
    ["MntIVATasaMin", "IVA mínimo", 10], ["MntIVATasaBasica", "IVA básico", 22],
  ] as const;
  for (const [tag, label, rate] of amounts) {
    const amount = decimal(totals, tag);
    if (amount !== null) breakdown.push({ label, amount, tax_rate: rate, tax_code: tag });
  }
  const net = money(amounts.slice(0, 3).reduce((sum, [tag]) => sum + (decimal(totals, tag) ?? 0), 0));
  const tax = money((decimal(totals, "MntIVATasaMin") ?? 0) + (decimal(totals, "MntIVATasaBasica") ?? 0));
  if (Math.abs(net + tax - total) > 0.011) { amountsRequireReview = true; warnings.push("El total incluye conceptos fuera del desglose soportado; no completar diferencias automáticamente."); }
  if (nonBillable || (payable !== null && Math.abs(payable - total) > 0.001)) {
    amountsRequireReview = true; warnings.push(`Total fiscal ${total.toFixed(2)}; total a pagar ${payable?.toFixed(2) ?? "no informado"}; monto no facturable ${nonBillable?.toFixed(2) ?? "no informado"}. Revisar su tratamiento.`);
  }
  const detail = one(body, "Detalle")!, items = children(detail, "Item");
  const expectedCount = decimal(totals, "CantLinDet", true)!;
  if (!items.length || items.length > 2000 || items.length !== expectedCount) fail("line_count_mismatch");
  const seen = new Set<number>(); const rawLines: Array<Record<string, string>> = [];
  const lineItems: DocumentIntakeLineItem[] = items.map((item) => {
    const n = decimal(item, "NroLinDet", true)!; if (!Number.isSafeInteger(n) || n <= 0 || seen.has(n)) fail("line_number_invalid"); seen.add(n);
    const indicator = value(item, "IndFact", true)!, raw = scalarFields(item); rawLines.push(raw);
    const quantity = decimal(item, "Cantidad", true)!, unit = decimal(item, "PrecioUnitario", true)!, amount = decimal(item, "MontoItem", true)!;
    const rate = indicator === "1" ? 0 : indicator === "2" ? decimal(totals, "IVATasaMin") : indicator === "3" ? decimal(totals, "IVATasaBasica") : null;
    if (!["1", "2", "3"].includes(indicator) || rate === null || (indicator === "2" && rate !== 10) || (indicator === "3" && rate !== 22)) amountsRequireReview = true;
    const supported = ["1", "2", "3"].includes(indicator) && rate !== null && !["2", "3"].includes(bruto ?? "");
    const lineNet = supported ? money(amountsIncludeVat ? amount / (1 + rate! / 100) : amount) : null;
    const lineTax = lineNet !== null ? (amountsIncludeVat ? money(amount - lineNet) : money(lineNet * rate! / 100)) : null;
    const codes = children(item, "CodItem");
    return { line_number: n, concept_code: codes.length === 1 ? value(codes[0], "Cod") : null,
      concept_description: value(item, "NomItem", true), quantity,
      unit_amount: supported ? Number((amountsIncludeVat ? unit / (1 + rate! / 100) : unit).toFixed(8)) : null,
      net_amount: lineNet, tax_rate: supported ? rate : null, tax_amount: lineTax,
      total_amount: lineNet !== null && lineTax !== null ? money(lineNet + lineTax) : null };
  });
  const documentType = rawLines.every((line) => ["6", "7"].includes(line.IndFact)) ? "purchase_payment_support" : "invoice";
  if (documentType === "purchase_payment_support") warnings.push("Comprobante no facturable: respaldo de pago/cobranza, no una nueva compra o gasto.");
  if (amountsRequireReview) warnings.push("Hay importes o indicadores de facturación que deben revisarse antes de cualquier registro.");
  if (one(body, "DscRcgGlobal", false) || one(body, "Retenciones", false)) { amountsRequireReview = true; warnings.push("Hay ajustes globales o retenciones que requieren revisión."); }
  if (Math.abs(lineItems.reduce((sum, line) => sum + (line.net_amount ?? 0), 0) - net) > 0.02
    || Math.abs(lineItems.reduce((sum, line) => sum + (line.tax_amount ?? 0), 0) - tax) > 0.02) {
    amountsRequireReview = true; warnings.push("Desglose de líneas y cabecera con diferencias: conservar valores originales y revisar.");
  }
  const payment = value(id, "FmaPago");
  const means = one(body, "MediosPago", false);
  const paymentEvidence = means ? children(means, "MedioPago").map((entry) => JSON.stringify(scalarFields(entry))) : [];
  const facts: DocumentIntakeFactMap = {
    issuer_name: value(issuer, "RznSoc", true), issuer_tax_id: issuerRut, issuer_address_raw: value(issuer, "DomFiscal"),
    issuer_department: value(issuer, "Departamento"), issuer_city: value(issuer, "Ciudad"), issuer_branch_code: value(issuer, "CdgDGISucur"),
    merchant_category_hints: [], location_extraction_confidence: null,
    receiver_name: value(receiver, "RznSocRecep", true), receiver_tax_id: receiverRut,
    document_number: String(Number(number)), series, currency_code: currency, document_date: date(id, "FchEmis", true), due_date: date(id, "FchVenc"),
    subtotal: net, tax_amount: tax, total_amount: total, purchase_category_candidate: null, sale_category_candidate: null,
  };
  const fiscalKey = [issuerRut, typeCode, series, String(Number(number))].join("|");
  const source = { cfeIndex: index, amountsIncludeVat, total, payable, nonBillable, exchangeRate: decimal(totals, "TpoCambio"),
    totals: scalarFields(totals), lines: rawLines, paymentEvidence, signatureVerified: false as const };
  const semanticHash = createHash("sha256").update(JSON.stringify({ typeCode, facts, lines: rawLines, totals: source.totals, paymentEvidence, bruto })).digest("hex");
  return { fiscalKey, semanticHash, typeCode, documentType, facts, amountBreakdown: breakdown, lineItems, warnings, amountsRequireReview,
    paymentTerms: payment === "1" ? "cash" : payment === "2" ? "credit" : "unknown", source };
}

/** No network, execution of XML content, XInclude, or signature fetching. */
export function parseCfeXml(bytes: Buffer, expectedReceiverTaxId: string): CfeXmlResult {
  if (!/^\d{12}$/.test(expectedReceiverTaxId)) fail("organization_rut_missing");
  const root = parseTree(bytes); if (root.uri !== namespace) fail("namespace_invalid");
  let cfes: XmlNode[];
  if (root.name === "CFE") cfes = [root];
  else if (root.name === "EnvioCFE_entreEmpresas") {
    const cover = one(root, "Caratula")!;
    if (rut(cover, "RutReceptor") !== expectedReceiverTaxId) fail("envelope_recipient_mismatch");
    const wrappers = children(root, "CFE_Adenda");
    cfes = wrappers.map((wrapper) => one(wrapper, "CFE")!);
    if (root.children.some((child) => child.uri === namespace && !["Caratula", "CFE_Adenda"].includes(child.name))) fail("envelope_structure");
    if (decimal(cover, "CantCFE", true) !== cfes.length) fail("envelope_count_mismatch");
  } else fail("root_unsupported");
  if (!cfes.length || cfes.length > 100) fail("cfe_count_limit");
  const result: CfeXmlResult = { invoices: [], pending: [] }; const seen = new Set<string>();
  cfes.forEach((cfe, index) => {
    try {
      const invoice = extractInvoice(cfe, index, expectedReceiverTaxId);
      if (seen.has(invoice.fiscalKey)) {
        // Conflicting versions in one envelope cannot make the first version authoritative.
        result.invoices = result.invoices.filter((entry) => entry.fiscalKey !== invoice.fiscalKey);
        fail("repeated_fiscal_identity");
      }
      seen.add(invoice.fiscalKey); result.invoices.push(invoice);
    } catch (error) { result.pending.push({ cfeIndex: index, reason: error instanceof Error ? error.message : "cfe_xml_invalid" }); }
  });
  return result;
}
