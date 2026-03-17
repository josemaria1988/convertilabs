import "server-only";

import { formatPostingTemplateCodeLabel } from "@/modules/presentation/labels";
import type { PostingTemplateCode } from "@/modules/accounting/types";
import type { ChartMapEventDefinition } from "@/modules/accounting/chart-map/types";

const chartMapEvents: ChartMapEventDefinition[] = [
  {
    id: "sale_local_cash",
    label: formatPostingTemplateCodeLabel("sale_local_cash"),
    description: "Venta local cobrada en el momento con contrapartida inmediata.",
    documentRole: "sale",
    tags: ["venta", "contado", "local"],
  },
  {
    id: "sale_local_credit",
    label: formatPostingTemplateCodeLabel("sale_local_credit"),
    description: "Venta local a credito con saldo pendiente de cobranza.",
    documentRole: "sale",
    tags: ["venta", "credito", "local"],
  },
  {
    id: "purchase_local_cash",
    label: formatPostingTemplateCodeLabel("purchase_local_cash"),
    description: "Compra local cancelada en el momento.",
    documentRole: "purchase",
    tags: ["compra", "contado", "local"],
  },
  {
    id: "purchase_local_credit",
    label: formatPostingTemplateCodeLabel("purchase_local_credit"),
    description: "Compra local con saldo pendiente a proveedor.",
    documentRole: "purchase",
    tags: ["compra", "credito", "local"],
  },
  {
    id: "customer_collection",
    label: formatPostingTemplateCodeLabel("customer_collection"),
    description: "Cobranza posterior de cliente sobre saldo abierto.",
    documentRole: "other",
    tags: ["tesoreria", "clientes", "cobranza"],
  },
  {
    id: "supplier_payment",
    label: formatPostingTemplateCodeLabel("supplier_payment"),
    description: "Pago posterior a proveedor sobre saldo abierto.",
    documentRole: "other",
    tags: ["tesoreria", "proveedores", "pago"],
  },
  {
    id: "sale_cash_unknown_clearing",
    label: formatPostingTemplateCodeLabel("sale_cash_unknown_clearing"),
    description: "Venta contado con medio de cobro real aun no resuelto.",
    documentRole: "sale",
    tags: ["venta", "contado", "clearing"],
  },
  {
    id: "purchase_cash_unknown_clearing",
    label: formatPostingTemplateCodeLabel("purchase_cash_unknown_clearing"),
    description: "Compra contado con medio de pago real aun no resuelto.",
    documentRole: "purchase",
    tags: ["compra", "contado", "clearing"],
  },
  {
    id: "card_sale_clearing",
    label: formatPostingTemplateCodeLabel("card_sale_clearing"),
    description: "Venta con tarjeta pendiente de liquidacion posterior.",
    documentRole: "sale",
    tags: ["venta", "tarjeta", "clearing"],
  },
  {
    id: "card_settlement",
    label: formatPostingTemplateCodeLabel("card_settlement"),
    description: "Liquidacion de tarjeta contra cuenta bancaria o clearing.",
    documentRole: "other",
    tags: ["tesoreria", "tarjeta", "liquidacion"],
  },
  {
    id: "sale_export_cash",
    label: formatPostingTemplateCodeLabel("sale_export_cash"),
    description: "Venta de exportacion cobrada al contado.",
    documentRole: "sale",
    tags: ["venta", "exportacion", "contado"],
  },
  {
    id: "sale_export_credit",
    label: formatPostingTemplateCodeLabel("sale_export_credit"),
    description: "Venta de exportacion con saldo pendiente de cobranza.",
    documentRole: "sale",
    tags: ["venta", "exportacion", "credito"],
  },
];

export function listChartMapEvents() {
  return chartMapEvents;
}

export function findChartMapEvent(eventId: string | null | undefined) {
  return chartMapEvents.find((event) => event.id === eventId) ?? null;
}

export function pickDefaultChartMapEvent(
  eventIdsWithRules: Set<PostingTemplateCode>,
) {
  return chartMapEvents.find((event) => eventIdsWithRules.has(event.id))
    ?? chartMapEvents[0]
    ?? null;
}
