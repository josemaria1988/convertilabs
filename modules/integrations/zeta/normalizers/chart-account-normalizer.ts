import type {
  ZetaChartAccountCandidate,
  ZetaChartAccountRaw,
} from "@/modules/integrations/zeta/contracts/plan-de-cuentas";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isYes(value: unknown) {
  return asString(value).trim().toUpperCase() === "S";
}

function optionalParentCode(rawParentCode: unknown, rawCode: unknown) {
  const parentCode = asString(rawParentCode).trim();
  const ownCode = asString(rawCode).trim();

  if (!parentCode || parentCode === ownCode) {
    return null;
  }

  return parentCode;
}

export function normalizeZetaChartAccount(
  raw: ZetaChartAccountRaw,
): ZetaChartAccountCandidate {
  const externalCode = asString(raw.Codigo).trim();
  const literal = asNumber(raw.LiteralTributario);

  return {
    external_code: externalCode,
    name: asString(raw.Nombre).trim(),
    display_code_name: asString(raw.CodigoNombre).trim() || `${externalCode} ${asString(raw.Nombre).trim()}`.trim(),
    is_imputable: isYes(raw.EsImputable),
    external_parent_code: optionalParentCode(raw.CuentaPadre, raw.Codigo),
    account_level: asNumber(raw.Nivel),
    literal_tributario: literal === 0 ? null : literal,
    uses_cost_centers: isYes(raw.UsaCentroCostos),
    provider_meta: {
      capitulo: asString(raw.Capitulo).trim(),
      grupo_codigo: asString(raw.GrupoCodigo).trim(),
      grupo_nombre: asString(raw.GrupoNombre).trim(),
      codigo_presentacion: asString(raw.CodigoPresentacion).trim(),
      moneda_codigo: asNumber(raw.MonedaCodigo) || null,
      moneda_simbolo: asString(raw.MonedaSimbolo).trim(),
      moneda_nombre: asString(raw.MonedaNombre).trim(),
      moneda_abreviacion: asString(raw.MonedaAbreviacion).trim(),
      calcula_dif_cambio: isYes(raw.CalculaDifCambio),
      notas: asString(raw.Notas).trim(),
    },
  };
}
