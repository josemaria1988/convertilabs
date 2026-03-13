/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const tests = [];

function test(name, fn) {
  tests.push({
    name,
    fn,
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  for (const entry of tests) {
    try {
      await entry.fn();
      passed += 1;
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${entry.name}`);
      console.error(error instanceof Error ? error.stack : error);
    }
  }

  console.log(`1..${tests.length}`);
  console.log(`# pass ${passed}`);
  console.log(`# fail ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

module.exports = {
  test,
  assert,
  run,
};
