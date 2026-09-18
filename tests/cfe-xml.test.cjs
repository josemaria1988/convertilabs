/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { parseCfeXml, maxCfeXmlBytes } = require("@/modules/ingestion/cfe-xml");
const { cfe, envelope, secretCfe, secretAdenda } = require("./helpers/cfe-xml-fixture.cjs");
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

test("CFE XML supports the same CFE secret Adenda receiver with explicit provenance, never verified signature", () => {
  for (const options of [{}, { bankWrapper: true, documentType: "02" }]) {
    const result = parse(envelope([secretCfe()], secretAdenda(options)));
    assert.deepEqual(result.pending, []); assert.equal(result.invoices.length, 1);
    const invoice = result.invoices[0];
    assert.equal(invoice.facts.receiver_tax_id, "213554700012");
    assert.equal(invoice.facts.receiver_name, "Empresa receptora");
    assert.equal(invoice.source.receiverIdentity.source, "Adenda/SecretoProfesional/Receptor");
    assert.equal(invoice.source.receiverIdentity.documentType, options.documentType ?? "2");
    assert.equal(invoice.source.receiverIdentity.fiscalKey, invoice.fiscalKey);
    assert.equal(invoice.source.receiverIdentity.sameCfeWrapper, true);
    assert.equal(invoice.source.receiverIdentity.signatureVerified, false);
    assert.equal(invoice.source.signatureVerified, false);
    assert.ok(invoice.warnings.some(warning => /SecretoProfesional/.test(warning)));
  }
});

test("CFE secret Adenda rejects wrong or padded type, series and number instead of guessing identity", () => {
  for (const options of [{type:"101"},{series:"B"},{number:"201"},{number:"0000200"}]) {
    const result = parse(envelope([secretCfe()], secretAdenda(options)));
    assert.equal(result.invoices.length, 0); assert.match(result.pending[0].reason, /adenda_fiscal_identity_mismatch/);
  }
});

test("CFE secret Adenda never replaces an invalid or conflicting header recipient", () => {
  for (const header of [cfe({rut:"214444440014"}), cfe().replace("Empresa receptora", "Otra empresa")]) {
    const xml = header.replace("</IdDoc>", "<SecProf>1</SecProf></IdDoc>");
    const result = parse(envelope([xml], secretAdenda()));
    assert.equal(result.invoices.length, 0); assert.match(result.pending[0].reason, /adenda_recipient_conflict/);
  }
  const malformed = cfe().replace("<DocRecep>213554700012</DocRecep>", "").replace("</IdDoc>", "<SecProf>1</SecProf></IdDoc>");
  const result = parse(envelope([malformed], secretAdenda()));
  assert.equal(result.invoices.length, 0); assert.match(result.pending[0].reason, /field_DocRecep/);
});

test("CFE secret Adenda requires the organization's explicit RUT and secrecy indicator", () => {
  const wrong = parse(envelope([secretCfe()], secretAdenda({rut:"214444440014"})));
  assert.equal(wrong.invoices.length, 0); assert.match(wrong.pending[0].reason, /recipient_mismatch/);
  for (const xml of [secretCfe().replace("<SecProf>1</SecProf>", ""), secretCfe().replace("<SecProf>1", "<SecProf>0")]) {
    const result = parse(envelope([xml], secretAdenda()));
    assert.equal(result.invoices.length, 0); assert.match(result.pending[0].reason, /adenda_recipient_structure/);
  }
});

test("CFE secret Adenda does not borrow recipient from another CFE wrapper", () => {
  const xml = envelope([secretCfe(), secretCfe({number:"201"})]).replace("<Adenda></Adenda>", `<Adenda>${secretAdenda()}</Adenda>`);
  const result = parse(xml);
  assert.equal(result.invoices.length, 1); assert.equal(result.invoices[0].facts.document_number, "200");
  assert.equal(result.pending[0].cfeIndex, 1); assert.match(result.pending[0].reason, /field_Receptor/);
  const misplaced = envelope([secretCfe(), cfe({number:"201"})]).replace("<Adenda></Adenda>", `<Adenda>${secretAdenda({number:"201"})}</Adenda>`);
  const other = parse(misplaced);
  assert.equal(other.invoices.length, 1); assert.equal(other.invoices[0].facts.document_number, "201");
  assert.match(other.pending[0].reason, /adenda_fiscal_identity_mismatch/);
});

test("CFE secret Adenda blocks duplicate receivers, blocks, hidden comments and foreign namespaces", () => {
  const extraReceiver = secretAdenda().replace("</Receptor>", "</Receptor><Receptor><DocRecep>214444440014</DocRecep></Receptor>");
  const secret = secretAdenda().replace("<![CDATA[", "").replace("]]>", "");
  const oneDeclaration = secret.replace(/<\?xml.*?\?>/, "");
  for (const extra of [extraReceiver, `<![CDATA[${oneDeclaration}${oneDeclaration}]]>`,
    `<![CDATA[<!--${oneDeclaration}-->]]>`, secretAdenda().replace("<SecretoProfesional>", '<SecretoProfesional xmlns="https://invalid.example">'),
    secretAdenda().replace("<SecretoProfesional>", "<OtherCFE><SecretoProfesional>").replace("</SecretoProfesional>", "</SecretoProfesional></OtherCFE>")]) {
    const result = parse(envelope([secretCfe()], extra));
    assert.equal(result.invoices.length, 0); assert.equal(result.pending.length, 1);
  }
});

test("CFE secret Adenda rejects encoded DTD and entities without resolving anything", () => {
  const embedded = '&lt;!DOCTYPE SecretoProfesional SYSTEM "file:///private"&gt;&lt;SecretoProfesional/&gt;';
  const result = parse(envelope([secretCfe()], embedded));
  assert.equal(result.invoices.length, 0); assert.match(result.pending[0].reason, /dtd_forbidden/);
});

test("CFE header and corroborating secret Adenda preserve the original semantic identity", () => {
  const original = parse(cfe()).invoices[0];
  const matched = parse(envelope([cfe().replace("</IdDoc>", "<SecProf>1</SecProf></IdDoc>")], secretAdenda())).invoices[0];
  assert.equal(matched.semanticHash, original.semanticHash);
  assert.equal(matched.source.receiverIdentity.source, "Encabezado/Receptor");
  assert.equal(matched.source.receiverIdentity.adendaCorroborated, true);
});

test("CFE secret Adenda cannot hide a conflicting block behind Unicode prefixes or actual vendor child nodes", () => {
  const header = cfe().replace("</IdDoc>", "<SecProf>1</SecProf></IdDoc>");
  const unicode = secretAdenda({rut:"214444440014"}).replace("<SecretoProfesional>", '<ñ:SecretoProfesional xmlns:ñ="urn:vendor">').replace("</SecretoProfesional>", "</ñ:SecretoProfesional>");
  const child = '<vendor:SecretoProfesional xmlns:vendor="urn:vendor"><vendor:DocRecep>214444440014</vendor:DocRecep></vendor:SecretoProfesional>';
  for (const adenda of [unicode, child]) {
    const result = parse(envelope([header], adenda));
    assert.equal(result.invoices.length, 0); assert.equal(result.pending.length, 1);
  }
});
