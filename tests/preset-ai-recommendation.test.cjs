/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildPresetAiSettingsOrganizationContext,
  buildAssistantLetterMarkdown,
  buildPresetAiInputHash,
  buildPresetAiOutputFromStoredRun,
  derivePresetHybridRecommendation,
} = require("@/modules/accounting/presets/ai-recommendation");
const {
  buildPresetRecommendation,
} = require("@/modules/accounting/presets/recommendation-engine");

function buildBaseRecommendation() {
  return buildPresetRecommendation({
    primaryActivityCode: "46590",
    secondaryActivityCodes: ["33120"],
    selectedTraits: [
      "imports_goods",
      "technical_installation_or_maintenance",
      "multi_currency_operations",
    ],
    shortDescription: "Importamos equipos, vendemos repuestos y hacemos mantenimiento.",
  });
}

function buildAiOutput(overrides = {}) {
  const recommendation = buildBaseRecommendation();
  const alternative = recommendation.alternatives[0] ?? recommendation.recommended;

  return {
    selectedCompositionCode: alternative.code,
    confidence: 0.91,
    targetAudienceFit: "Encaja con una operativa de equipos tecnicos, importacion y servicio postventa.",
    keyBenefit: "Te deja medir mejor costos de importacion y de servicio tecnico.",
    setupTip: "Arranca validando bancos USD, proveedores del exterior y materiales aplicados a servicio.",
    observations: [
      {
        key: "obs-imports",
        title: "Operativa importadora",
        shortLabel: "Conviene revisar proveedores del exterior y mercaderia en transito.",
        whatIsIt: "La descripcion sugiere compras internacionales y costos asociados.",
        whyItMatters: "Eso cambia cuentas, moneda y conciliaciones posteriores.",
        impact: "Puede alterar la recomendacion final y la configuracion de bancos USD.",
        whatCanYouDo: "Confirma si importas de forma recurrente y si liquidas en moneda extranjera.",
        sourceLabel: null,
        expertNotes: [],
        suggestedCode: null,
      },
    ],
    suggestedCostCenters: [
      {
        code: "UNIDAD_TECNICA",
        label: "Unidad tecnica",
        rationale: "Ayuda a medir rentabilidad por equipo o cuadrilla.",
        groupingHint: "Agrupa por camioneta, tecnico o unidad operativa.",
      },
    ],
    ...overrides,
  };
}

test("hybrid recommendation auto-selects an alternative when confidence is high", () => {
  const recommendation = buildBaseRecommendation();
  const aiOutput = buildAiOutput();
  const hybrid = derivePresetHybridRecommendation({
    recommendation,
    aiOutput,
    runId: "run-1",
    inputHash: "hash-1",
  });

  assert.equal(hybrid.shouldAutoSelect, true);
  assert.equal(hybrid.source, "hybrid_ai_recommended");
  assert.equal(hybrid.composition.code, aiOutput.selectedCompositionCode);
  assert.equal(hybrid.runId, "run-1");
});

test("hybrid recommendation falls back to rules when confidence is low", () => {
  const recommendation = buildBaseRecommendation();
  const aiOutput = buildAiOutput({
    confidence: 0.42,
  });
  const hybrid = derivePresetHybridRecommendation({
    recommendation,
    aiOutput,
  });

  assert.equal(hybrid.shouldAutoSelect, false);
  assert.equal(hybrid.source, "ai_low_confidence");
  assert.equal(hybrid.composition.code, recommendation.recommended.code);
});

test("assistant letter markdown includes setup guidance and suggested cost centers", () => {
  const recommendation = buildBaseRecommendation();
  const letter = buildAssistantLetterMarkdown({
    composition: recommendation.recommended,
    aiOutput: buildAiOutput({
      selectedCompositionCode: recommendation.recommended.code,
    }),
  });

  assert.match(letter, /Mayor beneficio/i);
  assert.match(letter, /Consejo inicial/i);
  assert.match(letter, /Centros de costo sugeridos/i);
});

test("preset ai input hash changes when onboarding context changes", () => {
  const recommendation = buildBaseRecommendation();
  const baseInput = {
    scope: "onboarding",
    organizationContext: {
      organizationName: "Rontil SA",
      taxId: "211234560019",
      taxRegimeCode: "IRAE_GENERAL",
    },
    profile: {
      primaryActivityCode: "46590",
      secondaryActivityCodes: ["33120"],
      selectedTraits: ["imports_goods"],
      shortDescription: "Importamos equipos.",
    },
    recommendation,
  };
  const firstHash = buildPresetAiInputHash(baseInput);
  const secondHash = buildPresetAiInputHash({
    ...baseInput,
    organizationContext: {
      ...baseInput.organizationContext,
      taxId: "219999990019",
    },
  });

  assert.notEqual(firstHash, secondHash);
});

test("preset ai input hash stays aligned in settings when organization context is normalized", () => {
  const recommendation = buildBaseRecommendation();
  const routeContext = buildPresetAiSettingsOrganizationContext({
    organizationId: "org-1",
    slug: "rontil-sa-1",
    organizationName: "Rontil SA",
    legalEntityType: "sa",
    taxId: "21.123.456/0019",
    taxRegimeCode: "irae_general",
    vatRegime: "general",
    dgiGroup: "ce_de",
    cfeStatus: "emisor_total",
  });
  const saveContext = buildPresetAiSettingsOrganizationContext({
    organizationId: "org-1",
    slug: "rontil-sa-1",
    organizationName: "Rontil SA",
    legalEntityType: "SA",
    taxId: "211234560019",
    taxRegimeCode: "IRAE_GENERAL",
    vatRegime: "GENERAL",
    dgiGroup: "CE_DE",
    cfeStatus: "EMISOR_TOTAL",
  });
  const routeHash = buildPresetAiInputHash({
    scope: "settings",
    organizationContext: routeContext,
    profile: {
      primaryActivityCode: "46590",
      secondaryActivityCodes: ["33120"],
      selectedTraits: ["imports_goods"],
      shortDescription: "Importamos equipos.",
    },
    recommendation,
  });
  const saveHash = buildPresetAiInputHash({
    scope: "settings",
    organizationContext: saveContext,
    profile: {
      primaryActivityCode: "46590",
      secondaryActivityCodes: ["33120"],
      selectedTraits: ["imports_goods"],
      shortDescription: "Importamos equipos.",
    },
    recommendation,
  });

  assert.equal(routeHash, saveHash);
});

test("stored ai runs hydrate back into structured output only when required fields are present", () => {
  const output = buildPresetAiOutputFromStoredRun({
    selected_composition_code: "RULE__ALT",
    confidence: 0.88,
    target_audience_fit: "Encaja con el negocio descripto.",
    key_benefit: "Mejora control operativo.",
    setup_tip: "Revisa categorias y bancos.",
    observations_json: [],
    suggested_cost_centers_json: [],
  });
  const missingOutput = buildPresetAiOutputFromStoredRun({
    selected_composition_code: null,
    confidence: 0.88,
    target_audience_fit: "Encaja con el negocio descripto.",
    key_benefit: "Mejora control operativo.",
    setup_tip: "Revisa categorias y bancos.",
    observations_json: [],
    suggested_cost_centers_json: [],
  });

  assert.equal(output.selectedCompositionCode, "RULE__ALT");
  assert.equal(missingOutput, null);
});
