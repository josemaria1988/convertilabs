export const DGI_RECONCILIATION_SCOPE_LABEL = "base" as const;
export const DGI_RECONCILIATION_TITLE = "Conciliacion DGI base";
export const DGI_RECONCILIATION_COMPARISON_LABEL = "Comparacion base por buckets";
export const DGI_RECONCILIATION_DESCRIPTION =
  "Comparacion base por buckets entre el baseline cargado y el universo procesado por Convertilabs.";
export const DGI_RECONCILIATION_DISCLAIMER =
  "Compara buckets del sistema contra un baseline cargado o una importacion equivalente. No equivale a filing directo ni reemplaza la revision contable/fiscal final.";

export function formatDgiReconciliationClosedLabel() {
  return `${DGI_RECONCILIATION_TITLE} cerrada`;
}
