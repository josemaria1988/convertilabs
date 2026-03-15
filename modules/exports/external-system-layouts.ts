export type AccountingExportLayoutCode =
  | "generic_csv"
  | "generic_excel_xml";

export function listAccountingExportLayouts() {
  return [
    {
      code: "generic_csv" as const,
      label: "CSV generico",
      description:
        "Layout plano por linea de asiento, util para ERPs y estudios que importan CSV.",
      fileExtension: "csv",
      mimeType: "text/csv; charset=utf-8",
    },
    {
      code: "generic_excel_xml" as const,
      label: "Excel generico",
      description:
        "Workbook XML compatible con Excel, con hojas para asientos, provisionales y conciliacion DGI.",
      fileExtension: "xml",
      mimeType: "application/xml",
    },
  ];
}

export function getAccountingExportLayout(code: AccountingExportLayoutCode) {
  return listAccountingExportLayouts().find((layout) => layout.code === code) ?? null;
}
