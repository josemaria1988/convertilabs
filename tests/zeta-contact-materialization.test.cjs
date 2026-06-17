/* eslint-disable @typescript-eslint/no-require-imports */
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
      selectClause: null,
      limitCount: null,
    };
    const snapshot = (mode) => ({
      ...state,
      filters: [...state.filters],
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
      update(payload) {
        state.mutation = "update";
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

test("Zeta contact normalizer maps cliente/proveedor into a party candidate", () => {
  const { normalizeZetaContact } = require("@/modules/integrations/zeta/normalizers/contact");

  const contact = normalizeZetaContact({
    Codigo: "RONTIL",
    Nombre: "Rontil Comercial",
    RazonSocial: "Rontil S.A.",
    RUT: "21.111.222.0019",
    EsCliente: "S",
    EsProveedor: "S",
    ContactoActivo: "S",
    PaisCodigo: "858",
    DepartamentoNombre: "Montevideo",
    Localidad: "Montevideo",
    DireccionCompleta: "Av. Italia 1234",
    Email1: " ADMIN@RONTIL.COM ",
    FechaRegistro: "17/06/2026",
  });

  assert.equal(contact.externalKey, "RONTIL");
  assert.equal(contact.displayName, "Rontil Comercial");
  assert.equal(contact.legalName, "Rontil S.A.");
  assert.equal(contact.taxIdNormalized, "211112220019");
  assert.deepEqual(contact.roles, ["customer", "vendor"]);
  assert.equal(contact.countryCode, "UY");
  assert.deepEqual(contact.emails, ["admin@rontil.com"]);
  assert.equal(contact.registeredAt, "2026-06-17");
});

test("Zeta contact materialization creates party, roles, identifiers and external link", async () => {
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "integration_entity_links" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "parties" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "party_identifiers" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "parties" && query.mutation === "insert") {
      writes.push(query);
      return { data: { id: "party-1" }, error: null };
    }

    if (query.mutation === "upsert") {
      writes.push(query);
      return { data: query.payload, error: null };
    }

    return { data: null, error: null };
  });
  const { materializeZetaContacts } = require("@/modules/integrations/zeta/services/materialize-zeta-contacts");

  const summary = await materializeZetaContacts(supabase, {
    organizationId: "org-1",
    runId: "run-1",
    contacts: [
      {
        Codigo: "CLPR001",
        Nombre: "Cliente Proveedor",
        RUT: "21.999.999.0012",
        EsCliente: "S",
        EsProveedor: "S",
        ContactoActivo: "S",
      },
    ],
  });

  assert.equal(summary.created, 1);
  assert.equal(summary.updated, 0);
  assert.equal(summary.rolesUpserted, 2);
  assert.equal(summary.identifiersUpserted, 4);
  assert.equal(summary.linksUpserted, 1);
  assert.equal(summary.failed, 0);

  const partyInsert = writes.find((query) => query.table === "parties");
  assert.equal(partyInsert.payload.display_name, "Cliente Proveedor");
  assert.equal(partyInsert.payload.tax_id_normalized, "219999990012");

  const roleUpsert = writes.find((query) => query.table === "party_roles");
  assert.deepEqual(roleUpsert.payload.map((row) => row.role_type).sort(), ["customer", "vendor"]);

  const identifierUpsert = writes.find((query) => query.table === "party_identifiers");
  assert.deepEqual(
    identifierUpsert.payload.map((row) => row.identifier_type).sort(),
    ["rut", "zeta_contact_code", "zeta_customer_code", "zeta_supplier_code"],
  );

  const linkUpsert = writes.find((query) => query.table === "integration_entity_links");
  assert.equal(linkUpsert.payload.external_entity_type, "contact");
  assert.equal(linkUpsert.payload.external_key, "CLPR001");
  assert.equal(linkUpsert.payload.local_entity_id, "party-1");
});

test("Zeta contact materialization reuses exact active name when contact has no tax id", async () => {
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "integration_entity_links" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "party_identifiers" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (
      query.table === "parties"
      && query.mode === "then"
      && hasFilter(query, "metadata_json->>zeta_external_key", "CFINAL")
    ) {
      return { data: [], error: null };
    }

    if (
      query.table === "parties"
      && query.mode === "then"
      && hasFilter(query, "normalized_name", "consumidor final")
    ) {
      return {
        data: [
          {
            id: "party-final",
            display_name: "Consumidor final",
            legal_name: "Consumidor final",
            tax_id: null,
            tax_id_normalized: null,
            country_code: "UY",
            source: "manual",
            status: "active",
            metadata_json: {},
          },
        ],
        error: null,
      };
    }

    if (query.table === "parties" && query.mutation === "update") {
      writes.push(query);
      return { data: null, error: null };
    }

    if (query.mutation === "upsert") {
      writes.push(query);
      return { data: query.payload, error: null };
    }

    return { data: null, error: null };
  });
  const { materializeZetaContacts } = require("@/modules/integrations/zeta/services/materialize-zeta-contacts");

  const summary = await materializeZetaContacts(supabase, {
    organizationId: "org-1",
    runId: "run-1",
    contacts: [
      {
        Codigo: "CFINAL",
        Nombre: "Consumidor final",
        EsCliente: "S",
        ContactoActivo: "S",
      },
    ],
  });

  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 1);

  const partyInsert = writes.find((query) => query.table === "parties" && query.mutation === "insert");
  assert.equal(partyInsert, undefined);

  const linkUpsert = writes.find((query) => query.table === "integration_entity_links");
  assert.equal(linkUpsert.payload.local_entity_id, "party-final");
  assert.equal(linkUpsert.payload.match_method, "name_exact_without_tax_id");
});

test("Zeta contact materialization skips invalid tax identifiers without failing the contact", async () => {
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "integration_entity_links" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "parties" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "party_identifiers" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "parties" && query.mode === "then") {
      return { data: [], error: null };
    }

    if (query.table === "parties" && query.mutation === "insert") {
      writes.push(query);
      return { data: { id: "party-1" }, error: null };
    }

    if (query.mutation === "upsert") {
      writes.push(query);
      return { data: query.payload, error: null };
    }

    return { data: null, error: null };
  });
  const { materializeZetaContacts } = require("@/modules/integrations/zeta/services/materialize-zeta-contacts");

  const summary = await materializeZetaContacts(supabase, {
    organizationId: "org-1",
    runId: "run-1",
    contacts: [
      {
        Codigo: "CLBADTAX",
        Nombre: "Cliente sin documento valido",
        RUT: "SIN DATO",
        EsCliente: "S",
        ContactoActivo: "S",
      },
    ],
  });

  assert.equal(summary.created, 1);
  assert.equal(summary.failed, 0);

  const identifierUpsert = writes.find((query) => query.table === "party_identifiers");
  assert.deepEqual(
    identifierUpsert.payload.map((row) => row.identifier_type).sort(),
    ["zeta_contact_code", "zeta_customer_code"],
  );
});

test("Zeta contact materialization reuses party created by a previous partial run", async () => {
  const writes = [];
  const { supabase } = createSupabaseStub((query) => {
    if (query.table === "integration_entity_links" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "parties" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (query.table === "party_identifiers" && query.mode === "maybeSingle") {
      return { data: null, error: null };
    }

    if (
      query.table === "parties"
      && query.mode === "then"
      && hasFilter(query, "metadata_json->>zeta_external_key", "CLPARTIAL")
    ) {
      return {
        data: [
          {
            id: "party-partial",
            display_name: "Cliente parcial",
            legal_name: "Cliente parcial",
            tax_id: "SIN DATO",
            tax_id_normalized: null,
            country_code: "UY",
            source: "zetasoftware",
            status: "active",
            metadata_json: {
              zeta_external_key: "CLPARTIAL",
            },
          },
        ],
        error: null,
      };
    }

    if (query.table === "parties" && query.mutation === "update") {
      writes.push(query);
      return { data: null, error: null };
    }

    if (query.mutation === "upsert") {
      writes.push(query);
      return { data: query.payload, error: null };
    }

    return { data: null, error: null };
  });
  const { materializeZetaContacts } = require("@/modules/integrations/zeta/services/materialize-zeta-contacts");

  const summary = await materializeZetaContacts(supabase, {
    organizationId: "org-1",
    runId: "run-1",
    contacts: [
      {
        Codigo: "CLPARTIAL",
        Nombre: "Cliente parcial",
        RUT: "SIN DATO",
        EsCliente: "S",
        ContactoActivo: "S",
      },
    ],
  });

  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 1);

  const partyInsert = writes.find((query) => query.table === "parties" && query.mutation === "insert");
  assert.equal(partyInsert, undefined);

  const linkUpsert = writes.find((query) => query.table === "integration_entity_links");
  assert.equal(linkUpsert.payload.local_entity_id, "party-partial");
  assert.equal(linkUpsert.payload.match_method, "zeta_metadata_external_key");
});
