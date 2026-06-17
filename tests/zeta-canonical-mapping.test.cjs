/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

test("PR-11 maps Zeta Contacto and RUT to party draft and identifier", () => {
  const { buildZetaContactPartyDraft } = require("@/modules/integrations/zeta/canonical-mapping");

  const draft = buildZetaContactPartyDraft({
    organizationId: "org-1",
    raw: {
      Codigo: "CL001",
      Nombre: "Cliente Nueva Palmira",
      RUT: "21.433.455.019",
    },
  });

  assert.equal(draft.party.organization_id, "org-1");
  assert.equal(draft.party.display_name, "Cliente Nueva Palmira");
  assert.equal(draft.party.source, "zetasoftware");
  assert.equal(draft.identifier.identifier_type, "rut");
  assert.equal(draft.identifier.normalized_value, "21433455019");
  assert.equal(draft.integrationLink.externalEntityType, "contact");
  assert.equal(draft.integrationLink.localEntityType, "party");
});

test("PR-11 maps Zeta CentroCosto to work_unit draft and external link", () => {
  const { buildZetaCostCenterWorkUnitDraft } = require("@/modules/integrations/zeta/canonical-mapping");

  const draft = buildZetaCostCenterWorkUnitDraft({
    organizationId: "org-1",
    raw: {
      Codigo: "NP01",
      Nombre: "Trabajo Nueva Palmira",
      Activo: "S",
    },
  });

  assert.equal(draft.workUnit.code, "NP01");
  assert.equal(draft.workUnit.kind, "cost_center");
  assert.equal(draft.workUnit.metadata_json.zeta_cost_center_code, "NP01");
  assert.equal(draft.integrationLink.externalEntityType, "cost_center");
  assert.equal(draft.integrationLink.localEntityType, "work_unit");
});

test("PR-11 maps received CFE canonical document to document source refs", () => {
  const { buildZetaCfeDocumentDraft } = require("@/modules/integrations/zeta/canonical-mapping");

  const draft = buildZetaCfeDocumentDraft({
    organizationId: "org-1",
    rawRecordId: "raw-1",
    document: {
      provider: "zetasoftware",
      sourceKind: "zeta_received_cfe",
      stream: "zeta.documents.received_cfe",
      entityType: "received_cfe",
      externalKey: "cfe_recibido:rut:111:A:123",
      humanKey: "A 123",
      payloadHash: "sha256:abc",
      documentRole: "purchase",
      documentType: "purchase_invoice",
      issueDate: "2026-06-17",
      dueDate: null,
      series: "A",
      number: "123",
      reference: "A 123",
      localCode: null,
      costCenterExternalCode: "NP01",
      operationCode: null,
      counterparty: {
        role: "vendor",
        externalCode: "PR001",
        name: "Proveedor",
        legalName: "Proveedor SA",
        taxId: "21.000.000.001",
        taxIdNormalized: "21000000001",
      },
      currency: {
        currencyCode: "UYU",
        zetaCurrencyCode: 1,
        sourceRate: null,
        sourceRateDate: null,
        sourceRateKind: null,
        fxStatus: "same_currency",
      },
      amounts: {
        net: 100,
        tax: 22,
        total: 122,
      },
      taxBreakdown: [],
      cfe: {
        typeCode: 111,
        state: null,
        dgiState: null,
        receiverState: null,
      },
      lines: [],
      warnings: [],
      sourcePdfUrl: null,
      raw: {},
    },
  });

  assert.equal(draft.document.source_reference, "cfe_recibido:rut:111:A:123");
  assert.equal(draft.document.metadata.zeta_cost_center_external_code, "NP01");
  assert.equal(draft.sourceRef.raw_record_id, "raw-1");
  assert.equal(draft.sourceRef.factual_trust_mode, "external_deterministic");
});

test("PR-11 journal export includes work_unit as CentroCostos", () => {
  const { buildZetaJournalExportPayload } = require("@/modules/integrations/zeta/canonical-mapping");

  const payload = buildZetaJournalExportPayload({
    reference: "JE-1",
    date: "2026-06-17",
    concept: "Venta Nueva Palmira",
    workUnit: {
      id: "work-1",
      code: "NP-2026-001",
      name: "Trabajo Nueva Palmira",
      externalCode: "NP01",
    },
    lines: [
      { accountCode: "1111", debit: 122, credit: 0 },
      { accountCode: "4111", debit: 0, credit: 100 },
      { accountCode: "2131", debit: 0, credit: 22 },
    ],
  });

  const lines = payload.Data.Asientos[0].Lineas;
  assert.equal(lines.length, 3);
  assert.ok(lines.every((line) => line.CentroCostos === "NP01"));
});
