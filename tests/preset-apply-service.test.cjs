/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  applyPresetComposition,
} = require("@/modules/accounting/preset-apply-service");

test("preset application falls back to legacy chart insert payload when step 5 columns are unavailable", async () => {
  const state = {
    existingAccounts: [],
    insertPayloads: [],
  };
  const missingColumnError = {
    code: "PGRST204",
    message: "Could not find the 'tax_profile_hint' column of 'chart_of_accounts' in the schema cache",
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
            data: state.existingAccounts,
            error: null,
          });
        },
        insert(payload) {
          state.insertPayloads.push(payload);

          if (state.insertPayloads.length === 1) {
            return Promise.resolve({
              error: missingColumnError,
            });
          }

          state.existingAccounts.push(...payload.map((row) => ({
            code: row.code,
          })));

          return Promise.resolve({
            error: null,
          });
        },
      };

      return builder;
    },
  };

  const result = await applyPresetComposition(supabase, {
    organizationId: "org-1",
    actorId: "user-1",
    source: "recommended",
    composition: {
      code: "uy_service_mix",
      label: "Servicios",
      basePresetCode: "uy_base",
      overlayCodes: ["uy_services"],
      rationale: "Compat test",
      accounts: [
        {
          code: "110101",
          name: "Caja y bancos",
          accountType: "asset",
          semanticKey: "cash_bank",
          isPostable: true,
          externalCode: "EXT-001",
          taxProfileHint: "UY_VAT_SALE_BASIC",
        },
      ],
    },
  });

  assert.equal(result.insertedCount, 1);
  assert.equal(state.insertPayloads.length, 2);
  assert.equal("tax_profile_hint" in state.insertPayloads[0][0], true);
  assert.equal("tax_profile_hint" in state.insertPayloads[1][0], false);
  assert.equal(
    state.insertPayloads[1][0].metadata.tax_profile_hint,
    "UY_VAT_SALE_BASIC",
  );
  assert.equal(
    state.insertPayloads[1][0].metadata.preset_composition_code,
    "uy_service_mix",
  );
  assert.deepEqual(
    state.insertPayloads[1][0].metadata.overlay_codes,
    ["uy_services"],
  );
});
