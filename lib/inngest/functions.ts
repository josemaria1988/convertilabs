import {
  documentSpreadsheetImportRequested,
  documentsProcessRequested,
} from "@/modules/documents/inngest-function";
import { zetaSyncRequested } from "@/modules/integrations/zeta/inngest-function";

export const functions = [
  documentsProcessRequested,
  documentSpreadsheetImportRequested,
  zetaSyncRequested,
];
