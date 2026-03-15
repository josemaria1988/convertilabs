/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildStarterChartAccountPayload,
  ensureStarterAccountingSetup,
} = require("@/modules/accounting/starter-accounts");

test("starter chart payload includes minimal system and generic accounts for empty organizations", () => {
  const payload = buildStarterChartAccountPayload({
    organizationId: "org-1",
    actorId: "user-1",
    existingAccounts: [],
  });

  assert.equal(payload.length, 11);
  assert.deepEqual(
    payload.map((row) => row.code),
    [
      "SYS-AR",
      "SYS-AP",
      "SYS-VAT-IN",
      "SYS-VAT-OUT",
      "GEN-SALE",
      "GEN-EXP",
      "TEMP-EXP",
      "TEMP-REV",
      "TEMP-INV",
      "TEMP-AST",
      "TEMP-LIA",
    ],
  );
  assert.equal(
    payload.find((row) => row.code === "SYS-AR")?.metadata.system_role,
    "accounts_receivable",
  );
  assert.equal(
    payload.find((row) => row.code === "GEN-SALE")?.metadata.starter_role,
    "generic_sale_revenue",
  );
  assert.equal(
    payload.find((row) => row.code === "TEMP-EXP")?.is_provisional,
    true,
  );
});

test("starter accounting setup inserts only missing accounts", async () => {
  const state = {
    accounts: [],
    inserts: [],
  };

  const supabase = {
    from(table) {
      assert.equal(table, "chart_of_accounts");

      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        then(resolve) {
          resolve({
            data: state.accounts,
            error: null,
          });
        },
        insert(payload) {
          state.inserts.push(payload);
          state.accounts.push(...payload.map((row) => ({
            code: row.code,
            account_type: row.account_type,
            is_postable: row.is_postable,
            metadata: row.metadata,
          })));

          return Promise.resolve({
            error: null,
          });
        },
      };

      return builder;
    },
  };

  const seeded = await ensureStarterAccountingSetup(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
  });
  const repeated = await ensureStarterAccountingSetup(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
  });

  assert.equal(seeded.insertedCount, 11);
  assert.equal(state.inserts.length, 1);
  assert.equal(repeated.insertedCount, 0);
});

test("starter chart skips synthetic revenue and expense when organization already has postable ones", () => {
  const payload = buildStarterChartAccountPayload({
    organizationId: "org-1",
    actorId: null,
    existingAccounts: [
      {
        code: "4101",
        account_type: "revenue",
        is_postable: true,
        metadata: {},
      },
      {
        code: "6101",
        account_type: "expense",
        is_postable: true,
        metadata: {},
      },
    ],
  });

  assert.equal(payload.some((row) => row.code === "GEN-SALE"), false);
  assert.equal(payload.some((row) => row.code === "GEN-EXP"), false);
  assert.equal(payload.some((row) => row.code === "SYS-AR"), true);
});
