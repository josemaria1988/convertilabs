/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

function raw(overrides = {}) {
  return {
    Codigo: "5.2.1.01",
    Nombre: "Gastos administrativos",
    CodigoNombre: "5.2.1.01 Gastos administrativos",
    EsImputable: "S",
    CodigoPresentacion: "5.2.1",
    Capitulo: "Egresos",
    CuentaPadre: "5.2.1",
    Nivel: 4,
    GrupoCodigo: "GASTOS",
    GrupoNombre: "Gastos",
    CalculaDifCambio: "N",
    MonedaCodigo: 1,
    MonedaSimbolo: "$",
    MonedaNombre: "Peso Uruguayo",
    MonedaAbreviacion: "UYU",
    LiteralTributario: 0,
    UsaCentroCostos: "N",
    Notas: "",
    ...overrides,
  };
}

test("Zeta chart account normalizer maps EsImputable S to true", () => {
  const { normalizeZetaChartAccount } = require("@/modules/integrations/zeta/normalizers/chart-account-normalizer");
  const result = normalizeZetaChartAccount(raw({ EsImputable: "S" }));

  assert.equal(result.is_imputable, true);
});

test("Zeta chart account normalizer maps EsImputable N to false", () => {
  const { normalizeZetaChartAccount } = require("@/modules/integrations/zeta/normalizers/chart-account-normalizer");
  const result = normalizeZetaChartAccount(raw({ EsImputable: "N" }));

  assert.equal(result.is_imputable, false);
});

test("Zeta chart account normalizer treats empty parent as null", () => {
  const { normalizeZetaChartAccount } = require("@/modules/integrations/zeta/normalizers/chart-account-normalizer");
  const result = normalizeZetaChartAccount(raw({ CuentaPadre: "" }));

  assert.equal(result.external_parent_code, null);
});

test("Zeta chart account normalizer maps LiteralTributario zero to null", () => {
  const { normalizeZetaChartAccount } = require("@/modules/integrations/zeta/normalizers/chart-account-normalizer");
  const result = normalizeZetaChartAccount(raw({ LiteralTributario: 0 }));

  assert.equal(result.literal_tributario, null);
});

test("Zeta chart account normalizer preserves account name casing", () => {
  const { normalizeZetaChartAccount } = require("@/modules/integrations/zeta/normalizers/chart-account-normalizer");
  const result = normalizeZetaChartAccount(raw({ Nombre: "Gastos de Limpieza Rontil" }));

  assert.equal(result.name, "Gastos de Limpieza Rontil");
});

test("Zeta chart account normalizer is pure for repeated inputs", () => {
  const { normalizeZetaChartAccount } = require("@/modules/integrations/zeta/normalizers/chart-account-normalizer");
  const input = raw({ LiteralTributario: 101, UsaCentroCostos: "S" });

  assert.deepEqual(normalizeZetaChartAccount(input), normalizeZetaChartAccount(input));
});
