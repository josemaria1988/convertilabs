/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildReversalJournalEntry,
} = require("@/modules/accounting/kernel");
const {
  buildAccountingMonthRange,
  getAccountingMonthKey,
} = require("@/modules/accounting/periods");
const {
  loadJournalEntriesWorkspaceData,
  loadOpenItemsWorkspaceData,
  loadTrialBalanceWorkspaceData,
} = require("@/modules/accounting/read-model-repository");

function createSupabaseStub(resolver) {
  function createBuilder(table) {
    const state = {
      table,
      selectClause: null,
      filters: [],
      orderBy: [],
      limitCount: null,
    };

    const builder = {
      select(selectClause) {
        state.selectClause = selectClause;
        return builder;
      },
      eq(column, value) {
        state.filters.push({ type: "eq", column, value });
        return builder;
      },
      gte(column, value) {
        state.filters.push({ type: "gte", column, value });
        return builder;
      },
      lt(column, value) {
        state.filters.push({ type: "lt", column, value });
        return builder;
      },
      in(column, value) {
        state.filters.push({ type: "in", column, value });
        return builder;
      },
      order(column, options) {
        state.orderBy.push({ column, options });
        return builder;
      },
      limit(value) {
        state.limitCount = value;
        return builder;
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(resolver({
          ...state,
          mode: "execute",
        })).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return {
    from(table) {
      return createBuilder(table);
    },
  };
}

test("accounting period helpers normalize full dates into monthly ranges", () => {
  const period = buildAccountingMonthRange("2026-03-17");

  assert.equal(getAccountingMonthKey("2026-03-17"), "2026-03");
  assert.equal(period.periodKey, "2026-03");
  assert.equal(period.startDate, "2026-03-01");
  assert.equal(period.endDate, "2026-03-31");
  assert.equal(period.nextStartDate, "2026-04-01");
  assert.equal(period.code, "2026-03");
});

test("reversal journal entry honors an explicit monthly entry date", () => {
  const reversal = buildReversalJournalEntry({
    header: {
      organization_id: "org-1",
      fiscal_period_id: "fp-2026-04",
      entry_date: "2026-04-05",
      functional_currency_code: "UYU",
      functional_currency: "UYU",
      currency_code: "UYU",
      posting_mode: "final",
      source_channel: "documents",
      source_system: "convertilabs",
      reference: "A-100",
      description: "Compra marzo",
    },
    lines: [
      {
        line_no: 1,
        account_id: "acct-1",
        debit: 100,
        credit: 0,
        currency_code: "UYU",
        original_currency_code: "UYU",
        debit_original: 100,
        credit_original: 0,
        fx_rate: 1,
        fx_rate_applied: 1,
        functional_debit: 100,
        functional_credit: 0,
        functional_currency_code: "UYU",
        description: "Compras",
        metadata: {},
      },
    ],
    originalJournalEntryId: "je-1",
    actorId: "user-1",
  });

  assert.equal(reversal.header.entry_date, "2026-04-05");
  assert.equal(reversal.header.fiscal_period_id, "fp-2026-04");
});

test("journal entries workspace defaults to the latest monthly period", async () => {
  const supabase = createSupabaseStub((query) => {
    if (query.table === "v_journal_entries_read" && query.mode === "execute") {
      if (query.selectClause === "entry_date") {
        return {
          data: [
            { entry_date: "2026-03-15" },
            { entry_date: "2026-02-28" },
          ],
          error: null,
        };
      }

      const periodStart = query.filters.find((filter) =>
        filter.type === "gte" && filter.column === "entry_date");
      const nextStart = query.filters.find((filter) =>
        filter.type === "lt" && filter.column === "entry_date");

      assert.equal(periodStart?.value, "2026-03-01");
      assert.equal(nextStart?.value, "2026-04-01");

      return {
        data: [
          {
            organization_id: "org-1",
            journal_entry_id: "je-1",
            entry_number: 10,
            entry_date: "2026-03-15",
            status: "posted",
            posting_mode: "final",
            source_channel: "documents",
            source_system: "convertilabs",
            source_provider: null,
            provider_managed: false,
            source_document_id: "doc-1",
            source_event_id: "event-1",
            source_entity_type: "document",
            source_entity_id: "doc-1",
            source_external_id: "A-100",
            posting_proposal_id: null,
            posting_proposal_confirmability_status: null,
            accounting_snapshot_fingerprint: null,
            fiscal_period_id: "fp-2026-03",
            fiscal_period_code: "2026-03",
            fiscal_period_label: "Periodo 2026-03",
            fiscal_period_status: "open",
            journal_type_id: null,
            journal_type_code: null,
            journal_type_name: null,
            auxiliary_book_id: null,
            auxiliary_book_code: null,
            auxiliary_book_name: null,
            reference: "A-100",
            description: "Compra",
            currency_code: "UYU",
            functional_currency_code: "UYU",
            fx_rate: 1,
            fx_rate_date: "2026-03-15",
            fx_rate_source: "same_currency",
            total_debit: 122,
            total_credit: 122,
            functional_total_debit: 122,
            functional_total_credit: 122,
            source_hash: null,
            economic_hash: null,
            line_count: 2,
            distinct_account_count: 2,
            open_item_count: 1,
            open_item_outstanding_amount: 122,
            open_item_functional_amount: 122,
            settlement_link_count: 0,
            settlement_amount: 0,
            settlement_functional_amount: 0,
            last_settled_at: null,
            lineage_kind: "base",
            lineage_root_journal_entry_id: "je-1",
            lineage_depth: 0,
            reverses_journal_entry_id: null,
            reversed_by_journal_entry_id: null,
            adjusts_journal_entry_id: null,
            annulment_reason: null,
            is_immutable: true,
            is_active_leaf: true,
            first_seen_at: "2026-03-15T10:00:00.000Z",
            last_seen_at: "2026-03-15T10:00:00.000Z",
            created_at: "2026-03-15T10:00:00.000Z",
            updated_at: "2026-03-15T10:00:00.000Z",
          },
        ],
        error: null,
      };
    }

    if (query.table === "v_journal_lineage" && query.mode === "execute") {
      return {
        data: [],
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const data = await loadJournalEntriesWorkspaceData(supabase, {
    organizationId: "org-1",
  });

  assert.equal(data.isAvailable, true);
  assert.equal(data.selectedFiscalPeriodCode, "2026-03");
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.filterOptions.fiscalPeriodCodes, ["2026-03", "2026-02"]);
});

test("open items workspace defaults to the latest monthly period", async () => {
  const supabase = createSupabaseStub((query) => {
    if (query.table === "v_open_items_outstanding" && query.mode === "execute") {
      if (query.selectClause === "opening_entry_date") {
        return {
          data: [
            { opening_entry_date: "2026-03-20" },
            { opening_entry_date: "2026-02-10" },
          ],
          error: null,
        };
      }

      const periodStart = query.filters.find((filter) =>
        filter.type === "gte" && filter.column === "opening_entry_date");
      const nextStart = query.filters.find((filter) =>
        filter.type === "lt" && filter.column === "opening_entry_date");

      assert.equal(periodStart?.value, "2026-03-01");
      assert.equal(nextStart?.value, "2026-04-01");

      return {
        data: [
          {
            organization_id: "org-1",
            open_item_id: "oi-1",
            party_id: "party-1",
            counterparty_type: "vendor",
            counterparty_id: "vendor-1",
            counterparty_name: "Proveedor SA",
            counterparty_tax_id_normalized: "21433455019",
            source_channel: "documents",
            source_entity_type: "document",
            source_entity_id: "doc-1",
            source_document_id: "doc-1",
            document_role: "purchase",
            document_type: "purchase_invoice",
            issue_date: "2026-03-15",
            due_date: "2026-03-30",
            days_overdue: 0,
            currency_code: "UYU",
            original_currency_code: "UYU",
            functional_currency_code: "UYU",
            fx_rate: 1,
            fx_rate_date: "2026-03-15",
            fx_rate_source: "same_currency",
            original_amount: 122,
            functional_amount: 122,
            settled_amount: 0,
            outstanding_amount: 122,
            status: "open",
            opening_journal_entry_id: "je-1",
            opening_entry_number: 10,
            opening_entry_date: "2026-03-15",
            opening_journal_entry_line_id: "jel-1",
            settlement_count: 0,
            settled_amount_linked: 0,
            settled_functional_amount_linked: 0,
            last_settled_at: null,
            is_residual_credit_balance: false,
            provider_managed: false,
            source_hash: null,
            created_at: "2026-03-15T10:00:00.000Z",
            updated_at: "2026-03-15T10:00:00.000Z",
          },
        ],
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const data = await loadOpenItemsWorkspaceData(supabase, {
    organizationId: "org-1",
  });

  assert.equal(data.isAvailable, true);
  assert.equal(data.selectedFiscalPeriodCode, "2026-03");
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.filterOptions.fiscalPeriodCodes, ["2026-03", "2026-02"]);
});

test("trial balance workspace defaults to the latest monthly fiscal period", async () => {
  const supabase = createSupabaseStub((query) => {
    if (query.table === "v_journal_entries_read" && query.mode === "execute") {
      if (query.selectClause === "entry_date") {
        return {
          data: [
            { entry_date: "2026-03-31" },
            { entry_date: "2026-02-28" },
          ],
          error: null,
        };
      }

      if (query.filters.some((filter) => filter.type === "in")) {
        return {
          data: [],
          error: null,
        };
      }

      const periodStart = query.filters.find((filter) =>
        filter.type === "gte" && filter.column === "entry_date");
      const nextStart = query.filters.find((filter) =>
        filter.type === "lt" && filter.column === "entry_date");

      assert.equal(periodStart?.value, "2026-03-01");
      assert.equal(nextStart?.value, "2026-04-01");

      return {
        data: [
          {
            organization_id: "org-1",
            journal_entry_id: "je-1",
            entry_number: 10,
            entry_date: "2026-03-31",
            status: "posted",
            posting_mode: "final",
            source_channel: "documents",
            source_system: "convertilabs",
            source_provider: null,
            provider_managed: false,
            source_document_id: "doc-1",
            source_event_id: "event-1",
            source_entity_type: "document",
            source_entity_id: "doc-1",
            source_external_id: "A-100",
            posting_proposal_id: null,
            posting_proposal_confirmability_status: null,
            accounting_snapshot_fingerprint: null,
            fiscal_period_id: "fp-fy-2026",
            fiscal_period_code: "FY-2026",
            fiscal_period_label: "Ejercicio 2026",
            fiscal_period_status: "open",
            journal_type_id: null,
            journal_type_code: null,
            journal_type_name: null,
            auxiliary_book_id: null,
            auxiliary_book_code: null,
            auxiliary_book_name: null,
            reference: "A-100",
            description: "Compra",
            currency_code: "UYU",
            functional_currency_code: "UYU",
            fx_rate: 1,
            fx_rate_date: "2026-03-31",
            fx_rate_source: "same_currency",
            total_debit: 122,
            total_credit: 122,
            functional_total_debit: 122,
            functional_total_credit: 122,
            source_hash: null,
            economic_hash: null,
            line_count: 1,
            distinct_account_count: 1,
            open_item_count: 0,
            open_item_outstanding_amount: 0,
            open_item_functional_amount: 0,
            settlement_link_count: 0,
            settlement_amount: 0,
            settlement_functional_amount: 0,
            last_settled_at: null,
            lineage_kind: "base",
            lineage_root_journal_entry_id: "je-1",
            lineage_depth: 0,
            reverses_journal_entry_id: null,
            reversed_by_journal_entry_id: null,
            adjusts_journal_entry_id: null,
            annulment_reason: null,
            is_immutable: true,
            is_active_leaf: true,
            first_seen_at: "2026-03-31T10:00:00.000Z",
            last_seen_at: "2026-03-31T10:00:00.000Z",
            created_at: "2026-03-31T10:00:00.000Z",
            updated_at: "2026-03-31T10:00:00.000Z",
          },
        ],
        error: null,
      };
    }

    if (query.table === "journal_entry_lines" && query.mode === "execute") {
      return {
        data: [
          {
            journal_entry_id: "je-1",
            account_id: "acct-1",
            line_no: 1,
            debit: 122,
            credit: 0,
            functional_debit: 122,
            functional_credit: 0,
            chart_of_accounts: {
              id: "acct-1",
              code: "6101",
              name: "Compras",
              account_type: "expense",
              chapter_code: "6",
              presentation_code: "6.1",
              statement_section: "income_statement",
              natural_balance: "debit",
              normal_side: "debit",
            },
          },
        ],
        error: null,
      };
    }

    throw new Error(`Unexpected query: ${query.table}/${query.mode}`);
  });

  const data = await loadTrialBalanceWorkspaceData(supabase, {
    organizationId: "org-1",
  });

  assert.equal(data.isAvailable, true);
  assert.equal(data.selectedFiscalPeriodCode, "2026-03");
  assert.equal(data.rows.length, 1);
  assert.deepEqual(data.filterOptions.fiscalPeriodCodes, ["2026-03", "2026-02"]);
});
