/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

require("./register-ts.cjs");

const { run } = require("./testkit.cjs");

const files = fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".test.cjs"))
  .sort();

for (const file of files) {
  require(path.join(__dirname, file));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
