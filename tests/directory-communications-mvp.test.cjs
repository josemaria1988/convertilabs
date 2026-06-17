/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { test, assert } = require("./testkit.cjs");

function createSupabaseStub(resolver) {
  const calls = [];

  function createBuilder(table) {
    const state = {
      table,
      mutation: null,
      payload: null,
      options: null,
      filters: [],
      neqFilters: [],
      inFilters: [],
      orFilters: [],
      orderCalls: [],
      selectClause: null,
      limitCount: null,
    };

    const snapshot = (mode) => ({
      ...state,
      filters: [...state.filters],
      neqFilters: [...state.neqFilters],
      inFilters: [...state.inFilters],
      orFilters: [...state.orFilters],
      orderCalls: [...state.orderCalls],
      mode,
    });
    const execute = (mode) => {
      const query = snapshot(mode);
      calls.push(query);
      return Promise.resolve(resolver(query));
    };

    const builder = {
      insert(payload) {
        state.mutation = "insert";
        state.payload = payload;
        return builder;
      },
      upsert(payload, options) {
        state.mutation = "upsert";
        state.payload = payload;
        state.options = options;
        return builder;
      },
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return builder;
      },
      neq(column, value) {
        state.neqFilters.push({ column, value });
        return builder;
      },
      in(column, values) {
        state.inFilters.push({ column, values });
        return builder;
      },
      or(value) {
        state.orFilters.push(value);
        return builder;
      },
      order(column, options) {
        state.orderCalls.push({ column, options });
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      single() {
        return execute("single");
      },
      maybeSingle() {
        return execute("maybeSingle");
      },
      then(resolve, reject) {
        return execute("then").then(resolve, reject);
      },
    };

    return builder;
  }

  return {
    calls,
    supabase: {
      from(table) {
        return createBuilder(table);
      },
    },
  };
}

function hasFilter(query, column, value) {
  return query.filters.some((filter) =>
    filter.column === column && filter.value === value);
}

test("PR-09 creates one party with customer and vendor roles", async () => {
  const { createDirectoryParty } = require("@/modules/directory");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.mutation) {
      writes.push(query);
    }

    if (query.table === "parties" && query.mutation === "insert") {
      return { data: { id: "party-1" }, error: null };
    }

    return { data: null, error: null };
  });

  const partyId = await createDirectoryParty(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    displayName: " Empresa Mixta ",
    taxId: "210000000019",
    roleTypes: ["customer", "vendor"],
  });

  assert.equal(partyId, "party-1");
  const partyInsert = writes.find((query) => query.table === "parties");
  assert.equal(partyInsert.payload.display_name, "Empresa Mixta");
  assert.equal(partyInsert.payload.tax_id, "210000000019");

  const roleUpsert = writes.find((query) => query.table === "party_roles");
  assert.equal(roleUpsert.payload.length, 2);
  assert.deepEqual(roleUpsert.payload.map((role) => role.role_type), ["customer", "vendor"]);
  assert.equal(roleUpsert.options.onConflict, "organization_id,party_id,role_type");

  const identifierUpsert = writes.find((query) => query.table === "party_identifiers");
  assert.equal(identifierUpsert.payload.identifier_type, "rut");
  assert.equal(identifierUpsert.payload.party_id, "party-1");
});

test("PR-09 adds multiple contacts to a party profile", async () => {
  const { addContactToParty } = require("@/modules/directory");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.mutation) {
      writes.push(query);
    }

    if (query.table === "contacts" && query.mutation === "insert") {
      return { data: { id: "contact-1" }, error: null };
    }

    return { data: null, error: null };
  });

  const contactId = await addContactToParty(supabase, {
    organizationId: "org-1",
    partyId: "party-1",
    fullName: " Ana Perez ",
    email: "ANA@EXAMPLE.COM",
    relationshipLabel: "Administracion",
    actorId: "user-1",
  });

  assert.equal(contactId, "contact-1");
  const contactInsert = writes.find((query) => query.table === "contacts");
  assert.equal(contactInsert.payload.full_name, "Ana Perez");
  assert.equal(contactInsert.payload.email_normalized, "ana@example.com");

  const linkUpsert = writes.find((query) => query.table === "party_contacts");
  assert.equal(linkUpsert.payload.party_id, "party-1");
  assert.equal(linkUpsert.payload.contact_id, "contact-1");
  assert.equal(linkUpsert.payload.relationship_label, "Administracion");
});

test("PR-09 creates an interaction linked to party, work unit and document", async () => {
  const { createInteractionWithLinks } = require("@/modules/communications");
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.mutation) {
      writes.push(query);
    }

    if (query.table === "interactions" && query.mutation === "insert") {
      return { data: { id: "interaction-1" }, error: null };
    }

    return { data: null, error: null };
  });

  const interactionId = await createInteractionWithLinks(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    partyId: "party-1",
    contactId: "contact-1",
    workUnitId: "work-1",
    documentId: "doc-1",
    interactionType: "meeting",
    subject: "Reunion Nueva Palmira",
    summary: "Se reviso avance y documentacion.",
  });

  assert.equal(interactionId, "interaction-1");
  const interactionInsert = writes.find((query) => query.table === "interactions");
  assert.equal(interactionInsert.payload.interaction_type, "meeting");
  assert.equal(interactionInsert.payload.subject, "Reunion Nueva Palmira");

  const participantInsert = writes.find((query) => query.table === "interaction_participants");
  assert.equal(participantInsert.payload.party_id, "party-1");
  assert.equal(participantInsert.payload.contact_id, "contact-1");

  const linksInsert = writes.find((query) => query.table === "interaction_links");
  assert.ok(linksInsert.payload.some((link) =>
    link.target_entity_type === "work_unit" && link.target_entity_id === "work-1"));
  assert.ok(linksInsert.payload.some((link) =>
    link.target_entity_type === "document" && link.target_entity_id === "doc-1"));
});

test("PR-09 party profile is scoped by organization and includes linked history", async () => {
  const { loadPartyProfile } = require("@/modules/directory");
  const { calls, supabase } = createSupabaseStub((query) => {
    if (query.table === "parties" && query.mode === "maybeSingle") {
      assert.ok(hasFilter(query, "organization_id", "org-1"));
      assert.ok(hasFilter(query, "id", "party-1"));
      return {
        data: {
          id: "party-1",
          display_name: "Cliente Nueva Palmira",
          legal_name: "Cliente Nueva Palmira SA",
          tax_id: "210000000019",
          status: "active",
          source: "manual",
          updated_at: "2026-06-17T10:00:00.000Z",
        },
        error: null,
      };
    }

    if (query.table === "party_roles") {
      return {
        data: [
          { party_id: "party-1", role_type: "customer", status: "active" },
          { party_id: "party-1", role_type: "vendor", status: "active" },
        ],
        error: null,
      };
    }

    if (query.table === "party_identifiers") {
      return {
        data: [{ id: "identifier-1", identifier_type: "rut", identifier_value: "210000000019", is_primary: true }],
        error: null,
      };
    }

    if (query.table === "party_contacts" && query.selectClause === "party_id") {
      return { data: [{ party_id: "party-1" }], error: null };
    }

    if (query.table === "party_contacts") {
      return {
        data: [{
          party_id: "party-1",
          contact_id: "contact-1",
          relationship_label: "Administracion",
          is_primary: true,
        }],
        error: null,
      };
    }

    if (query.table === "contacts") {
      return {
        data: [{
          id: "contact-1",
          full_name: "Ana Perez",
          email: "ana@example.com",
          phone: null,
          mobile: null,
          notes: null,
        }],
        error: null,
      };
    }

    if (query.table === "work_units") {
      return { data: [{ id: "work-1", name: "Trabajo Nueva Palmira", status: "active", kind: "job" }], error: null };
    }

    if (query.table === "documents") {
      return {
        data: [{
          id: "doc-1",
          original_filename: "venta.pdf",
          counterparty_name: "Cliente Nueva Palmira",
          document_date: "2026-06-17",
          lifecycle_status: "reviewed",
        }],
        error: null,
      };
    }

    if (query.table === "v_open_items_outstanding") {
      return {
        data: [{
          open_item_id: "open-1",
          document_role: "sale",
          due_date: "2026-06-20",
          outstanding_amount: 1000,
          status: "open",
        }],
        error: null,
      };
    }

    if (query.table === "tasks") {
      return { data: [{ id: "task-1", title: "Llamar", status: "pending", due_date: "2026-06-18" }], error: null };
    }

    if (query.table === "interaction_participants" && query.selectClause === "party_id, interaction_id") {
      return { data: [{ party_id: "party-1", interaction_id: "interaction-1" }], error: null };
    }

    if (query.table === "interaction_participants" && query.selectClause === "interaction_id") {
      return { data: [{ interaction_id: "interaction-1" }], error: null };
    }

    if (query.table === "interaction_participants") {
      return {
        data: [{ interaction_id: "interaction-1", party_id: "party-1", contact_id: "contact-1", role: "participant" }],
        error: null,
      };
    }

    if (query.table === "interaction_links" && query.selectClause === "target_entity_id, interaction_id") {
      return { data: [{ target_entity_id: "party-1", interaction_id: "interaction-1" }], error: null };
    }

    if (query.table === "interaction_links" && query.selectClause === "interaction_id") {
      return { data: [{ interaction_id: "interaction-1" }], error: null };
    }

    if (query.table === "interaction_links") {
      return {
        data: [{
          interaction_id: "interaction-1",
          target_entity_type: "document",
          target_entity_id: "doc-1",
          relation_type: "discusses",
        }],
        error: null,
      };
    }

    if (query.table === "interactions") {
      return {
        data: [{
          id: "interaction-1",
          interaction_type: "call",
          occurred_at: "2026-06-17T10:00:00.000Z",
          subject: "Llamada",
          summary: "Seguimiento",
          body: null,
          direction: "outbound",
          status: "recorded",
        }],
        error: null,
      };
    }

    return { data: [], error: null };
  });

  const profile = await loadPartyProfile(supabase, {
    organizationId: "org-1",
    partyId: "party-1",
  });

  assert.equal(profile.isAvailable, true);
  assert.equal(profile.party.displayName, "Cliente Nueva Palmira");
  assert.deepEqual(profile.party.roles, ["customer", "vendor"]);
  assert.equal(profile.contacts.length, 1);
  assert.equal(profile.workUnits[0].id, "work-1");
  assert.equal(profile.documents[0].id, "doc-1");
  assert.equal(profile.moneyItems[0].outstandingAmount, 1000);
  assert.equal(profile.tasks[0].id, "task-1");
  assert.equal(profile.interactions[0].id, "interaction-1");
  assert.ok(calls
    .filter((query) => ["parties", "documents", "tasks", "interactions"].includes(query.table))
    .every((query) => hasFilter(query, "organization_id", "org-1")));
});

test("PR-09 legacy party bridge keeps old vendor/customer data mapped to parties", () => {
  const {
    bindLegacyPartyPayloadIds,
    buildPartyBridgePayloadFromLegacyVendor,
  } = require("@/modules/directory");

  const payload = buildPartyBridgePayloadFromLegacyVendor({
    id: "vendor-1",
    organization_id: "org-1",
    name: "Proveedor Ruta",
    tax_id: "210000000019",
    tax_id_normalized: "210000000019",
    metadata: { imported: true },
  }, "user-1");
  const bound = bindLegacyPartyPayloadIds(payload, "party-1");

  assert.equal(bound.party.display_name, "Proveedor Ruta");
  assert.equal(bound.party.source, "legacy_vendor_bridge");
  assert.equal(bound.party.metadata.legacy_source_table, "vendors");
  assert.equal(bound.role.role_type, "vendor");
  assert.equal(bound.role.party_id, "party-1");
  assert.equal(bound.identifier.party_id, "party-1");
});

test("PR-09 schema defines interaction history tables", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const schemaSql = fs.readFileSync(
    path.join(projectRoot, "db", "schema", "12_operations_communications.sql"),
    "utf8",
  );

  assert.match(schemaSql, /create table if not exists public\.interactions/);
  assert.match(schemaSql, /interaction_type in \('call', 'email', 'whatsapp', 'meeting', 'note', 'visit', 'message', 'system_note'\)/);
  assert.match(schemaSql, /create table if not exists public\.interaction_participants/);
  assert.match(schemaSql, /create table if not exists public\.interaction_links/);
  assert.match(schemaSql, /alter table public\.interactions enable row level security/);
});
