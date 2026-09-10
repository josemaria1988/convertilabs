import type { ReportRow } from "../cache/report-contracts";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const HUNDRED = BigInt(100);
const OUTPUT_SCALE = BigInt(100000);
type Decimal = { numerator: bigint; denominator: bigint };

function invalid(message: string): never { throw new Error(`Precios de Zeta: ${message}`); }

/** Preserve identifiers as received; numeric conversion would destroy leading zeroes. */
export function exactPriceCode(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || value !== value.trim() || value.length > 150 || /[\u0000-\u001f]/.test(value)) {
    invalid(`${label} debe conservar un codigo de texto exacto.`);
  }
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) invalid(`${label} debe ser un entero positivo.`);
  return value;
}

/** Decimal arithmetic never uses binary floating point, including intermediate percentages. */
function decimal(value: unknown, label: string): Decimal {
  if (typeof value !== "string" && typeof value !== "number") invalid(`${label} no tiene un importe decimal valido.`);
  if (typeof value === "number" && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    invalid(`${label} no tiene un importe decimal seguro.`);
  }
  const text = String(value);
  if (!/^-?\d{1,18}(?:\.\d{1,12})?$/.test(text)) invalid(`${label} no tiene un importe decimal valido.`);
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const numerator = BigInt(whole + fraction) * (text.startsWith("-") ? -ONE : ONE);
  return { numerator, denominator: BigInt(10) ** BigInt(fraction.length) };
}

function nonNegativeDecimal(value: unknown, label: string) {
  const result = decimal(value, label);
  if (result.numerator < ZERO) invalid(`${label} no puede ser negativo.`);
  return result;
}

function percentageFactor(value: unknown, label: string): Decimal {
  const result = decimal(value, label);
  const denominator = result.denominator * HUNDRED;
  const numerator = denominator + result.numerator;
  if (numerator < ZERO) invalid(`${label} no puede ser menor que -100%.`);
  return { numerator, denominator };
}

function roundedPrice(value: Decimal, factors: Decimal[]) {
  let numerator = value.numerator * OUTPUT_SCALE;
  let denominator = value.denominator;
  for (const factor of factors) {
    numerator *= factor.numerator;
    denominator *= factor.denominator;
  }
  const rounded = numerator / denominator + ((numerator % denominator) * BigInt(2) >= denominator ? ONE : ZERO);
  const whole = (rounded / OUTPUT_SCALE).toString();
  if (whole.length > 18) invalid("el precio calculado supera el rango decimal admitido.");
  return `${whole}.${(rounded % OUTPUT_SCALE).toString().padStart(5, "0")}`;
}

export function validateSalesPriceLists(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 20) invalid("salesPriceLists admite hasta 20 codigos positivos unicos.");
  const codes = value.map((code) => positiveInteger(code, "salesPriceLists"));
  if (new Set(codes).size !== codes.length) invalid("salesPriceLists no admite codigos repetidos.");
  return codes;
}

export function indexPriceArticles(rows: ReportRow[]): Map<string, ReportRow> {
  const articles = new Map<string, ReportRow>();
  for (const row of rows) {
    const code = exactPriceCode(row.Codigo, "Codigo de articulo");
    if (articles.has(code)) invalid(`el articulo ${code} aparece mas de una vez en la copia.`);
    articles.set(code, row);
  }
  return articles;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function selectSalesPriceRules(rows: ReportRow[], requested: number[], asOfDay: string): ReportRow[] {
  validateSalesPriceLists(requested);
  if (!validDate(asOfDay)) invalid("la fecha de vigencia no es valida.");
  const found = new Map<number, ReportRow>();
  for (const row of rows) {
    const code = positiveInteger(row.Codigo, "Codigo de precio de venta");
    if (found.has(code)) invalid(`la regla de venta ${code} esta repetida.`);
    found.set(code, row);
  }
  return requested.map((code) => {
    const row = found.get(code);
    if (!row) invalid(`falta la regla de venta ${code}.`);
    exactPriceCode(row.PrecioBaseCodigo, `PrecioBaseCodigo de la regla ${code}`);
    if (typeof row.Nombre !== "string" || !row.Nombre.trim()) invalid(`falta el nombre de la regla ${code}.`);
    percentageFactor(row.Porcentaje, `Porcentaje de la regla ${code}`);
    if (row.SumarUtilidadArticulo !== "S" && row.SumarUtilidadArticulo !== "N") invalid(`la regla ${code} no confirma si suma utilidad.`);
    // GeneXus represents a configured date without expiry as 0000-00-00.
    const expiry = row.VigenciaHasta;
    if (expiry !== "" && expiry !== "0000-00-00" && (typeof expiry !== "string" || !validDate(expiry))) {
      invalid(`la regla ${code} no tiene una vigencia valida.`);
    }
    if (typeof expiry === "string" && expiry !== "" && expiry !== "0000-00-00" && expiry < asOfDay) {
      invalid(`la regla de venta ${code} vencio el ${expiry}.`);
    }
    return row;
  });
}

export function validateBasePriceRows(rows: ReportRow[], input: {
  priceBaseCode: string; articleCode?: string; articles?: Map<string, ReportRow>;
}) {
  const baseCode = exactPriceCode(input.priceBaseCode, "PrecioBaseCodigo solicitado");
  const keys = new Set<string>();
  for (const row of rows) {
    const article = exactPriceCode(row.CodigoArticulo, "CodigoArticulo del precio");
    const base = exactPriceCode(row.CodigoPrecio, "CodigoPrecio del precio");
    const currency = positiveInteger(row.CodigoMoneda, "CodigoMoneda del precio");
    if (base !== baseCode || (input.articleCode !== undefined && article !== input.articleCode)) {
      invalid("la respuesta contiene un articulo o precio base fuera del filtro solicitado.");
    }
    if (input.articles && !input.articles.has(article)) invalid(`el articulo ${article} no existe en la copia actual de articulos.`);
    const key = JSON.stringify([article, base, currency]);
    if (keys.has(key)) invalid(`el precio ${article}/${base}/${currency} esta repetido.`);
    keys.add(key);
    const net = nonNegativeDecimal(row.PrecioSinIVA, "PrecioSinIVA");
    const gross = nonNegativeDecimal(row.PrecioConIVA, "PrecioConIVA");
    if (gross.numerator * net.denominator < net.numerator * gross.denominator) invalid("el precio con IVA es menor al precio sin IVA.");
  }
}

/** Generic list prices only: no customer, payment-term, promotion or currency conversion. */
export function calculateGenericSalesPrices(input: {
  baseRows: ReportRow[]; rule: ReportRow; articles: Map<string, ReportRow>; asOfDay: string;
}): ReportRow[] {
  const [rule] = selectSalesPriceRules([input.rule], [positiveInteger(input.rule.Codigo, "Codigo de regla")], input.asOfDay);
  const baseCode = exactPriceCode(rule.PrecioBaseCodigo, "PrecioBaseCodigo");
  validateBasePriceRows(input.baseRows, { priceBaseCode: baseCode, articles: input.articles });
  const ruleFactor = percentageFactor(rule.Porcentaje, "Porcentaje de venta");
  return input.baseRows.map((base) => {
    const article = input.articles.get(base.CodigoArticulo as string)!;
    const utility = rule.SumarUtilidadArticulo === "S"
      ? percentageFactor(article.PorcentajeUtilidadCosto, `Utilidad del articulo ${base.CodigoArticulo}`)
      : { numerator: ONE, denominator: ONE };
    const factors = [utility, ruleFactor];
    return {
      CodigoArticulo: base.CodigoArticulo, CodigoMoneda: base.CodigoMoneda, CodigoPrecioVenta: rule.Codigo,
      PrecioBaseCodigo: baseCode,
      PrecioSinIVA: roundedPrice(nonNegativeDecimal(base.PrecioSinIVA, "PrecioSinIVA"), factors),
      PrecioConIVA: roundedPrice(nonNegativeDecimal(base.PrecioConIVA, "PrecioConIVA"), factors),
      _source: {
        calculation: "base_times_article_utility_times_rule", scope: "generic_without_customer_or_payment_terms",
        rounding: "half_up_5_decimals", baseEndpoint: "RESTPreciosArticulosV2ObtenerPrecioBase",
        ruleEndpoint: "RESTPreciosVentaV1Query", priceBase: base, salesRule: rule,
        article: { Codigo: article.Codigo, Nombre: article.Nombre ?? null, PorcentajeUtilidadCosto: article.PorcentajeUtilidadCosto ?? null },
      },
    };
  });
}
