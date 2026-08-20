import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { integrationTables } from "@/modules/integrations/repository";
import { normalizeZetaPurchaseExpenseConfig } from "@/modules/integrations/zeta/export/purchase-expense-resolver";

export type ZetaPurchaseExpenseReadinessItem = {
  code: string;
  label: string;
  ready: boolean;
  detail: string;
};

export type ZetaPurchaseExpenseExportReadiness = {
  status: "ready" | "pending";
  readyCount: number;
  totalCount: number;
  items: ZetaPurchaseExpenseReadinessItem[];
  merchandiseStatus: "pending";
  merchandiseDetail: string;
};

type ConnectionRow = {
  config_json: Record<string, unknown> | null;
  mode: string;
  test_mode: boolean;
};

async function countRawRecords(input: {
  supabase: SupabaseClient;
  organizationId: string;
  entityType: string;
}) {
  const { data, error } = await input.supabase
    .from(integrationTables.rawRecords)
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("entity_type", input.entityType)
    .eq("test_mode", false)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown[] | null) ?? []).length;
}

async function loadConfig(input: {
  supabase: SupabaseClient;
  organizationId: string;
}) {
  const { data, error } = await input.supabase
    .from(integrationTables.connections)
    .select("config_json, mode, test_mode")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as ConnectionRow | null;
  const config = row?.config_json ?? {};

  return {
    operational: normalizeZetaPurchaseExpenseConfig(
      config.purchase_expense_export ?? config.zeta_purchase_expense_export,
    ),
    writeEnabled: row?.mode === "read_write" && row.test_mode !== true,
  };
}

function readinessItem(input: {
  code: string;
  label: string;
  ready: boolean;
  readyDetail: string;
  pendingDetail: string;
}) {
  return {
    code: input.code,
    label: input.label,
    ready: input.ready,
    detail: input.ready ? input.readyDetail : input.pendingDetail,
  } satisfies ZetaPurchaseExpenseReadinessItem;
}

export async function loadZetaPurchaseExpenseExportReadiness(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ZetaPurchaseExpenseExportReadiness> {
  const [
    connectionConfig,
    contacts,
    supplierCommercialData,
    documentTypes,
    concepts,
    vatRates,
    paymentTerms,
    paymentMethods,
    currencies,
    businessLocations,
    userRoles,
    cashboxes,
  ] = await Promise.all([
    loadConfig({ supabase, organizationId }),
    countRawRecords({ supabase, organizationId, entityType: "contact" }),
    countRawRecords({ supabase, organizationId, entityType: "supplier_commercial_data" }),
    countRawRecords({ supabase, organizationId, entityType: "document_type" }),
    countRawRecords({ supabase, organizationId, entityType: "concept" }),
    countRawRecords({ supabase, organizationId, entityType: "vat_rate" }),
    countRawRecords({ supabase, organizationId, entityType: "payment_term" }),
    countRawRecords({ supabase, organizationId, entityType: "payment_method" }),
    countRawRecords({ supabase, organizationId, entityType: "currency" }),
    countRawRecords({ supabase, organizationId, entityType: "business_location" }),
    countRawRecords({ supabase, organizationId, entityType: "user_role" }),
    countRawRecords({ supabase, organizationId, entityType: "cashbox" }),
  ]);
  const config = connectionConfig.operational;
  const documentMappingsReady = Boolean(
    config.documentTypes?.purchase_expense_credit
    && config.documentTypes?.purchase_expense_cash
    && config.documentTypes?.supplier_credit_note_expense,
  );
  const localUserReady = Boolean(config.defaults?.localCode && config.defaults.userCode);
  const paymentTermsReady = Boolean(config.paymentTerms?.credit && config.paymentTerms?.cash);
  const cashPaymentMethodReady = Boolean(config.paymentMethods?.cash);
  const uyuCurrencyReady = Boolean(config.currencies?.UYU ?? config.defaults?.currencyCode);
  const cashboxReady = Boolean(config.defaults?.cashboxCode);
  const items = [
    readinessItem({
      code: "write_mode",
      label: "Escritura real habilitada",
      ready: connectionConfig.writeEnabled,
      readyDetail: "La conexion permite el alta controlada de facturas de gasto.",
      pendingDetail: "La escritura sigue apagada o la conexion esta en modo mock.",
    }),
    readinessItem({
      code: "expense_document_types",
      label: "Comprobantes de gastos mapeados",
      ready: documentTypes > 0 && documentMappingsReady,
      readyDetail: "Compra credito, compra contado y nota correctiva de gasto tienen codigo Zeta.",
      pendingDetail: "Falta mapping operativo de comprobantes de gasto.",
    }),
    readinessItem({
      code: "suppliers",
      label: "Proveedores sincronizados",
      ready: contacts > 0 && supplierCommercialData > 0,
      readyDetail: "Contactos/proveedores Zeta disponibles para resolver CodigoProveedor.",
      pendingDetail: "Sincroniza contactos y proveedores Zeta antes de exportar.",
    }),
    readinessItem({
      code: "concepts",
      label: "Conceptos sincronizados",
      ready: concepts > 0,
      readyDetail: "Catalogo disponible; cada factura exige confirmar su concepto Zeta.",
      pendingDetail: "Sincroniza conceptos Zeta.",
    }),
    readinessItem({
      code: "vat_rates",
      label: "Tasas IVA sincronizadas",
      ready: vatRates > 0,
      readyDetail: "Tasas IVA Zeta disponibles para resolver CodigoIVA deterministico.",
      pendingDetail: "Sincroniza tasas de IVA Zeta.",
    }),
    readinessItem({
      code: "payment_terms",
      label: "Condiciones de pago sincronizadas",
      ready: paymentTerms > 0 && paymentTermsReady,
      readyDetail: "Condiciones de credito y contado configuradas.",
      pendingDetail: paymentTerms > 0
        ? "Selecciona las condiciones de credito y contado."
        : "Sincroniza condiciones de pago Zeta.",
    }),
    readinessItem({
      code: "payment_methods",
      label: "Formas de pago sincronizadas",
      ready: paymentMethods > 0 && cashPaymentMethodReady,
      readyDetail: "Forma de pago contado configurada.",
      pendingDetail: paymentMethods > 0
        ? "Selecciona la forma de pago contado."
        : "Sincroniza formas de pago Zeta.",
    }),
    readinessItem({
      code: "currencies",
      label: "Monedas/cotizaciones listas",
      ready: currencies > 0 && uyuCurrencyReady,
      readyDetail: "UYU esta mapeada; la cotizacion se valida por documento.",
      pendingDetail: currencies > 0
        ? "Selecciona el codigo Zeta de UYU."
        : "Sincroniza monedas Zeta.",
    }),
    readinessItem({
      code: "local_user",
      label: "Local/usuario default listo",
      ready: businessLocations > 0 && userRoles > 0 && localUserReady,
      readyDetail: "Local y usuario default configurados para el movimiento.",
      pendingDetail: "Falta local/usuario default para envios a Zeta.",
    }),
    readinessItem({
      code: "cashboxes",
      label: "Caja operativa lista",
      ready: cashboxes > 0 && cashboxReady,
      readyDetail: "Caja default configurada y catalogo de cajas sincronizado.",
      pendingDetail: cashboxes > 0
        ? "Selecciona la caja operativa requerida por Zeta."
        : "Sincroniza el catalogo de cajas Zeta.",
    }),
  ];
  const readyCount = items.filter((item) => item.ready).length;

  return {
    status: readyCount === items.length ? "ready" : "pending",
    readyCount,
    totalCount: items.length,
    items,
    merchandiseStatus: "pending",
    merchandiseDetail: "Pendiente: requiere sincronizacion y resolucion de articulos.",
  };
}

