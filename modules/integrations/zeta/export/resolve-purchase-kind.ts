import { normalizeTextToken } from "@/modules/accounting";
import type { ZetaCatalogRow, ZetaPurchaseKind } from "@/modules/integrations/zeta/export/types";

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

function isYes(value: unknown) {
  const normalized = normalizeTextToken(firstText(value));

  return normalized === "s" || normalized === "si" || normalized === "yes" || normalized === "true";
}

function isNo(value: unknown) {
  const normalized = normalizeTextToken(firstText(value));

  return normalized === "n" || normalized === "no" || normalized === "false";
}

function hasAnyToken(value: string | null | undefined, tokens: string[]) {
  const normalized = normalizeTextToken(value);

  return Boolean(normalized && tokens.some((token) => normalized.includes(token)));
}

export function resolveZetaPurchaseKind(input: {
  selectedTemplateCode?: string | null;
  operationCategory?: string | null;
  comprobante?: ZetaCatalogRow | null;
  manualPurchaseKind?: ZetaPurchaseKind | null;
  cfeSignals?: string[] | null;
}): ZetaPurchaseKind {
  if (
    input.manualPurchaseKind === "expense"
    || input.manualPurchaseKind === "merchandise"
    || input.manualPurchaseKind === "unknown"
  ) {
    return input.manualPurchaseKind;
  }

  if (
    hasAnyToken(input.selectedTemplateCode, ["purchase_inventory"])
    || hasAnyToken(input.operationCategory, ["goods_resale", "stock", "inventario", "mercaderia", "mercaderias"])
  ) {
    return "merchandise";
  }

  const comprobanteGastos = firstText(
    input.comprobante?.ComprobanteGastos,
    input.comprobante?.EsGasto,
  );

  if (isYes(comprobanteGastos)) {
    return "expense";
  }

  if (
    isNo(comprobanteGastos)
    && (
      isYes(input.comprobante?.TomarParaActualizarCostos)
      || firstText(input.comprobante?.DepositoOrigenCodigo)
      || firstText(input.comprobante?.DepositoDestinoCodigo)
    )
  ) {
    return "merchandise";
  }

  if (hasAnyToken(input.selectedTemplateCode, ["purchase_expense"])) {
    return "expense";
  }

  if (hasAnyToken(input.operationCategory, [
    "admin_expense",
    "expense",
    "services",
    "transport",
    "fuel",
    "professional_fees",
    "rent",
    "gasto",
    "servicio",
  ])) {
    return "expense";
  }

  const signalText = (input.cfeSignals ?? []).join(" ");

  if (hasAnyToken(signalText, ["mercaderia", "stock", "inventario", "reventa"])) {
    return "merchandise";
  }

  if (hasAnyToken(signalText, ["servicio", "gasto", "honorario", "alquiler", "combustible"])) {
    return "expense";
  }

  return "unknown";
}
