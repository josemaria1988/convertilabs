import { inflateRawSync } from "node:zlib";
import type {
  SpreadsheetFileKind,
  SpreadsheetParseResult,
  SpreadsheetSheetPreview,
  SpreadsheetUsedRange,
} from "@/modules/spreadsheets/types";

const UTF8_DECODER = new TextDecoder("utf-8", {
  fatal: false,
});

function toUint8Array(value: ArrayBuffer | Uint8Array) {
  return value instanceof Uint8Array
    ? value
    : new Uint8Array(value);
}

function decodeUtf8(bytes: Uint8Array) {
  return UTF8_DECODER.decode(bytes);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\r");
}

function stripXmlTags(value: string) {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ""));
}

function normalizeCellValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/\r\n/g, "\n").trim();
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;

  return tabCount > commaCount ? "\t" : ",";
}

function parseDelimitedRow(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (insideQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      cells.push(normalizeCellValue(current));
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(normalizeCellValue(current));
  return cells;
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let currentLine = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (insideQuotes && next === "\"") {
        currentLine += "\"\"";
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      currentLine += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      rows.push(parseDelimitedRow(currentLine, delimiter));
      currentLine = "";
      continue;
    }

    currentLine += char;
  }

  if (currentLine.length > 0 || text.endsWith(delimiter)) {
    rows.push(parseDelimitedRow(currentLine, delimiter));
  }

  return rows;
}

function readUInt16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]
    | (bytes[offset + 1] << 8)
    | (bytes[offset + 2] << 16)
    | (bytes[offset + 3] << 24)
  ) >>> 0;
}

function findEndOfCentralDirectoryOffset(bytes: Uint8Array) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);

  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (readUInt32LE(bytes, offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("No se encontro el directorio central del XLSX.");
}

function parseZipEntries(bytes: Uint8Array) {
  const eocdOffset = findEndOfCentralDirectoryOffset(bytes);
  const entryCount = readUInt16LE(bytes, eocdOffset + 10);
  const centralDirectoryOffset = readUInt32LE(bytes, eocdOffset + 16);
  const entries = new Map<string, Uint8Array>();
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32LE(bytes, cursor) !== 0x02014b50) {
      throw new Error("El directorio central del XLSX es invalido.");
    }

    const compressionMethod = readUInt16LE(bytes, cursor + 10);
    const compressedSize = readUInt32LE(bytes, cursor + 20);
    const fileNameLength = readUInt16LE(bytes, cursor + 28);
    const extraFieldLength = readUInt16LE(bytes, cursor + 30);
    const commentLength = readUInt16LE(bytes, cursor + 32);
    const localHeaderOffset = readUInt32LE(bytes, cursor + 42);
    const fileName = decodeUtf8(
      bytes.slice(cursor + 46, cursor + 46 + fileNameLength),
    );

    if (readUInt32LE(bytes, localHeaderOffset) !== 0x04034b50) {
      throw new Error("El header local del XLSX es invalido.");
    }

    const localNameLength = readUInt16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readUInt16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize);
    const fileBytes =
      compressionMethod === 0
        ? compressedData
        : compressionMethod === 8
          ? inflateRawSync(compressedData)
          : (() => {
              throw new Error(`Metodo de compresion ZIP no soportado: ${compressionMethod}`);
            })();

    entries.set(fileName, fileBytes);
    cursor += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

function columnLettersToIndex(columnLetters: string) {
  let value = 0;

  for (const char of columnLetters.toUpperCase()) {
    value = (value * 26) + (char.charCodeAt(0) - 64);
  }

  return Math.max(0, value - 1);
}

function columnIndexToLetters(columnIndex: number) {
  let index = columnIndex + 1;
  let letters = "";

  while (index > 0) {
    const remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - 1) / 26);
  }

  return letters || "A";
}

function toCellReference(rowIndex: number, columnIndex: number) {
  return `${columnIndexToLetters(columnIndex)}${rowIndex + 1}`;
}

function parseCellReference(reference: string | null | undefined) {
  if (!reference) {
    return null;
  }

  const match = /^([A-Z]+)(\d+)$/i.exec(reference);

  if (!match) {
    return null;
  }

  return {
    columnIndex: columnLettersToIndex(match[1]),
    rowIndex: Number.parseInt(match[2], 10) - 1,
  };
}

function parseDimensionRef(ref: string | null | undefined): SpreadsheetUsedRange | null {
  if (!ref) {
    return null;
  }

  const [startRef, endRef] = ref.split(":");
  const start = parseCellReference(startRef);
  const end = parseCellReference(endRef ?? startRef);

  if (!start || !end) {
    return null;
  }

  return {
    startRow: start.rowIndex,
    endRow: end.rowIndex,
    startColumn: start.columnIndex,
    endColumn: end.columnIndex,
    startCell: startRef,
    endCell: endRef ?? startRef,
  };
}

function computeUsedRange(rows: string[][]) {
  let startRow = Number.POSITIVE_INFINITY;
  let endRow = -1;
  let startColumn = Number.POSITIVE_INFINITY;
  let endColumn = -1;

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!normalizeCellValue(value)) {
        return;
      }

      startRow = Math.min(startRow, rowIndex);
      endRow = Math.max(endRow, rowIndex);
      startColumn = Math.min(startColumn, columnIndex);
      endColumn = Math.max(endColumn, columnIndex);
    });
  });

  if (!Number.isFinite(startRow) || endRow < 0) {
    return null;
  }

  return {
    startRow,
    endRow,
    startColumn,
    endColumn,
    startCell: toCellReference(startRow, startColumn),
    endCell: toCellReference(endRow, endColumn),
  } satisfies SpreadsheetUsedRange;
}

function buildSheetPreview(input: {
  sheetName: string;
  rows: string[][];
  usedRange?: SpreadsheetUsedRange | null;
  rowLimitForAnalysis: number;
}) {
  const boundedRows = input.rows.slice(0, input.rowLimitForAnalysis);
  const headerRowIndex = boundedRows.findIndex((row) =>
    row.some((value) => normalizeCellValue(value)),
  );
  const headers = headerRowIndex >= 0
    ? boundedRows[headerRowIndex].map((value, index) =>
        normalizeCellValue(value) || `column_${index + 1}`)
    : [];
  const dataRows = headerRowIndex >= 0
    ? boundedRows.slice(headerRowIndex + 1)
    : boundedRows;
  const previewRows = dataRows.slice(0, 12);
  const previewObjects = previewRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
  const columnCount = boundedRows.reduce(
    (max, row) => Math.max(max, row.length),
    0,
  );

  return {
    sheetName: input.sheetName,
    rowCount: boundedRows.length,
    columnCount,
    headerRowIndex: headerRowIndex >= 0 ? headerRowIndex : null,
    headers,
    rows: boundedRows,
    previewRows,
    previewObjects,
    usedRange: input.usedRange ?? computeUsedRange(boundedRows),
    truncatedForAnalysis: input.rows.length > boundedRows.length,
  } satisfies SpreadsheetSheetPreview;
}

function extractSharedStrings(xml: string) {
  const matches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g);
  const values: string[] = [];

  for (const match of matches) {
    const text = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((part) => stripXmlTags(part[1]))
      .join("");
    values.push(normalizeCellValue(text));
  }

  return values;
}

function extractSheetValue(input: {
  cellType: string | null;
  cellBody: string;
  sharedStrings: string[];
}) {
  const valueMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(input.cellBody);
  const inlineTextMatch = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(input.cellBody);
  const rawValue = valueMatch ? stripXmlTags(valueMatch[1]) : null;
  const inlineText = inlineTextMatch ? stripXmlTags(inlineTextMatch[1]) : null;

  if (input.cellType === "s" && rawValue) {
    const sharedIndex = Number.parseInt(rawValue, 10);
    return input.sharedStrings[sharedIndex] ?? "";
  }

  if (input.cellType === "inlineStr") {
    return normalizeCellValue(inlineText);
  }

  if (input.cellType === "b") {
    return rawValue === "1" ? "TRUE" : "FALSE";
  }

  return normalizeCellValue(rawValue);
}

function extractWorkbookSheetDescriptors(workbookXml: string) {
  return Array.from(
    workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g),
  ).map((match) => ({
    sheetName: decodeXmlEntities(match[1]),
    relationshipId: match[2],
  }));
}

function extractWorkbookRelationships(relationshipsXml: string) {
  const map = new Map<string, string>();

  for (const match of relationshipsXml.matchAll(
    /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g,
  )) {
    const target = match[2].startsWith("/")
      ? match[2].slice(1)
      : `xl/${match[2].replace(/^\.?\//, "")}`;
    map.set(match[1], target);
  }

  return map;
}

function parseSheetRowsFromXml(sheetXml: string, sharedStrings: string[]) {
  const rows = new Map<number, string[]>();

  for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttributes = rowMatch[1];
    const rowBody = rowMatch[2];
    const explicitRow = /r="(\d+)"/.exec(rowAttributes);
    const rowIndex = explicitRow
      ? Number.parseInt(explicitRow[1], 10) - 1
      : rows.size;
    const currentRow = rows.get(rowIndex) ?? [];

    for (const cellMatch of rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)) {
      const attributeBlock = cellMatch[1] ?? cellMatch[3] ?? "";
      const cellBody = cellMatch[2] ?? "";
      const reference = /r="([^"]+)"/.exec(attributeBlock)?.[1] ?? null;
      const cellType = /t="([^"]+)"/.exec(attributeBlock)?.[1] ?? null;
      const referenceInfo = parseCellReference(reference);
      const columnIndex = referenceInfo?.columnIndex ?? currentRow.length;
      currentRow[columnIndex] = extractSheetValue({
        cellType,
        cellBody,
        sharedStrings,
      });
    }

    rows.set(rowIndex, currentRow);
  }

  return Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1]);
}

function parseXlsxSpreadsheet(input: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string | null;
  rowLimitForAnalysis: number;
}) {
  const entries = parseZipEntries(input.bytes);
  const workbookXml = entries.get("xl/workbook.xml");
  const relationshipsXml = entries.get("xl/_rels/workbook.xml.rels");

  if (!workbookXml || !relationshipsXml) {
    throw new Error("El XLSX no contiene workbook.xml o sus relaciones.");
  }

  const workbookSheetDescriptors = extractWorkbookSheetDescriptors(decodeUtf8(workbookXml));
  const workbookRelationships = extractWorkbookRelationships(decodeUtf8(relationshipsXml));
  const sharedStringsXml = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml
    ? extractSharedStrings(decodeUtf8(sharedStringsXml))
    : [];
  const sheets = workbookSheetDescriptors.map((descriptor) => {
    const targetPath = workbookRelationships.get(descriptor.relationshipId);

    if (!targetPath) {
      return buildSheetPreview({
        sheetName: descriptor.sheetName,
        rows: [],
        usedRange: null,
        rowLimitForAnalysis: input.rowLimitForAnalysis,
      });
    }

    const sheetXmlBytes = entries.get(targetPath);

    if (!sheetXmlBytes) {
      return buildSheetPreview({
        sheetName: descriptor.sheetName,
        rows: [],
        usedRange: null,
        rowLimitForAnalysis: input.rowLimitForAnalysis,
      });
    }

    const sheetXml = decodeUtf8(sheetXmlBytes);
    const dimensionRef = /<dimension\b[^>]*ref="([^"]+)"/.exec(sheetXml)?.[1] ?? null;
    const rows = parseSheetRowsFromXml(sheetXml, sharedStrings);

    return buildSheetPreview({
      sheetName: descriptor.sheetName,
      rows,
      usedRange: parseDimensionRef(dimensionRef),
      rowLimitForAnalysis: input.rowLimitForAnalysis,
    });
  });

  return finalizeParseResult({
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileKind: "xlsx",
    sizeBytes: input.bytes.byteLength,
    parserVariant: "ooxml_zip",
    warnings: [],
    sheets,
  });
}

function parseSpreadsheetMlSheetRows(sheetXml: string) {
  const rows: string[][] = [];

  for (const rowMatch of sheetXml.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/gi)) {
    const currentRow: string[] = [];
    let nextColumnIndex = 0;

    for (const cellMatch of rowMatch[1].matchAll(/<Cell\b([^>]*)>([\s\S]*?)<\/Cell>|<Cell\b([^>]*)\/>/gi)) {
      const attributeBlock = cellMatch[1] ?? cellMatch[3] ?? "";
      const cellBody = cellMatch[2] ?? "";
      const indexedColumn = /ss:Index="(\d+)"/i.exec(attributeBlock)?.[1];

      if (indexedColumn) {
        nextColumnIndex = Number.parseInt(indexedColumn, 10) - 1;
      }

      const dataValue = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i.exec(cellBody)?.[1] ?? "";
      currentRow[nextColumnIndex] = normalizeCellValue(stripXmlTags(dataValue));
      nextColumnIndex += 1;
    }

    rows.push(currentRow);
  }

  return rows;
}

function parseSpreadsheetMlWorkbook(input: {
  xml: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  rowLimitForAnalysis: number;
}) {
  const sheets = Array.from(
    input.xml.matchAll(/<Worksheet\b[^>]*(?:ss:Name|Name)="([^"]+)"[^>]*>([\s\S]*?)<\/Worksheet>/gi),
  ).map((match) => buildSheetPreview({
    sheetName: decodeXmlEntities(match[1]),
    rows: parseSpreadsheetMlSheetRows(match[2]),
    usedRange: null,
    rowLimitForAnalysis: input.rowLimitForAnalysis,
  }));

  return finalizeParseResult({
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileKind: "xls",
    sizeBytes: input.sizeBytes,
    parserVariant: "spreadsheet_ml_2003",
    warnings: [],
    sheets,
  });
}

function parseTextSpreadsheet(input: {
  text: string;
  fileName: string;
  mimeType: string | null;
  fileKind: SpreadsheetFileKind;
  sizeBytes: number;
  parserVariant: string;
  rowLimitForAnalysis: number;
}) {
  const delimiter = input.fileKind === "tsv" ? "\t" : detectDelimiter(input.text);
  const rows = parseDelimitedText(input.text, delimiter);

  return finalizeParseResult({
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileKind: input.fileKind,
    sizeBytes: input.sizeBytes,
    parserVariant: input.parserVariant,
    warnings: [],
    sheets: [
      buildSheetPreview({
        sheetName: "Sheet1",
        rows,
        usedRange: null,
        rowLimitForAnalysis: input.rowLimitForAnalysis,
      }),
    ],
  });
}

function finalizeParseResult(input: {
  fileName: string;
  mimeType: string | null;
  fileKind: SpreadsheetFileKind;
  sizeBytes: number;
  parserVariant: string;
  warnings: string[];
  sheets: SpreadsheetSheetPreview[];
}) {
  const totalRows = input.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0);
  const totalCells = input.sheets.reduce(
    (sum, sheet) => sum + sheet.rows.reduce((rowSum, row) => rowSum + row.length, 0),
    0,
  );

  return {
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileKind: input.fileKind,
    sizeBytes: input.sizeBytes,
    totalSheets: input.sheets.length,
    totalRows,
    totalCells,
    warnings: input.warnings,
    sheets: input.sheets,
    metadata: {
      parserVariant: input.parserVariant,
    },
  } satisfies SpreadsheetParseResult;
}

export function detectSpreadsheetFileKind(fileName: string, mimeType?: string | null) {
  const normalizedMime = (mimeType ?? "").toLowerCase();
  const extension = fileName.toLowerCase().split(".").pop() ?? "";

  if (extension === "csv" || normalizedMime.includes("text/csv")) {
    return "csv" satisfies SpreadsheetFileKind;
  }

  if (extension === "tsv" || normalizedMime.includes("tab-separated")) {
    return "tsv" satisfies SpreadsheetFileKind;
  }

  if (extension === "xlsx" || normalizedMime.includes("spreadsheetml.sheet")) {
    return "xlsx" satisfies SpreadsheetFileKind;
  }

  if (extension === "xls" || normalizedMime.includes("ms-excel")) {
    return "xls" satisfies SpreadsheetFileKind;
  }

  return "unknown" satisfies SpreadsheetFileKind;
}

export function parseSpreadsheetFile(input: {
  fileName: string;
  mimeType?: string | null;
  bytes: ArrayBuffer | Uint8Array;
  rowLimitForAnalysis?: number;
}) {
  const bytes = toUint8Array(input.bytes);
  const fileKind = detectSpreadsheetFileKind(input.fileName, input.mimeType ?? null);
  const rowLimitForAnalysis = input.rowLimitForAnalysis ?? 250;

  if (fileKind === "xlsx") {
    return parseXlsxSpreadsheet({
      bytes,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      rowLimitForAnalysis,
    });
  }

  const text = decodeUtf8(bytes);

  if (fileKind === "csv" || fileKind === "tsv") {
    return parseTextSpreadsheet({
      text,
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      fileKind,
      sizeBytes: bytes.byteLength,
      parserVariant: fileKind === "csv" ? "csv_text" : "tsv_text",
      rowLimitForAnalysis,
    });
  }

  if (fileKind === "xls") {
    if (text.includes("<Workbook") && text.includes("<Worksheet")) {
      return parseSpreadsheetMlWorkbook({
        xml: text,
        fileName: input.fileName,
        mimeType: input.mimeType ?? null,
        sizeBytes: bytes.byteLength,
        rowLimitForAnalysis,
      });
    }

    const isCompoundBinary =
      bytes[0] === 0xd0
      && bytes[1] === 0xcf
      && bytes[2] === 0x11
      && bytes[3] === 0xe0;

    return finalizeParseResult({
      fileName: input.fileName,
      mimeType: input.mimeType ?? null,
      fileKind,
      sizeBytes: bytes.byteLength,
      parserVariant: isCompoundBinary ? "legacy_binary_xls" : "xls_text_fallback",
      warnings: isCompoundBinary
        ? ["La variante binaria legacy de .xls todavia requiere conversion a .xlsx o SpreadsheetML XML."]
        : ["La variante .xls no pudo interpretarse de forma estructural."],
      sheets: [],
    });
  }

  return finalizeParseResult({
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    fileKind,
    sizeBytes: bytes.byteLength,
    parserVariant: "unsupported",
    warnings: ["Formato de planilla no soportado para importacion automatica."],
    sheets: [],
  });
}
