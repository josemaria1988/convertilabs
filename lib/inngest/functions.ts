import {
  documentSpreadsheetImportRequested,
  documentsProcessRequested,
} from "@/modules/documents/inngest-function";

export const functions = [
  documentsProcessRequested,
  documentSpreadsheetImportRequested,
];
