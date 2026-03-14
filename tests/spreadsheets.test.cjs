/* eslint-disable @typescript-eslint/no-require-imports */
const { deflateRawSync } = require("node:zlib");
const { test, assert } = require("./testkit.cjs");

const {
  parseSpreadsheetFile,
  interpretSpreadsheetPreview,
  chooseSpreadsheetImportMode,
  canCancelSpreadsheetImportRun,
  canRetrySpreadsheetImportRun,
} = require("@/modules/spreadsheets");

function writeUInt16LE(buffer, value, offset) {
  buffer.writeUInt16LE(value, offset);
}

function writeUInt32LE(buffer, value, offset) {
  buffer.writeUInt32LE(value >>> 0, offset);
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBuffer = Buffer.from(entry.name, "utf8");
    const fileDataBuffer = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, "utf8");
    const compressed = deflateRawSync(fileDataBuffer);
    const localHeader = Buffer.alloc(30);

    writeUInt32LE(localHeader, 0x04034b50, 0);
    writeUInt16LE(localHeader, 20, 4);
    writeUInt16LE(localHeader, 0, 6);
    writeUInt16LE(localHeader, 8, 8);
    writeUInt16LE(localHeader, 0, 10);
    writeUInt16LE(localHeader, 0, 12);
    writeUInt32LE(localHeader, 0, 14);
    writeUInt32LE(localHeader, compressed.length, 18);
    writeUInt32LE(localHeader, fileDataBuffer.length, 22);
    writeUInt16LE(localHeader, fileNameBuffer.length, 26);
    writeUInt16LE(localHeader, 0, 28);

    localParts.push(localHeader, fileNameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    writeUInt32LE(centralHeader, 0x02014b50, 0);
    writeUInt16LE(centralHeader, 20, 4);
    writeUInt16LE(centralHeader, 20, 6);
    writeUInt16LE(centralHeader, 0, 8);
    writeUInt16LE(centralHeader, 8, 10);
    writeUInt16LE(centralHeader, 0, 12);
    writeUInt16LE(centralHeader, 0, 14);
    writeUInt32LE(centralHeader, 0, 16);
    writeUInt32LE(centralHeader, compressed.length, 20);
    writeUInt32LE(centralHeader, fileDataBuffer.length, 24);
    writeUInt16LE(centralHeader, fileNameBuffer.length, 28);
    writeUInt16LE(centralHeader, 0, 30);
    writeUInt16LE(centralHeader, 0, 32);
    writeUInt16LE(centralHeader, 0, 34);
    writeUInt16LE(centralHeader, 0, 36);
    writeUInt32LE(centralHeader, 0, 38);
    writeUInt32LE(centralHeader, offset, 42);

    centralParts.push(centralHeader, fileNameBuffer);
    offset += localHeader.length + fileNameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  writeUInt32LE(end, 0x06054b50, 0);
  writeUInt16LE(end, 0, 4);
  writeUInt16LE(end, 0, 6);
  writeUInt16LE(end, entries.length, 8);
  writeUInt16LE(end, entries.length, 10);
  writeUInt32LE(end, centralDirectory.length, 12);
  writeUInt32LE(end, offset, 16);
  writeUInt16LE(end, 0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function buildSharedStrings(strings) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    strings.map((value) => `<si><t>${value}</t></si>`).join(""),
    "</sst>",
  ].join("");
}

function buildSheetXml(rows) {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    "<sheetData>",
    rows.map((row, rowIndex) => (
      `<row r="${rowIndex + 1}">${
        row.map((cell, cellIndex) => {
          const column = String.fromCharCode(65 + cellIndex);
          return `<c r="${column}${rowIndex + 1}" t="inlineStr"><is><t>${cell}</t></is></c>`;
        }).join("")
      }</row>`
    )).join(""),
    "</sheetData>",
    "</worksheet>",
  ].join("");
}

function buildXlsxBuffer() {
  return buildZip([
    {
      name: "xl/workbook.xml",
      data: [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '<sheets>',
        '<sheet name="IVA Historico" sheetId="1" r:id="rId1"/>',
        '<sheet name="Plan de cuentas" sheetId="2" r:id="rId2"/>',
        "</sheets>",
        "</workbook>",
      ].join(""),
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>',
        "</Relationships>",
      ].join(""),
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: buildSheetXml([
        ["Periodo", "IVA debito", "IVA credito"],
        ["2026-01", "1200", "800"],
        ["2026-02", "1400", "900"],
      ]),
    },
    {
      name: "xl/worksheets/sheet2.xml",
      data: buildSheetXml([
        ["Codigo", "Nombre", "Tipo"],
        ["6101", "Gastos administrativos", "expense"],
      ]),
    },
    {
      name: "xl/sharedStrings.xml",
      data: buildSharedStrings([]),
    },
  ]);
}

test("spreadsheet parser handles simple CSV files", () => {
  const result = parseSpreadsheetFile({
    fileName: "iva.csv",
    mimeType: "text/csv",
    bytes: Buffer.from("Periodo,IVA debito,IVA credito\n2026-01,1200,800\n"),
  });

  assert.equal(result.fileKind, "csv");
  assert.equal(result.totalSheets, 1);
  assert.deepEqual(result.sheets[0].headers, ["Periodo", "IVA debito", "IVA credito"]);
  assert.equal(result.sheets[0].previewRows[0][0], "2026-01");
});

test("spreadsheet parser reads XLSX workbooks with multiple sheets", () => {
  const result = parseSpreadsheetFile({
    fileName: "historicos.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    bytes: buildXlsxBuffer(),
  });

  assert.equal(result.fileKind, "xlsx");
  assert.equal(result.totalSheets, 2);
  assert.equal(result.sheets[0].sheetName, "IVA Historico");
  assert.equal(result.sheets[1].sheetName, "Plan de cuentas");
  assert.deepEqual(result.sheets[1].headers, ["Codigo", "Nombre", "Tipo"]);
});

test("spreadsheet interpreter marks mixed imports and ignores irrelevant sheets", async () => {
  const preview = parseSpreadsheetFile({
    fileName: "mixed.csv",
    mimeType: "text/csv",
    bytes: Buffer.from("Periodo\tIVA debito\tIVA credito\n2026-01\t1200\t800\n"),
  });
  preview.fileKind = "xlsx";
  preview.sheets.push({
    sheetName: "Notas",
    rowCount: 2,
    columnCount: 2,
    headerRowIndex: 0,
    headers: ["Comentario", "Detalle"],
    rows: [["Comentario", "Detalle"], ["hola", "mundo"]],
    previewRows: [["hola", "mundo"]],
    previewObjects: [{ Comentario: "hola", Detalle: "mundo" }],
    usedRange: {
      startRow: 0,
      endRow: 1,
      startColumn: 0,
      endColumn: 1,
      startCell: "A1",
      endCell: "B2",
    },
    truncatedForAnalysis: false,
  });
  preview.totalSheets = 2;

  const interpreted = await interpretSpreadsheetPreview({
    organizationId: "org-1",
    preview,
    provider: "heuristic",
  });

  assert.equal(interpreted.importType, "historical_vat_liquidation");
  assert.equal(interpreted.canonical.importType, "historical_vat_liquidation");
  assert.match(interpreted.warnings.join(" "), /ignoro/i);
});

test("spreadsheet runner switches to batch mode for large previews", () => {
  const preview = parseSpreadsheetFile({
    fileName: "big.csv",
    mimeType: "text/csv",
    bytes: Buffer.from(
      `Periodo,IVA debito,IVA credito\n${
        Array.from({ length: 160 }, (_, index) => `2026-${String((index % 12) + 1).padStart(2, "0")},1200,800`).join("\n")
      }`,
    ),
  });

  assert.equal(chooseSpreadsheetImportMode(preview), "batch");
});

test("spreadsheet run helpers expose cancel and retry states cleanly", () => {
  assert.equal(canCancelSpreadsheetImportRun({
    status: "queued",
  }), true);
  assert.equal(canRetrySpreadsheetImportRun({
    status: "failed",
  }), true);
  assert.equal(canRetrySpreadsheetImportRun({
    status: "preview_ready",
  }), false);
});
