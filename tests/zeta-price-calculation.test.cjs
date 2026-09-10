/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");
const { calculateGenericSalesPrices, indexPriceArticles, selectSalesPriceRules, validateBasePriceRows, validateSalesPriceLists } = require("@/modules/integrations/zeta/sync/price-calculation");

const day = "2026-09-10";
const rule = { Codigo: 1, Nombre: "Publico", PrecioBaseCodigo: "LP", Porcentaje: "20.00", SumarUtilidadArticulo: "S", VigenciaHasta: "0000-00-00" };
const article = { Codigo: "000104", Nombre: "Abrazadera", PorcentajeUtilidadCosto: "5.00", MonedaCodigo: 1 };
const base = { CodigoArticulo: "000104", CodigoPrecio: "LP", CodigoMoneda: 2, PrecioSinIVA: "100.00000", PrecioConIVA: "122.00000" };
function calculate(overrides = {}) {
  return calculateGenericSalesPrices({ baseRows: [base], rule, articles: indexPriceArticles([article]), asOfDay: day, ...overrides });
}

test("Sale prices apply the documented sequential utility and rule percentages, preserving raw evidence and actual price currency", () => {
  const [price] = calculate();
  assert.equal(price.PrecioSinIVA, "126.00000");
  assert.equal(price.PrecioConIVA, "153.72000");
  assert.equal(price.CodigoArticulo, "000104");
  assert.equal(price.CodigoMoneda, 2, "never substitute article cost currency");
  assert.equal(price.CodigoPrecioVenta, 1);
  assert.deepEqual(price._source.priceBase, base);
  assert.deepEqual(price._source.salesRule, rule);
  assert.equal(price._source.scope, "generic_without_customer_or_payment_terms");
});

test("Sale-price decimal rounding uses exact intermediate arithmetic and five-place half-up output", () => {
  const [price] = calculate({
    baseRows: [{ ...base, PrecioSinIVA: "0.00001", PrecioConIVA: "0.00001" }],
    rule: { ...rule, Porcentaje: "50", SumarUtilidadArticulo: "N" },
  });
  assert.equal(price.PrecioSinIVA, "0.00002");
  const [large] = calculate({
    baseRows: [{ ...base, PrecioSinIVA: "999999999999.99999", PrecioConIVA: "999999999999.99999" }],
    rule: { ...rule, Porcentaje: "0", SumarUtilidadArticulo: "N" },
  });
  assert.equal(large.PrecioSinIVA, "999999999999.99999");
});

test("Absent source prices remain absent and do not produce zero-valued article rows", () => {
  assert.deepEqual(calculate({ baseRows: [] }), []);
});

test("Multiple currencies are distinct identities but duplicate article/base/currency is rejected", () => {
  assert.equal(calculate({ baseRows: [base, { ...base, CodigoMoneda: 1 }] }).length, 2);
  assert.throws(() => calculate({ baseRows: [base, { ...base }] }), /repetido/);
});

test("Sale-price calculation never guesses the base, article identity or utility flag", () => {
  assert.throws(() => calculate({ baseRows: [{ ...base, CodigoPrecio: "000" }] }), /fuera del filtro/);
  assert.throws(() => calculate({ baseRows: [{ ...base, CodigoArticulo: "104" }] }), /no existe/);
  assert.throws(() => calculate({ rule: { ...rule, SumarUtilidadArticulo: "" } }), /confirma si suma/);
  assert.throws(() => calculate({ articles: indexPriceArticles([{ Codigo: article.Codigo }]) }), /Utilidad/);
  assert.equal(calculate({ rule: { ...rule, SumarUtilidadArticulo: "N" }, articles: indexPriceArticles([{ Codigo: article.Codigo }]) })[0].PrecioSinIVA, "120.00000");
});

test("Source decimals reject missing, whitespace, locale, exponential, nonfinite and negative amounts", () => {
  for (const value of [undefined, null, "", " 1", "1,5", "1e3", Infinity, NaN, true, "-1"])
    assert.throws(() => calculate({ baseRows: [{ ...base, PrecioSinIVA: value }] }), /decimal|negativo/);
  assert.throws(() => calculate({ baseRows: [{ ...base, PrecioConIVA: "99" }] }), /menor/);
  assert.throws(() => calculate({ rule: { ...rule, Porcentaje: "-101" } }), /-100/);
  assert.throws(() => calculate({ rule: { ...rule, Porcentaje: null } }), /decimal/);
});

test("Price identity requires exact text and source currency as a positive integer", () => {
  for (const value of [undefined, 0, -1, 1.2, "2"])
    assert.throws(() => calculate({ baseRows: [{ ...base, CodigoMoneda: value }] }), /CodigoMoneda/);
  assert.throws(() => calculate({ baseRows: [{ ...base, CodigoArticulo: 104 }] }), /texto exacto/);
  assert.throws(() => validateBasePriceRows([base], { priceBaseCode: "LP", articleCode: "000105" }), /fuera del filtro/);
  assert.throws(() => indexPriceArticles([article, { ...article }]), /mas de una vez/);
});

test("Selected rules require unique real codes, valid expiry, a source base and valid calculation settings", () => {
  assert.deepEqual(validateSalesPriceLists([1, 2]), [1, 2]);
  for (const input of [[1, 1], [0], ["1"], Array.from({ length: 21 }, (_, i) => i + 1)])
    assert.throws(() => validateSalesPriceLists(input));
  assert.throws(() => selectSalesPriceRules([], [1], day), /falta la regla/);
  assert.throws(() => selectSalesPriceRules([rule, rule], [1], day), /repetida/);
  assert.throws(() => calculate({ rule: { ...rule, VigenciaHasta: "2026-09-09" } }), /vencio/);
  assert.throws(() => calculate({ rule: { ...rule, VigenciaHasta: "2026-02-30" } }), /vigencia/);
  assert.throws(() => calculate({ rule: { ...rule, PrecioBaseCodigo: "" } }), /texto exacto/);
  assert.equal(calculate({ rule: { ...rule, VigenciaHasta: day } }).length, 1);
});
