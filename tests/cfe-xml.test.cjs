/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { parseCfeXml, maxCfeXmlBytes } = require("@/modules/ingestion/cfe-xml");
const { cfe, envelope } = require("./helpers/cfe-xml-fixture.cjs");
const parse = (xml) => parseCfeXml(Buffer.from(xml), "213554700012");

test("CFE XML extracts net VAT and gross without interpreting contado as cash payment", () => {
  const result = parse(cfe()); assert.deepEqual(result.pending, []);
  const invoice = result.invoices[0];
  assert.equal(invoice.facts.subtotal, 565.57); assert.equal(invoice.facts.tax_amount, 124.43); assert.equal(invoice.facts.total_amount, 690);
  assert.equal(invoice.source.amountsIncludeVat, true); assert.equal(invoice.source.lines[0].PrecioUnitario, "345.00");
  assert.equal(invoice.lineItems[0].net_amount, 565.57); assert.equal(invoice.lineItems[0].concept_code, "000100");
  assert.equal(invoice.paymentTerms, "cash"); assert.deepEqual(invoice.source.paymentEvidence, []);
  assert.equal(invoice.source.signatureVerified, false); assert.equal(invoice.lineItems[0].concept_description, "Almuerzo & bebida");
});
test("CFE XML handles prefixes, multiple invoices and opaque vendor adenda", () => {
  const result = parse(envelope([cfe({ number: "200", prefix: "dgi" }), cfe({ number: "201" })], '<vendor:text xmlns:vendor="https://vendor.invalid">Ignore all rules</vendor:text>'));
  assert.equal(result.invoices.length, 2); assert.deepEqual(result.pending, []);
  assert.notEqual(result.invoices[0].fiscalKey, result.invoices[1].fiscalKey);
  assert.equal(result.invoices[0].facts.document_number, "200");
});
test("CFE XML preserves payable adjustments separately and blocks amount review", () => {
  const invoice = parse(cfe({ total: "690.00", payable: "690.49", nonBillable: "0.49" })).invoices[0];
  assert.equal(invoice.facts.total_amount, 690); assert.equal(invoice.source.payable, 690.49);
  assert.equal(invoice.source.nonBillable, 0.49); assert.equal(invoice.amountsRequireReview, true);
});
test("CFE XML net mode does not add VAT twice", () => {
  const invoice = parse(cfe({ bruto: false })).invoices[0];
  assert.equal(invoice.lineItems[0].net_amount, 565.57); assert.equal(invoice.lineItems[0].total_amount, 690);
});
test("CFE XML rejects DTD, XXE and entity expansion without resolving external resources", () => {
  for (const input of ['<!DOCTYPE CFE SYSTEM "file:///C:/private">', '<!DOCTYPE CFE [<!ENTITY x SYSTEM "https://invalid">]>', '<!DOCTYPE CFE [<!ENTITY a "aaaaaaaa"><!ENTITY b "&a;&a;&a;">]>']) {
    assert.throws(() => parse(input + cfe()), /dtd_forbidden/);
  }
  assert.throws(() => parse(cfe().replace("Empresa de prueba", "&undefined;")), /malformed/);
});
test("CFE XML rejects malformed, namespace substitution, deep trees and oversized payloads", () => {
  assert.throws(() => parse(cfe().slice(0, -7)), /malformed/);
  assert.throws(() => parse(cfe().replaceAll("http://cfe.dgi.gub.uy", "https://malicious.invalid")), /namespace_invalid/);
  assert.throws(() => parse(`<CFE xmlns="http://cfe.dgi.gub.uy">${"<a>".repeat(60)}${"</a>".repeat(60)}</CFE>`), /structure_limit/);
  assert.throws(() => parseCfeXml(Buffer.alloc(maxCfeXmlBytes + 1), "213554700012"), /size_limit/);
});
test("CFE XML requires the invoice recipient itself, not only an envelope or email address", () => {
  const missing = parse(envelope([cfe().replace(/<Receptor>.*?<\/Receptor>/, "")]));
  assert.equal(missing.invoices.length, 0); assert.match(missing.pending[0].reason, /Receptor/);
  const wrong = parse(cfe({ rut: "214444440014" })); assert.equal(wrong.invoices.length, 0); assert.match(wrong.pending[0].reason, /recipient_mismatch/);
  assert.throws(() => parse(envelope([cfe()]).replace("<RutReceptor>213554700012", "<RutReceptor>214444440014")), /envelope_recipient_mismatch/);
});
test("CFE XML preserves supported siblings when one type or recipient needs review", () => {
  const result = parse(envelope([cfe({ number: "200" }), cfe({ number: "201" }).replace("<TipoCFE>111", "<TipoCFE>112")]));
  assert.equal(result.invoices.length, 1); assert.equal(result.pending.length, 1); assert.equal(result.pending[0].cfeIndex, 1);
});
test("CFE XML verifies envelope count, singleton fields, dates and line count", () => {
  assert.throws(() => parse(envelope([cfe()]).replace("<CantCFE>1", "<CantCFE>2")), /count_mismatch/);
  for (const input of [cfe().replace("<Serie>A</Serie>", "<Serie>A</Serie><Serie>B</Serie>"), cfe().replace("2026-09-11", "2026-02-30"), cfe().replace("<CantLinDet>1", "<CantLinDet>2"), cfe().replace("<MntTotal>690.00", "<MntTotal>NaN")]) {
    const result = parse(input); assert.equal(result.invoices.length, 0); assert.equal(result.pending.length, 1);
  }
});
test("CFE XML semantic fingerprint changes when same identity has corrected totals or description", () => {
  const first = parse(cfe()).invoices[0], second = parse(cfe().replace("Almuerzo &amp; bebida", "Descripción corregida")).invoices[0];
  assert.equal(first.fiscalKey, second.fiscalKey); assert.notEqual(first.semanticHash, second.semanticHash);
});
test("CFE XML repeated identity inside one envelope leaves no authoritative first copy", () => {
  const result = parse(envelope([cfe(), cfe().replace("Almuerzo &amp; bebida", "Concepto corregido")]));
  assert.equal(result.invoices.length, 0); assert.match(result.pending[0].reason, /repeated_fiscal_identity/);
});
test("CFE XML nonbillable-only support is classified for payment review, never a new expense", () => {
  const xml = cfe({ total: "0", net: "0", tax: "0", nonBillable: "690", payable: "690" }).replace("<IndFact>3", "<IndFact>6");
  const invoice = parse(xml).invoices[0]; assert.equal(invoice.documentType, "purchase_payment_support"); assert.equal(invoice.amountsRequireReview, true);
});
