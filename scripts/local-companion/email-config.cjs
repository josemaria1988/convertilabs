/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs/promises");
const { parseEnv } = require("node:util");

const emailKeys = Object.freeze([
  "CONVERTILABS_EMAIL_ENABLED", "CONVERTILABS_EMAIL_ADDRESS", "CONVERTILABS_EMAIL_APP_PASSWORD",
  "CONVERTILABS_EMAIL_MAILBOX", "CONVERTILABS_EMAIL_SINCE",
]);

// Never populate process.env: the password must not reach Next, Codex or subprocesses.
async function loadEmailInboxEnv(filename) {
  let handle;
  try {
    handle = await fs.open(filename, "r");
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 8192) return { invalid: true };
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== stat.size) return { invalid: true };
    const parsed = parseEnv(bytes.subarray(0, bytesRead).toString("utf8"));
    return Object.fromEntries(emailKeys.map((key) => [key, parsed[key]]));
  } catch (error) {
    return error.code === "ENOENT" ? {} : { invalid: true };
  } finally { await handle?.close(); }
}

module.exports = { emailKeys, loadEmailInboxEnv };
