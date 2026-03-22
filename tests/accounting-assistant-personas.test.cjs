/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

test("assistant persona presentation renders historical document persona as Asistente Contable", () => {
  const personasModule = require("@/modules/assistant/personas");
  const persona = personasModule.getAssistantPersonaPresentation("document_reviewer_assistant");

  assert.equal(persona.displayName, "Asistente Contable");
  assert.equal(persona.subtitle, "Revision documental");
  assert.equal(persona.systemActorId, "system_ai_assistant");
});

test("decision source label exposes Asistente Contable for assistant decisions", () => {
  const labelsModule = require("@/modules/presentation/labels");

  assert.equal(
    labelsModule.formatDecisionSourceLabel("assistant"),
    "Asistente Contable",
  );
});
