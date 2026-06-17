/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildContactPayload,
  buildPartyContactPayload,
  buildPartyCreatePayload,
  buildPartyIdentifierPayload,
  buildPartyRolePayload,
  normalizePartyIdentifierValue,
  resolvePartyDisplayLabel,
} = require("@/modules/directory");
const {
  buildWorkUnitCreatePayload,
  buildDocumentCostCenterBridgeMetadata,
  buildWorkUnitPayloadFromLegacyCostCenter,
  canArchiveWorkUnit,
  canMutateWorkUnit,
  summarizeWorkUnitFinancials,
} = require("@/modules/work");
const {
  bindLegacyPartyPayloadIds,
  buildPartyBridgePayloadFromLegacyCustomer,
  buildPartyBridgePayloadFromLegacyVendor,
} = require("@/modules/directory");
const {
  buildBusinessEventPayload,
  buildDocumentWorkUnitLinkPayload,
  buildEntityLinkPayload,
  buildEvidenceRefPayload,
} = require("@/modules/events");

test("directory helpers normalize parties, roles, identifiers and contacts", () => {
  const party = buildPartyCreatePayload({
    organizationId: "org-1",
    displayName: "  Empresa   ABC  ",
    taxId: "RUT 21.999999.0012",
    defaultCurrencyCode: "uyu",
    actorId: "user-1",
  });

  assert.equal(party.display_name, "Empresa ABC");
  assert.equal(party.legal_name, "Empresa ABC");
  assert.equal(party.normalized_name, "empresa abc");
  assert.equal(party.tax_id_normalized, "219999990012");
  assert.equal(party.default_currency_code, "UYU");
  assert.equal(party.created_by, "user-1");

  const role = buildPartyRolePayload({
    organizationId: "org-1",
    partyId: "party-1",
    roleType: "customer",
  });

  assert.equal(role.role_type, "customer");
  assert.equal(role.status, "active");

  const rut = buildPartyIdentifierPayload({
    organizationId: "org-1",
    partyId: "party-1",
    identifierType: "rut",
    identifierValue: "21.999999.0012",
    isPrimary: true,
  });

  assert.equal(rut.identifier_value_normalized, "219999990012");
  assert.equal(rut.is_primary, true);
  assert.equal(normalizePartyIdentifierValue("email", " INFO@ABC.COM "), "info@abc.com");

  const contact = buildContactPayload({
    organizationId: "org-1",
    fullName: "  Maria   Perez ",
    email: " MARIA@ABC.COM ",
  });

  assert.equal(contact.full_name, "Maria Perez");
  assert.equal(contact.email_normalized, "maria@abc.com");

  const link = buildPartyContactPayload({
    organizationId: "org-1",
    partyId: "party-1",
    contactId: "contact-1",
    relationshipLabel: " administracion ",
  });

  assert.equal(link.relationship_label, "administracion");
  assert.equal(resolvePartyDisplayLabel({ taxId: "219999990012" }), "219999990012");
});

test("work helpers create work units and summarize margin", () => {
  const payload = buildWorkUnitCreatePayload({
    organizationId: "org-1",
    name: " Trabajo   Nueva Palmira ",
    kind: "job",
    status: "active",
    customerPartyId: "party-1",
    estimatedRevenue: 1000,
    estimatedCost: 700,
    actualRevenue: 1200,
    actualCost: 900,
    currencyCode: "uyu",
    actorId: "user-1",
  });

  assert.equal(payload.name, "Trabajo Nueva Palmira");
  assert.equal(payload.normalized_name, "trabajo nueva palmira");
  assert.equal(payload.kind, "job");
  assert.equal(payload.status, "active");
  assert.equal(payload.currency_code, "UYU");
  assert.equal(payload.margin_status, "healthy");
  assert.equal(payload.customer_party_id, "party-1");

  const atRisk = summarizeWorkUnitFinancials({
    actualRevenue: 1000,
    actualCost: 950,
  });

  assert.equal(atRisk.actualMargin, 50);
  assert.equal(atRisk.actualMarginRatio, 0.05);
  assert.equal(atRisk.marginStatus, "at_risk");
  assert.equal(canMutateWorkUnit("operator"), true);
  assert.equal(canArchiveWorkUnit("operator"), false);

  assert.throws(() => {
    buildWorkUnitCreatePayload({
      organizationId: "org-1",
      name: "Invalid dates",
      startDate: "2026-06-20",
      endDate: "2026-06-10",
    });
  }, /end_date/i);
});

test("events helpers create business events, entity links and evidence refs", () => {
  const event = buildBusinessEventPayload({
    organizationId: "org-1",
    eventType: "purchase_document_received",
    occurredAt: "2026-06-17T10:00:00.000Z",
    sourceEntityType: "document",
    sourceEntityId: "doc-1",
    partyId: "party-1",
    workUnitId: "work-1",
    summary: "Factura recibida",
  });

  assert.equal(event.event_type, "purchase_document_received");
  assert.equal(event.source_entity_type, "document");
  assert.equal(event.work_unit_id, "work-1");

  const documentWorkLink = buildDocumentWorkUnitLinkPayload({
    organizationId: "org-1",
    documentId: "doc-1",
    workUnitId: "work-1",
    confidence: 0.98765,
  });

  assert.equal(documentWorkLink.source_entity_type, "document");
  assert.equal(documentWorkLink.target_entity_type, "work_unit");
  assert.equal(documentWorkLink.relation_type, "belongs_to");
  assert.equal(documentWorkLink.confidence, 0.9877);

  const evidence = buildEvidenceRefPayload({
    organizationId: "org-1",
    evidenceType: "storage_object",
    storageBucket: "documents-private",
    storagePath: "orgs/org-1/doc-1/factura.pdf",
  });

  assert.equal(evidence.evidence_type, "storage_object");
  assert.equal(evidence.storage_bucket, "documents-private");

  assert.throws(() => {
    buildEntityLinkPayload({
      organizationId: "org-1",
      sourceEntityType: "document",
      sourceEntityId: "doc-1",
      targetEntityType: "document",
      targetEntityId: "doc-1",
      relationType: "related_to",
    });
  }, /itself/i);

  assert.throws(() => {
    buildEvidenceRefPayload({
      organizationId: "org-1",
      evidenceType: "note",
    });
  }, /Evidence requires/i);
});

test("legacy bridge helpers adapt cost centers and parties into canonical payloads", () => {
  const workUnit = buildWorkUnitPayloadFromLegacyCostCenter({
    id: "cc-1",
    organization_id: "org-1",
    name: " Nueva  Palmira ",
    description: "Obra principal",
    is_active: true,
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-02T10:00:00.000Z",
    archived_at: null,
    metadata: { old: true },
  }, "user-1");

  assert.equal(workUnit.name, "Nueva Palmira");
  assert.equal(workUnit.kind, "cost_center");
  assert.equal(workUnit.status, "active");
  assert.equal(workUnit.legacy_cost_center_id, "cc-1");
  assert.equal(workUnit.metadata_json.legacy_source_table, "organization_cost_centers");

  const metadata = buildDocumentCostCenterBridgeMetadata({
    currentMetadata: { existing: true },
    costCenterId: "cc-1",
    workUnitId: "work-1",
    actorId: "user-1",
    assignmentSource: "desktop_documents",
    assignedAt: "2026-06-17T10:00:00.000Z",
  });

  assert.equal(metadata.existing, true);
  assert.equal(metadata.bridged_cost_center_id, "cc-1");
  assert.equal(metadata.bridged_work_unit_id, "work-1");

  const vendorPayload = buildPartyBridgePayloadFromLegacyVendor({
    id: "vendor-1",
    organization_id: "org-1",
    name: "Proveedor SA",
    tax_id: "21.999999.0012",
    tax_id_normalized: "219999990012",
    metadata: { source: "legacy" },
  }, "user-1");
  const boundVendor = bindLegacyPartyPayloadIds(vendorPayload, "party-1");

  assert.equal(boundVendor.party.legacy_vendor_id, "vendor-1");
  assert.equal(boundVendor.role.party_id, "party-1");
  assert.equal(boundVendor.role.role_type, "vendor");
  assert.equal(boundVendor.identifier.party_id, "party-1");

  const customerPayload = buildPartyBridgePayloadFromLegacyCustomer({
    id: "customer-1",
    organization_id: "org-1",
    name: "Cliente SA",
    tax_id: null,
    tax_id_normalized: null,
    metadata: null,
  });

  assert.equal(customerPayload.party.legacy_customer_id, "customer-1");
  assert.equal(customerPayload.role.role_type, "customer");
  assert.equal(customerPayload.identifier, null);
});
