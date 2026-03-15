/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  getHelpHintContent,
  onboardingHelpHintKeys,
  reviewHelpHintKeys,
  listHelpHintKeys,
} = require("@/modules/ui/help-hints-registry");

test("all onboarding help hint keys resolve to complete content", () => {
  for (const key of onboardingHelpHintKeys) {
    const content = getHelpHintContent(key);

    assert.ok(content, `missing onboarding hint for ${key}`);
    assert.equal(content.key, key);
    assert.ok(content.title.length > 0);
    assert.ok(content.shortLabel.length > 0);
    assert.ok(content.whatIsIt.length > 0);
    assert.ok(content.whyItMatters.length > 0);
    assert.ok(content.impact.length > 0);
    assert.ok(content.whatCanYouDo.length > 0);
  }
});

test("all review help hint keys resolve to complete content", () => {
  for (const key of reviewHelpHintKeys) {
    const content = getHelpHintContent(key);

    assert.ok(content, `missing review hint for ${key}`);
    assert.equal(content.key, key);
    assert.ok(content.title.length > 0);
    assert.ok(content.shortLabel.length > 0);
  }
});

test("help hint registry exposes a stable catalog", () => {
  const keys = listHelpHintKeys();

  assert.ok(keys.length >= onboardingHelpHintKeys.length + reviewHelpHintKeys.length);
  assert.ok(keys.includes("plan_recomendado"));
  assert.ok(keys.includes("posteo_provisional"));
});
