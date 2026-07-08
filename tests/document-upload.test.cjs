/* eslint-disable @typescript-eslint/no-require-imports */
const { test, assert } = require("./testkit.cjs");

const {
  buildDescriptiveDocumentFilename,
  maxDocumentUploadBytes,
  sanitizeDocumentFilenameBase,
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

test("document upload builds descriptive filenames while preserving the real extension", () => {
  assert.equal(
    buildDescriptiveDocumentFilename({
      descriptiveName: "hospedaje servicio ADPCaraguata-001",
      originalFilename: "IMG_20260708_183045.jpg",
      mimeType: "image/jpeg",
    }),
    "hospedaje servicio ADPCaraguata-001.jpg",
  );
  assert.equal(
    buildDescriptiveDocumentFilename({
      descriptiveName: "Factura:/hotel?",
      originalFilename: "capture",
      mimeType: "image/png",
      sequenceNumber: 2,
    }),
    "Factura hotel-2.png",
  );
  assert.equal(
    buildDescriptiveDocumentFilename({
      descriptiveName: "",
      originalFilename: "factura-original.pdf",
      mimeType: "application/pdf",
    }),
    "factura-original.pdf",
  );
  assert.equal(sanitizeDocumentFilenameBase("  ///  "), "documento");
});
