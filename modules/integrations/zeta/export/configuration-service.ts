import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCurrencyCode, normalizeTextToken } from "@/modules/accounting";
import {
  integrationTables,
  recordIntegrationAuditEvent,
} from "@/modules/integrations/repository";
import {
  classifyZetaPaymentTerm,
  type ZetaPaymentTermKind,
} from "@/modules/integrations/zeta/export/payment-term-compatibility";
import { normalizeZetaPurchaseExpenseConfig } from "@/modules/integrations/zeta/export/purchase-expense-resolver";
import type {
  ZetaCatalogRow,
  ZetaOperationalMappingsConfig,
} from "@/modules/integrations/zeta/export/types";

type ConnectionRow = {
  id: string;
  mode: string;
  status: string;
  test_mode: boolean;
  last_connection_test_ok: boolean | null;
  config_json: Record<string, unknown> | null;
};

export type ZetaOperationalCatalogOption = {
  code: string;
  label: string;
  detail: string | null;
  paymentTermKind?: ZetaPaymentTermKind;
};

export type ZetaPurchaseExpenseConfiguration = {
  mode: string;
  writeEnabled: boolean;
  status: "pending" | "ready_to_enable" | "ready";
  configuredCount: number;
  requiredCount: number;
  current: {
    purchaseExpenseCreditDocumentCode: string;
    purchaseExpenseCashDocumentCode: string;
    supplierCreditNoteExpenseDocumentCode: string;
    defaultConceptCode: string;
    creditPaymentTermCode: string;
    cashPaymentTermCode: string;
    uyuCurrencyCode: string;
    localCode: string;
    userCode: string;
    cashboxCode: string;
    cashPaymentMethodCode: string;
    bankTransferPaymentMethodCode: string;
    cardPaymentMethodCode: string;
    checkPaymentMethodCode: string;
    paidByPartnerPaymentTermCode: string;
    paidByPartnerPaymentMethodCode: string;
  };
  catalogs: {
    creditDocumentTypes: ZetaOperationalCatalogOption[];
    cashDocumentTypes: ZetaOperationalCatalogOption[];
    creditNoteDocumentTypes: ZetaOperationalCatalogOption[];
    concepts: ZetaOperationalCatalogOption[];
    paymentTerms: ZetaOperationalCatalogOption[];
    paymentMethods: ZetaOperationalCatalogOption[];
    uyuCurrencies: ZetaOperationalCatalogOption[];
    businessLocations: ZetaOperationalCatalogOption[];
    users: ZetaOperationalCatalogOption[];
    cashboxes: ZetaOperationalCatalogOption[];
  };
};

export type SaveZetaPurchaseExpenseConfigurationInput = {
  organizationId: string;
  actorUserId: string | null;
  writeEnabled: boolean;
  purchaseExpenseCreditDocumentCode: string;
  purchaseExpenseCashDocumentCode: string;
  supplierCreditNoteExpenseDocumentCode: string;
  defaultConceptCode: string;
  creditPaymentTermCode: string;
  cashPaymentTermCode: string;
  uyuCurrencyCode: string;
  localCode: string;
  userCode: string;
  cashboxCode: string;
  cashPaymentMethodCode: string;
  bankTransferPaymentMethodCode?: string | null;
  cardPaymentMethodCode?: string | null;
  checkPaymentMethodCode?: string | null;
  paidByPartnerPaymentTermCode?: string | null;
  paidByPartnerPaymentMethodCode?: string | null;
};

type RawRowsByEntityType = Record<string, ZetaCatalogRow[]>;

const catalogEntityTypes = [
  "document_type",
  "concept",
  "payment_term",
  "payment_method",
  "currency",
  "business_location",
  "user_role",
  "cashbox",
] as const;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function rowCode(row: ZetaCatalogRow) {
  return firstText(row.Codigo, row.CodigoIVA, row.MonedaCodigo);
}

function isYes(value: unknown) {
  const normalized = normalizeTextToken(firstText(value));

  return normalized === "s" || normalized === "si" || normalized === "yes" || normalized === "true" || normalized === "1";
}

function isInactive(row: ZetaCatalogRow) {
  const value = firstText(
    row.Activo,
    row.ConceptoActivo,
    row.ContactoActivo,
    row.LocalActivo,
    row.CajaActiva,
  );
  const normalized = normalizeTextToken(value);

  return normalized === "n" || normalized === "no" || normalized === "false" || normalized === "0" || normalized === "inactivo";
}

function numericCode(value: string, label: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} debe tener un codigo numerico valido de Zeta.`);
  }

  return parsed;
}

function optionFromRow(row: ZetaCatalogRow): ZetaOperationalCatalogOption | null {
  const code = rowCode(row);

  if (!code) {
    return null;
  }

  const name = firstText(row.Nombre, row.UsuarioNombre, row.Descripcion) ?? "Sin nombre";
  const secondary = firstText(
    row.UsuarioNombre && row.Nombre !== row.UsuarioNombre ? row.UsuarioNombre : null,
    row.UsuarioEmail,
    row.LocalNombre,
    row.CodigoISO,
  );

  return {
    code,
    label: `${code} - ${name}`,
    detail: secondary,
  };
}

function sortOptions(rows: ZetaCatalogRow[]) {
  const options = rows
    .filter((row) => !isInactive(row))
    .map(optionFromRow)
    .filter((option): option is ZetaOperationalCatalogOption => Boolean(option));
  const uniqueOptions = [...new Map(options.map((option) => [option.code, option])).values()];

  return uniqueOptions.sort((left, right) => left.label.localeCompare(right.label, "es", {
    numeric: true,
    sensitivity: "base",
  }));
}

function selectValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function configuredValues(config: ZetaOperationalMappingsConfig) {
  return {
    purchaseExpenseCreditDocumentCode: selectValue(config.documentTypes?.purchase_expense_credit),
    purchaseExpenseCashDocumentCode: selectValue(config.documentTypes?.purchase_expense_cash),
    supplierCreditNoteExpenseDocumentCode: selectValue(config.documentTypes?.supplier_credit_note_expense),
    defaultConceptCode: selectValue(config.concepts?.default),
    creditPaymentTermCode: selectValue(config.paymentTerms?.credit),
    cashPaymentTermCode: selectValue(config.paymentTerms?.cash),
    uyuCurrencyCode: selectValue(config.currencies?.UYU ?? config.defaults?.currencyCode),
    localCode: selectValue(config.defaults?.localCode),
    userCode: selectValue(config.defaults?.userCode),
    cashboxCode: selectValue(config.defaults?.cashboxCode),
    cashPaymentMethodCode: selectValue(config.paymentMethods?.cash),
    bankTransferPaymentMethodCode: selectValue(config.paymentMethods?.bank_transfer),
    cardPaymentMethodCode: selectValue(config.paymentMethods?.card),
    checkPaymentMethodCode: selectValue(config.paymentMethods?.check),
    paidByPartnerPaymentTermCode: selectValue(config.paymentTerms?.paid_by_partner),
    paidByPartnerPaymentMethodCode: selectValue(
      config.paidByPartnerPaymentMethodCode ?? config.paymentMethods?.paid_by_partner,
    ),
  };
}

function buildConfiguration(input: {
  connection: ConnectionRow;
  rows: RawRowsByEntityType;
}): ZetaPurchaseExpenseConfiguration {
  const rootConfig = asRecord(input.connection.config_json);
  const config = normalizeZetaPurchaseExpenseConfig(
    rootConfig.purchase_expense_export ?? rootConfig.zeta_purchase_expense_export,
  );
  const current = configuredValues(config);
  const writeEnabled = input.connection.mode === "read_write";
  const documentTypes = input.rows.document_type ?? [];
  const expenseDocumentTypes = documentTypes.filter((row) => isYes(row.ComprobanteGastos));
  const catalogs = {
    creditDocumentTypes: sortOptions(expenseDocumentTypes.filter((row) => Number(row.Tipo) === 21)),
    cashDocumentTypes: sortOptions(expenseDocumentTypes.filter((row) => Number(row.Tipo) === 23)),
    creditNoteDocumentTypes: sortOptions(expenseDocumentTypes.filter((row) => Number(row.Tipo) === 22)),
    concepts: sortOptions(input.rows.concept ?? []),
    paymentTerms: sortOptions(input.rows.payment_term ?? []).map((option) => ({
      ...option,
      paymentTermKind: classifyZetaPaymentTerm({
        code: option.code,
        label: option.label,
        configuredCashCode: config.paymentTerms?.cash,
        configuredCreditCode: config.paymentTerms?.credit,
        configuredPaidByPartnerCode: config.paymentTerms?.paid_by_partner,
      }),
    })),
    paymentMethods: sortOptions(input.rows.payment_method ?? []),
    uyuCurrencies: sortOptions((input.rows.currency ?? []).filter((row) =>
      normalizeCurrencyCode(firstText(row.CodigoISO, row.ISO, row.Abreviacion)) === "UYU")),
    businessLocations: sortOptions(input.rows.business_location ?? []),
    users: sortOptions(input.rows.user_role ?? []),
    cashboxes: sortOptions(input.rows.cashbox ?? []),
  };
  const requiredSelections: Array<[string, ZetaOperationalCatalogOption[]]> = [
    [current.purchaseExpenseCreditDocumentCode, catalogs.creditDocumentTypes],
    [current.purchaseExpenseCashDocumentCode, catalogs.cashDocumentTypes],
    [current.supplierCreditNoteExpenseDocumentCode, catalogs.creditNoteDocumentTypes],
    [current.creditPaymentTermCode, catalogs.paymentTerms],
    [current.cashPaymentTermCode, catalogs.paymentTerms],
    [current.uyuCurrencyCode, catalogs.uyuCurrencies],
    [current.localCode, catalogs.businessLocations],
    [current.userCode, catalogs.users],
    [current.cashboxCode, catalogs.cashboxes],
    [current.cashPaymentMethodCode, catalogs.paymentMethods],
  ];
  const configuredCount = requiredSelections.filter(([value, options]) =>
    Boolean(value) && options.some((option) => option.code === value)).length;
  const requiredCount = requiredSelections.length;
  const configurationComplete = configuredCount === requiredCount;

  return {
    mode: input.connection.mode || "read_only",
    writeEnabled,
    status: configurationComplete
      ? writeEnabled ? "ready" : "ready_to_enable"
      : "pending",
    configuredCount,
    requiredCount,
    current,
    catalogs,
  };
}

async function loadConnection(
  supabase: SupabaseClient,
  organizationId: string,
  required = true,
) {
  const { data, error } = await supabase
    .from(integrationTables.connections)
    .select("id, mode, status, test_mode, last_connection_test_ok, config_json")
    .eq("organization_id", organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    if (!required) {
      return {
        id: "",
        mode: "read_only",
        status: "disconnected",
        test_mode: true,
        last_connection_test_ok: null,
        config_json: {},
      } satisfies ConnectionRow;
    }

    throw new Error("Guarda la conexion Zetasoftware antes de configurar exportaciones.");
  }

  return data as ConnectionRow;
}

async function loadRawRowsByEntityType(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const entries = await Promise.all(catalogEntityTypes.map(async (entityType) => [
    entityType,
    await loadRawRowsForEntityType(supabase, organizationId, entityType),
  ] as const));

  return Object.fromEntries(entries) as RawRowsByEntityType;
}

async function loadRawRowsForEntityType(
  supabase: SupabaseClient,
  organizationId: string,
  entityType: string,
) {
  const pageSize = 1000;
  const entries: Array<{ payload_json?: unknown }> = [];

  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const { data, error } = await supabase
      .from(integrationTables.rawRecords)
      .select("payload_json")
      .eq("organization_id", organizationId)
      .eq("provider", "zetasoftware")
      .eq("entity_type", entityType)
      .eq("test_mode", false)
      .order("external_key", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = (data as Array<{ payload_json?: unknown }> | null) ?? [];
    entries.push(...page);

    if (page.length < pageSize) {
      return entries
        .map((entry) => asRecord(asRecord(entry.payload_json).row))
        .filter((row) => Object.keys(row).length > 0);
    }
  }

  throw new Error(
    `El catalogo Zeta ${entityType} supera 20000 filas; se detuvo la configuracion por seguridad.`,
  );
}

export async function loadZetaPurchaseExpenseConceptOptions(
  supabase: SupabaseClient,
  organizationId: string,
) {
  return sortOptions(await loadRawRowsForEntityType(
    supabase,
    organizationId,
    "concept",
  ));
}

function requireCatalogCode(input: {
  rows: ZetaCatalogRow[];
  value: string;
  label: string;
  numeric?: boolean;
  predicate?: (row: ZetaCatalogRow) => boolean;
}) {
  const value = input.value.trim();

  if (!value) {
    throw new Error(`Selecciona ${input.label}.`);
  }

  const row = input.rows.find((candidate) => rowCode(candidate) === value);

  if (!row || isInactive(row) || (input.predicate && !input.predicate(row))) {
    throw new Error(`${input.label} no existe, esta inactivo o no cumple el contrato Zeta.`);
  }

  return input.numeric ? numericCode(value, input.label) : value;
}

function validateConfiguration(
  input: SaveZetaPurchaseExpenseConfigurationInput,
  rows: RawRowsByEntityType,
): ZetaOperationalMappingsConfig {
  const documentTypes = rows.document_type ?? [];
  const paymentTerms = rows.payment_term ?? [];
  const paymentMethods = rows.payment_method ?? [];
  const defaultConceptRaw = input.defaultConceptCode.trim();
  const expenseType = (basicType: number) => (row: ZetaCatalogRow) =>
    isYes(row.ComprobanteGastos) && Number(row.Tipo) === basicType;
  const paidByPartnerTermRaw = input.paidByPartnerPaymentTermCode?.trim() ?? "";
  const paidByPartnerRaw = input.paidByPartnerPaymentMethodCode?.trim() ?? "";
  const optionalPaymentMethod = (
    value: string | null | undefined,
    label: string,
  ) => {
    const normalized = value?.trim() ?? "";

    return normalized
      ? requireCatalogCode({
        rows: paymentMethods,
        value: normalized,
        label,
        numeric: true,
      })
      : null;
  };
  const bankTransfer = optionalPaymentMethod(
    input.bankTransferPaymentMethodCode,
    "la forma de pago por transferencia",
  );
  const card = optionalPaymentMethod(input.cardPaymentMethodCode, "la forma de pago con tarjeta");
  const check = optionalPaymentMethod(input.checkPaymentMethodCode, "la forma de pago con cheque");

  if (Boolean(paidByPartnerTermRaw) !== Boolean(paidByPartnerRaw)) {
    throw new Error(
      "Configura juntas la condicion y la forma de pago para compras pagadas por socio.",
    );
  }

  const paidByPartnerTerm = paidByPartnerTermRaw
    ? requireCatalogCode({
      rows: paymentTerms,
      value: paidByPartnerTermRaw,
      label: "la condicion de pago para reintegro a socio",
    })
    : null;
  const paidByPartner = paidByPartnerRaw
    ? requireCatalogCode({
      rows: paymentMethods,
      value: paidByPartnerRaw,
      label: "la forma de pago para reintegro a socio",
      numeric: true,
    })
    : null;

  return {
    documentTypes: {
      purchase_expense_credit: requireCatalogCode({
        rows: documentTypes,
        value: input.purchaseExpenseCreditDocumentCode,
        label: "el comprobante de gasto a credito",
        numeric: true,
        predicate: expenseType(21),
      }),
      purchase_expense_cash: requireCatalogCode({
        rows: documentTypes,
        value: input.purchaseExpenseCashDocumentCode,
        label: "el comprobante de gasto contado",
        numeric: true,
        predicate: expenseType(23),
      }),
      supplier_credit_note_expense: requireCatalogCode({
        rows: documentTypes,
        value: input.supplierCreditNoteExpenseDocumentCode,
        label: "la nota de credito de gasto",
        numeric: true,
        predicate: expenseType(22),
      }),
    },
    concepts: defaultConceptRaw
      ? {
        default: String(requireCatalogCode({
        rows: rows.concept ?? [],
        value: defaultConceptRaw,
        label: "el concepto de gasto por defecto",
        })),
      }
      : {},
    paymentTerms: {
      credit: requireCatalogCode({
        rows: paymentTerms,
        value: input.creditPaymentTermCode,
        label: "la condicion de pago a credito",
      }),
      cash: requireCatalogCode({
        rows: paymentTerms,
        value: input.cashPaymentTermCode,
        label: "la condicion de pago contado",
      }),
      ...(paidByPartnerTerm === null ? {} : { paid_by_partner: paidByPartnerTerm }),
    },
    paymentMethods: {
      cash: requireCatalogCode({
        rows: paymentMethods,
        value: input.cashPaymentMethodCode,
        label: "la forma de pago contado",
        numeric: true,
      }),
      ...(bankTransfer === null ? {} : { bank_transfer: bankTransfer }),
      ...(card === null ? {} : { card }),
      ...(check === null ? {} : { check }),
      ...(paidByPartner === null ? {} : { paid_by_partner: paidByPartner }),
    },
    currencies: {
      UYU: requireCatalogCode({
        rows: rows.currency ?? [],
        value: input.uyuCurrencyCode,
        label: "la moneda UYU",
        numeric: true,
        predicate: (row) => normalizeCurrencyCode(
          firstText(row.CodigoISO, row.ISO, row.Abreviacion),
        ) === "UYU",
      }),
    },
    defaults: {
      currencyCode: numericCode(input.uyuCurrencyCode, "La moneda UYU"),
      localCode: requireCatalogCode({
        rows: rows.business_location ?? [],
        value: input.localCode,
        label: "el local operativo",
        numeric: true,
      }) as number,
      userCode: requireCatalogCode({
        rows: rows.user_role ?? [],
        value: input.userCode,
        label: "el codigo de usuario operativo",
        numeric: true,
      }) as number,
      cashboxCode: requireCatalogCode({
        rows: rows.cashbox ?? [],
        value: input.cashboxCode,
        label: "la caja operativa",
        numeric: true,
      }) as number,
    },
    ...(paidByPartner === null ? {} : { paidByPartnerPaymentMethodCode: paidByPartner }),
  };
}

export async function loadZetaPurchaseExpenseConfiguration(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const [connection, rows] = await Promise.all([
    loadConnection(supabase, organizationId, false),
    loadRawRowsByEntityType(supabase, organizationId),
  ]);

  return buildConfiguration({ connection, rows });
}

export async function saveZetaPurchaseExpenseConfiguration(
  supabase: SupabaseClient,
  input: SaveZetaPurchaseExpenseConfigurationInput,
) {
  const [connection, rows] = await Promise.all([
    loadConnection(supabase, input.organizationId),
    loadRawRowsByEntityType(supabase, input.organizationId),
  ]);
  const previousRootConfig = asRecord(connection.config_json);
  const previousOperational = normalizeZetaPurchaseExpenseConfig(
    previousRootConfig.purchase_expense_export ?? previousRootConfig.zeta_purchase_expense_export,
  );
  const validated = validateConfiguration(input, rows);

  if (
    input.writeEnabled
    && (
      connection.test_mode
      || connection.status !== "connected"
      || connection.last_connection_test_ok !== true
    )
  ) {
    throw new Error(
      "Antes de habilitar envios reales, desactiva mock y completa una prueba de conexion Zeta exitosa.",
    );
  }
  const nextOperational: ZetaOperationalMappingsConfig = {
    ...previousOperational,
    ...validated,
    documentTypes: {
      ...previousOperational.documentTypes,
      ...validated.documentTypes,
    },
    concepts: {
      ...previousOperational.concepts,
      ...validated.concepts,
    },
    paymentTerms: {
      ...previousOperational.paymentTerms,
      ...validated.paymentTerms,
    },
    paymentMethods: {
      ...previousOperational.paymentMethods,
      ...validated.paymentMethods,
    },
    currencies: {
      ...previousOperational.currencies,
      ...validated.currencies,
    },
    defaults: {
      ...previousOperational.defaults,
      ...validated.defaults,
    },
  };

  if (!validated.paidByPartnerPaymentMethodCode) {
    delete nextOperational.paidByPartnerPaymentMethodCode;
    if (nextOperational.paymentMethods) {
      delete nextOperational.paymentMethods.paid_by_partner;
    }
    if (nextOperational.paymentTerms) {
      delete nextOperational.paymentTerms.paid_by_partner;
    }
  }

  const optionalMethodInputs = {
    bank_transfer: input.bankTransferPaymentMethodCode,
    card: input.cardPaymentMethodCode,
    check: input.checkPaymentMethodCode,
  } as const;

  for (const [method, value] of Object.entries(optionalMethodInputs)) {
    if (!value?.trim() && nextOperational.paymentMethods) {
      delete nextOperational.paymentMethods[
        method as "bank_transfer" | "card" | "check"
      ];
    }
  }

  if (!input.defaultConceptCode.trim() && nextOperational.concepts) {
    delete nextOperational.concepts.default;
  }

  const nextMode = input.writeEnabled ? "read_write" : "read_only";
  const nextRootConfig = {
    ...previousRootConfig,
    purchase_expense_export: nextOperational,
  };
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from(integrationTables.connections)
    .update({
      mode: nextMode,
      config_json: nextRootConfig,
      updated_by: input.actorUserId,
      updated_at: updatedAt,
    })
    .eq("id", connection.id)
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware");

  if (error) {
    throw new Error(error.message);
  }

  await recordIntegrationAuditEvent(supabase, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    entityType: "organization_integration_connection",
    entityId: connection.id,
    action: "zeta_purchase_expense_configuration_saved",
    beforeJson: {
      mode: connection.mode,
      purchase_expense_export: previousOperational,
    },
    afterJson: {
      mode: nextMode,
      purchase_expense_export: nextOperational,
    },
    metadata: {
      provider: "zetasoftware",
      write_enabled: input.writeEnabled,
      source: "settings_integrations",
    },
  });

  return buildConfiguration({
    connection: {
      ...connection,
      mode: nextMode,
      config_json: nextRootConfig,
    },
    rows,
  });
}
