import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountRoleCode,
  JsonRecord,
  PostableAccountRecord,
} from "@/modules/accounting/types";
import {
  getPostingTemplateDefinition,
  type PostingTemplateAmountSource,
  type PostingTemplateDefinition,
  type PostingTemplateLineAccountRef,
} from "@/modules/accounting/posting-template-catalog";
import {
  listAccountRoleMappings,
  type AccountRoleMappingView,
} from "@/modules/accounting/account-role-map-service";

export type NormalizedDocumentAccountingFacts = {
  documentRole: "purchase" | "sale";
  netAmount?: number | null;
  vatAmount?: number | null;
  grossTotal?: number | null;
  currencyCode?: string | null;
  vatRate?: number | null;
  documentPrimaryAccountId?: string | null;
  documentPrimaryExternalCode?: string | null;
  zetaConceptAccountExternalCode?: string | null;
  metadata?: JsonRecord | null;
};

export type RoleResolution = {
  accountRoleCode: string;
  chartAccountId: string | null;
  accountExternalCode: string | null;
  accountName: string | null;
  source: "concept_zeta" | "role_map" | "missing" | "invalid";
  blocker: string | null;
};

export type PostingTemplateBlocker = {
  code: string;
  message: string;
  accountRoleCode?: string | null;
};

export type PostingTemplateWarning = {
  code: string;
  message: string;
  accountRoleCode?: string | null;
};

export type ResolvedPostingTemplateLine = {
  lineKey: string;
  debitCredit: "debit" | "credit";
  accountRoleCode: AccountRoleCode;
  chartAccountId: string | null;
  accountExternalCode: string | null;
  accountName: string | null;
  amount: number;
  currencyCode: string;
  literalTributario: number | null;
  description: string;
};

export type ResolvedPostingTemplatePreview = {
  documentId: string;
  postingTemplateCode: string;
  postingTemplateVersion: string;
  operationKind: string;
  operationFamily: string;
  paymentTerms: string;
  zetaJournalTypeCode: string | null;
  zetaJournalTypeName: string | null;
  lines: ResolvedPostingTemplateLine[];
  roleResolutions: RoleResolution[];
  blockers: PostingTemplateBlocker[];
  warnings: PostingTemplateWarning[];
  createsOpenItem: boolean;
  isBalanced: boolean;
  mode: "automatic" | "assisted" | "blocked";
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function asAmount(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return roundCurrency(value);
    }
  }

  return 0;
}

function accountIsImputable(account: PostableAccountRecord | null | undefined) {
  if (!account) {
    return false;
  }

  if (account.is_postable === false) {
    return false;
  }

  return account.is_imputable !== false;
}

function accountExternalCode(account: PostableAccountRecord | null | undefined) {
  if (!account) {
    return null;
  }

  return account.external_code ?? account.code ?? null;
}

function findAccountByIdOrCode(input: {
  accounts: PostableAccountRecord[];
  accountId?: string | null;
  externalCode?: string | null;
}) {
  if (input.accountId) {
    const byId = input.accounts.find((account) => account.id === input.accountId);

    if (byId) {
      return byId;
    }
  }

  const externalCode = input.externalCode?.trim();

  if (externalCode) {
    return input.accounts.find((account) =>
      account.external_code === externalCode || account.code === externalCode,
    ) ?? null;
  }

  return null;
}

function resolveTaxRole(input: {
  template: PostingTemplateDefinition;
  facts: NormalizedDocumentAccountingFacts;
}) {
  const isPurchase =
    input.template.direction === "incoming"
    || input.template.operationKind === "purchase"
    || input.template.operationKind === "supplier_credit_note";
  const rate = Math.abs(input.facts.vatRate ?? 0);

  if (isPurchase) {
    if (Math.abs(rate - 22) < 0.001) {
      return "vat_purchase_basic" satisfies AccountRoleCode;
    }

    if (Math.abs(rate - 10) < 0.001) {
      return "vat_purchase_minimum" satisfies AccountRoleCode;
    }

    return "vat_purchase_other" satisfies AccountRoleCode;
  }

  if (Math.abs(rate - 22) < 0.001) {
    return "vat_sales_basic" satisfies AccountRoleCode;
  }

  if (Math.abs(rate - 10) < 0.001) {
    return "vat_sales_minimum" satisfies AccountRoleCode;
  }

  return "vat_sales_other" satisfies AccountRoleCode;
}

function resolveAmount(source: PostingTemplateAmountSource, input: {
  netAmount: number;
  vatAmount: number;
  grossTotal: number;
}) {
  switch (source) {
    case "net_amount":
      return input.netAmount;
    case "vat_amount":
      return input.vatAmount;
    case "gross_total":
      return input.grossTotal;
    case "net_amount_negative":
      return -input.netAmount;
    case "vat_amount_negative":
      return -input.vatAmount;
    case "gross_total_negative":
      return -input.grossTotal;
    default:
      return 0;
  }
}

function buildMappingAccountMap(mappings: AccountRoleMappingView[]) {
  const map = new Map<AccountRoleCode, PostableAccountRecord>();

  for (const mapping of mappings) {
    if (mapping.account) {
      map.set(mapping.accountRoleCode, mapping.account as PostableAccountRecord);
    }
  }

  return map;
}

function createRoleResolution(input: {
  roleCode: AccountRoleCode;
  account: PostableAccountRecord | null;
  source: RoleResolution["source"];
}) {
  if (!input.account) {
    return {
      accountRoleCode: input.roleCode,
      chartAccountId: null,
      accountExternalCode: null,
      accountName: null,
      source: "missing",
      blocker: `missing_role_mapping:${input.roleCode}`,
    } satisfies RoleResolution;
  }

  if (!accountIsImputable(input.account)) {
    return {
      accountRoleCode: input.roleCode,
      chartAccountId: input.account.id,
      accountExternalCode: accountExternalCode(input.account),
      accountName: input.account.name,
      source: "invalid",
      blocker: `role_account_not_imputable:${input.roleCode}`,
    } satisfies RoleResolution;
  }

  return {
    accountRoleCode: input.roleCode,
    chartAccountId: input.account.id,
    accountExternalCode: accountExternalCode(input.account),
    accountName: input.account.name,
    source: input.source,
    blocker: null,
  } satisfies RoleResolution;
}

function lineAccountReferenceToRole(input: {
  accountRef: PostingTemplateLineAccountRef;
  template: PostingTemplateDefinition;
  facts: NormalizedDocumentAccountingFacts;
}) {
  if (input.accountRef === "document_primary_account") {
    return "purchase_expense_default" satisfies AccountRoleCode;
  }

  if (input.accountRef === "tax_role_by_rate") {
    return resolveTaxRole({
      template: input.template,
      facts: input.facts,
    });
  }

  return input.accountRef;
}

export async function resolvePostingTemplatePreview(params: {
  organizationId: string;
  documentId: string;
  candidateTemplateCode: string;
  facts: NormalizedDocumentAccountingFacts;
  actorProfileId?: string | null;
  supabase?: SupabaseClient | null;
  roleMappings?: AccountRoleMappingView[];
  accounts?: PostableAccountRecord[];
}): Promise<ResolvedPostingTemplatePreview> {
  const template = getPostingTemplateDefinition(params.candidateTemplateCode);

  if (!template) {
    throw new Error("Plantilla contable no soportada.");
  }

  const roleMappings = params.roleMappings
    ?? (
      params.supabase
        ? await listAccountRoleMappings(params.supabase, {
          organizationId: params.organizationId,
        })
        : []
    );
  const mappingAccountMap = buildMappingAccountMap(roleMappings);
  const accounts = params.accounts ?? roleMappings
    .map((mapping) => mapping.account)
    .filter((account): account is PostableAccountRecord => Boolean(account));
  const netAmount = asAmount(params.facts.netAmount);
  const vatAmount = asAmount(params.facts.vatAmount);
  const grossTotal = asAmount(params.facts.grossTotal, netAmount + vatAmount);
  const currencyCode = params.facts.currencyCode?.trim().toUpperCase() || "UYU";
  const roleResolutionMap = new Map<string, RoleResolution>();
  const blockers: PostingTemplateBlocker[] = [];
  const warnings: PostingTemplateWarning[] = [];

  function resolveRole(
    roleCode: AccountRoleCode,
    options: {
      accountRef: PostingTemplateLineAccountRef;
      required: boolean;
    },
  ) {
    const cacheKey =
      options.accountRef === "document_primary_account"
        ? "document_primary_account"
        : roleCode;
    const cached = roleResolutionMap.get(cacheKey);

    if (cached) {
      return cached;
    }

    let source: RoleResolution["source"] = "role_map";
    let account: PostableAccountRecord | null = null;

    if (options.accountRef === "document_primary_account") {
      account = findAccountByIdOrCode({
        accounts,
        accountId: params.facts.documentPrimaryAccountId,
        externalCode:
          params.facts.zetaConceptAccountExternalCode
          ?? params.facts.documentPrimaryExternalCode,
      });
      source = account ? "concept_zeta" : "role_map";
    }

    if (!account) {
      account = mappingAccountMap.get(roleCode) ?? null;
    }

    const resolution = createRoleResolution({
      roleCode,
      account,
      source,
    });

    roleResolutionMap.set(cacheKey, resolution);

    if (resolution.blocker && options.required) {
      blockers.push({
        code: resolution.blocker,
        message:
          resolution.source === "invalid"
            ? `La cuenta mapeada para ${roleCode} no es imputable.`
            : `Falta mapear la cuenta para ${roleCode}.`,
        accountRoleCode: roleCode,
      });
    }

    return resolution;
  }

  const lines = template.lines
    .map((line) => {
      const roleCode = lineAccountReferenceToRole({
        accountRef: line.accountRoleCode,
        template,
        facts: params.facts,
      });
      const amount = resolveAmount(line.amountSource, {
        netAmount,
        vatAmount,
        grossTotal,
      });
      const isZeroOptionalVat =
        line.accountRoleCode === "tax_role_by_rate"
        && !line.required
        && Math.abs(amount) < 0.005;

      if (isZeroOptionalVat) {
        return null;
      }

      const resolution = resolveRole(roleCode, {
        accountRef: line.accountRoleCode,
        required: line.required || Math.abs(amount) > 0.005,
      });

      return {
        lineKey: line.lineKey,
        debitCredit: line.debitCredit,
        accountRoleCode: roleCode,
        chartAccountId: resolution.chartAccountId,
        accountExternalCode: resolution.accountExternalCode,
        accountName: resolution.accountName,
        amount: roundCurrency(amount),
        currencyCode,
        literalTributario:
          resolution.chartAccountId
            ? accounts.find((account) => account.id === resolution.chartAccountId)?.literal_tributario ?? null
            : null,
        description: line.descriptionTemplate,
      } satisfies ResolvedPostingTemplateLine;
    })
    .filter((line): line is ResolvedPostingTemplateLine => Boolean(line));
  const totalDebit = roundCurrency(
    lines
      .filter((line) => line.debitCredit === "debit")
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const totalCredit = roundCurrency(
    lines
      .filter((line) => line.debitCredit === "credit")
      .reduce((sum, line) => sum + line.amount, 0),
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.01;

  if (!isBalanced) {
    blockers.push({
      code: "unbalanced_preview",
      message: "El preview de la plantilla no balancea.",
    });
  }

  if (template.createsOpenItem) {
    warnings.push({
      code: "creates_open_item",
      message: "Esta plantilla deja un saldo abierto para seguimiento.",
    });
  }

  const mode =
    blockers.length > 0
      ? "blocked"
      : warnings.length > 0
        ? "assisted"
        : "automatic";

  return {
    documentId: params.documentId,
    postingTemplateCode: template.code,
    postingTemplateVersion: template.version,
    operationKind: template.operationKind,
    operationFamily: template.operationFamily,
    paymentTerms: template.paymentTerms,
    zetaJournalTypeCode: null,
    zetaJournalTypeName: template.zetaJournalTypeNameHints[0] ?? null,
    lines,
    roleResolutions: [...roleResolutionMap.values()],
    blockers,
    warnings,
    createsOpenItem: template.createsOpenItem,
    isBalanced,
    mode,
  } satisfies ResolvedPostingTemplatePreview;
}
