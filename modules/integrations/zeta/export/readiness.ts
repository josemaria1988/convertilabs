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
    .select("config_json")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as ConnectionRow | null;
  const config = row?.config_json ?? {};

  return normalizeZetaPurchaseExpenseConfig(
    config.purchase_expense_export ?? config.zeta_purchase_expense_export,
  );
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
    config,
    contacts,
    supplierCommercialData,
    concepts,
    vatRates,
    paymentTerms,
    paymentMethods,
    currencies,
    businessLocations,
    cashboxes,
  ] = await Promise.all([
    loadConfig({ supabase, organizationId }),
    countRawRecords({ supabase, organizationId, entityType: "contact" }),
    countRawRecords({ supabase, organizationId, entityType: "supplier_commercial_data" }),
    countRawRecords({ supabase, organizationId, entityType: "concept" }),
    countRawRecords({ supabase, organizationId, entityType: "vat_rate" }),
    countRawRecords({ supabase, organizationId, entityType: "payment_term" }),
    countRawRecords({ supabase, organizationId, entityType: "payment_method" }),
    countRawRecords({ supabase, organizationId, entityType: "currency" }),
    countRawRecords({ supabase, organizationId, entityType: "business_location" }),
    countRawRecords({ supabase, organizationId, entityType: "cashbox" }),
  ]);
  const documentMappingsReady = Boolean(
    config.documentTypes?.purchase_expense_credit
    && config.documentTypes?.purchase_expense_cash
    && config.documentTypes?.supplier_credit_note_expense,
  );
  const paidByPartnerReady = Boolean(
    config.paidByPartnerPaymentMethodCode
    ?? config.paymentMethods?.paid_by_partner,
  );
  const localUserReady = Boolean(config.defaults?.localCode && config.defaults.userCode);
  const cashboxRelevant = Boolean(config.defaults?.cashboxCode);
  const items = [
    readinessItem({
      code: "expense_document_types",
      label: "Comprobantes de gastos mapeados",
      ready: documentMappingsReady,
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
      readyDetail: "Conceptos Zeta disponibles para CodigoArticulo en gastos.",
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
      ready: paymentTerms > 0,
      readyDetail: "Condiciones de pago Zeta disponibles.",
      pendingDetail: "Sincroniza condiciones de pago Zeta.",
    }),
    readinessItem({
      code: "payment_methods",
      label: "Formas de pago sincronizadas",
      ready: paymentMethods > 0,
      readyDetail: "Formas de pago Zeta disponibles.",
      pendingDetail: "Sincroniza formas de pago Zeta.",
    }),
    readinessItem({
      code: "partner_payment_method",
      label: "Forma de pago para reintegro a socio configurada",
      ready: paidByPartnerReady,
      readyDetail: "paid_by_partner tiene forma de pago Zeta especifica.",
      pendingDetail: "Falta mapping de forma de pago para compras pagadas por socio.",
    }),
    readinessItem({
      code: "currencies",
      label: "Monedas/cotizaciones listas",
      ready: currencies > 0,
      readyDetail: "Monedas Zeta sincronizadas; la cotizacion se valida por documento.",
      pendingDetail: "Sincroniza monedas Zeta.",
    }),
    readinessItem({
      code: "local_user",
      label: "Local/usuario default listo",
      ready: businessLocations > 0 && localUserReady,
      readyDetail: "Local y usuario default configurados para el movimiento.",
      pendingDetail: "Falta local/usuario default para envios a Zeta.",
    }),
    readinessItem({
      code: "cashboxes",
      label: "Cajas listas solo si aplican",
      ready: !cashboxRelevant || cashboxes > 0,
      readyDetail: cashboxRelevant
        ? "Caja default configurada y catalogo de cajas sincronizado."
        : "No hay caja default forzada para esta fase.",
      pendingDetail: "Hay caja default configurada pero no hay catalogo de cajas sincronizado.",
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

