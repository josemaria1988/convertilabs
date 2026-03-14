/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  maxDocumentUploadBytes,
  validateDocumentUploadCandidates,
} = require("@/modules/documents/upload");

test("document upload validation accepts a valid file and rejects mixed invalid batches", () => {
  const result = validateDocumentUploadCandidates([
    {
      name: "factura.pdf",
      type: "application/pdf",
      size: 2048,
    },
    {
      name: "foto.bmp",
      type: "image/bmp",
      size: 1024,
    },
    {
      name: "gigante.png",
      type: "image/png",
      size: maxDocumentUploadBytes + 1,
    },
  ]);

  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 2);
  assert.match(result.rejected[0].message, /PDF, JPG o PNG/i);
  assert.match(result.rejected[1].message, /20 MB/i);
});
