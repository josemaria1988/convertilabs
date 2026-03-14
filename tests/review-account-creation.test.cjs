/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildReviewOverrideAccountPayload,
  createReviewOverrideAccount,
} = require("@/modules/accounting/repository");

function buildSupabaseState(overrides = {}) {
  return {
    accounts: [],
    audits: [],
    ...overrides,
  };
}

function buildSupabaseClient(state) {
  return {
    from(table) {
      if (table === "chart_of_accounts") {
        const queryState = {
          filters: {},
        };

        const builder = {
          select() {
            return builder;
          },
          eq(column, value) {
            queryState.filters[column] = value;
            return builder;
          },
          limit() {
            return builder;
          },
          maybeSingle: async () => ({
            data:
              state.accounts.find((row) => (
                (queryState.filters.organization_id === undefined
                  || row.organization_id === queryState.filters.organization_id)
                && (queryState.filters.code === undefined || row.code === queryState.filters.code)
                && (queryState.filters.is_active === undefined || row.is_active === queryState.filters.is_active)
              )) ?? null,
            error: null,
          }),
          insert(payload) {
            const row = {
              id: `acct-${state.accounts.length + 1}`,
              is_active: true,
              ...payload,
            };

            state.accounts.push(row);

            return {
              select() {
                return this;
              },
              limit() {
                return this;
              },
              single: async () => ({
                data: row,
                error: null,
              }),
            };
          },
        };

        return builder;
      }

      if (table === "audit_log") {
        return {
          insert(payload) {
            state.audits.push(payload);
            return Promise.resolve({
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table lookup: ${table}`);
    },
  };
}

test("review override payload creates revenue accounts for sale documents", () => {
  const payload = buildReviewOverrideAccountPayload({
    organizationId: "org-1",
    actorId: "user-1",
    documentId: "doc-1",
    draftId: "draft-1",
    documentRole: "sale",
    code: " 4105 ",
    name: " Ventas plaza mostrador ",
  });

  assert.equal(payload.code, "4105");
  assert.equal(payload.name, "Ventas plaza mostrador");
  assert.equal(payload.account_type, "revenue");
  assert.equal(payload.normal_side, "credit");
  assert.equal(payload.metadata.review_document_role, "sale");
});

test("createReviewOverrideAccount persists the account and records an audit event", async () => {
  const state = buildSupabaseState();
  const supabase = buildSupabaseClient(state);

  const account = await createReviewOverrideAccount(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    documentId: "doc-1",
    draftId: "draft-1",
    documentRole: "purchase",
    code: "6105",
    name: "Gastos de showroom",
  });

  assert.equal(account.code, "6105");
  assert.equal(account.account_type, "expense");
  assert.equal(state.accounts.length, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, "created_from_document_review");
  assert.equal(state.audits[0].metadata.document_id, "doc-1");
});

test("createReviewOverrideAccount rejects duplicate active account codes", async () => {
  const state = buildSupabaseState({
    accounts: [
      {
        id: "acct-existing",
        organization_id: "org-1",
        code: "4105",
        name: "Ventas existentes",
        account_type: "revenue",
        normal_side: "credit",
        is_postable: true,
        is_active: true,
        metadata: {},
      },
    ],
  });
  const supabase = buildSupabaseClient(state);

  await assert.rejects(
    createReviewOverrideAccount(supabase, {
      organizationId: "org-1",
      actorId: "user-1",
      documentId: "doc-1",
      draftId: "draft-1",
      documentRole: "sale",
      code: "4105",
      name: "Ventas duplicadas",
    }),
    /Ya existe una cuenta activa con ese codigo/,
  );
});
