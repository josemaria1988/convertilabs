/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDocumentIngestionDedupeKeys,
} = require("@/modules/ingestion");

test("ingestion dedupe keys include message, attachment and invoice identity", () => {
  const keys = buildDocumentIngestionDedupeKeys({
    sourceType: "email_inbox",
    messageId: "msg-1",
    attachmentHash: "sha256:abc",
    invoiceIdentityKey: "21433455019|a123|2026-03-14",
  });

  assert.deepEqual(keys, [
    "message:msg-1",
    "attachment:sha256:abc",
    "invoice:21433455019|a123|2026-03-14",
  ]);
});
