export function formatAccountTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "asset":
      return "Activo";
    case "liability":
      return "Pasivo";
    case "equity":
      return "Patrimonio";
    case "revenue":
      return "Ingresos";
    case "expense":
      return "Gastos";
    case "memo":
      return "Memorandum";
    default:
      return value ?? "Sin definir";
  }
}

export function formatNormalSideLabel(value: string | null | undefined) {
  switch (value) {
    case "debit":
      return "Debe";
    case "credit":
      return "Haber";
    default:
      return value ?? "Sin definir";
  }
}

export function formatSystemRoleLabel(value: string | null | undefined) {
  switch (value) {
    case "accounts_receivable":
      return "Deudores por ventas";
    case "accounts_payable":
      return "Proveedores";
    case "vat_input_creditable":
      return "IVA compras acreditable";
    case "vat_output_payable":
      return "IVA ventas debito fiscal";
    default:
      return value ? value.replace(/_/g, " ") : "Sin rol";
  }
}

export function formatChartAccountSourceLabel(value: string | null | undefined) {
  switch (value) {
    case "starter_bootstrap":
      return "Bootstrap inicial";
    case "organization_settings_manual":
      return "Alta manual";
    case "spreadsheet_import":
      return "Importada desde planilla";
    case "document_review_inline_create":
      return "Creada desde revision";
    case "imported_template":
      return "Importada desde plantilla";
    default:
      return value ? value.replace(/_/g, " ") : "Sin origen";
  }
}

export function formatLifecycleStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "active":
      return "Activa";
    case "superseded":
      return "Reemplazada";
    case "draft":
      return "Borrador";
    case "reviewed":
      return "Revisada";
    case "finalized":
      return "Finalizada";
    case "locked":
      return "Bloqueada";
    case "queued":
      return "En cola";
    case "in_progress":
      return "En progreso";
    case "completed":
      return "Completada";
    case "computed":
      return "Calculada";
    case "failed":
      return "Con error";
    case "cancelled":
      return "Cancelada";
    case "preview_ready":
      return "Vista previa lista";
    case "needs_review":
      return "Requiere revision";
    case "open":
      return "Abierta";
    case "partially_settled":
      return "Parcialmente cancelada";
    case "settled":
      return "Cancelada";
    case "suggested":
      return "Sugerido";
    default:
      return value ? value.replace(/_/g, " ") : "Sin estado";
  }
}

export function formatPostingStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "draft":
      return "Borrador";
    case "vat_ready":
      return "Listo fiscal";
    case "posted_provisional":
      return "Posteado provisional";
    case "posted_final":
      return "Posteado final";
    case "locked":
      return "Bloqueado";
    default:
      return value ? value.replace(/_/g, " ") : "Sin posting";
  }
}

export function formatSpreadsheetImportTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "historical_vat_liquidation":
      return "Historico de IVA";
    case "journal_template_import":
      return "Plantillas contables";
    case "chart_of_accounts_import":
      return "Plan de cuentas";
    case "mixed":
      return "Mixto";
    case "unsupported":
      return "No soportado";
    default:
      return value ? value.replace(/_/g, " ") : "Sin tipo";
  }
}

export function formatSpreadsheetRunModeLabel(value: string | null | undefined) {
  switch (value) {
    case "interactive":
      return "Interactivo";
    case "batch":
      return "Lote";
    default:
      return value ? value.replace(/_/g, " ") : "Sin modo";
  }
}

export function formatSourceTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "imported_from_spreadsheet":
      return "Importado desde planilla";
    case "imported_from_document":
      return "Importado desde documento";
    case "manual_override":
      return "Override manual";
    case "system_generated":
      return "Generado por el sistema";
    default:
      return value ? value.replace(/_/g, " ") : "Sin origen";
  }
}

export function formatCounterpartyTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "customer":
      return "Cliente";
    case "vendor":
      return "Proveedor";
    default:
      return value ? value.replace(/_/g, " ") : "Sin contraparte";
  }
}

export function formatDecisionSourceLabel(value: string | null | undefined) {
  switch (value) {
    case "deterministic_rule":
      return "Regla deterministica";
    case "assistant":
      return "Asistente IA";
    case "manual_override":
      return "Override manual";
    default:
      return value ? value.replace(/_/g, " ") : "Sin decision";
  }
}

export function formatDuplicateStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "clear":
      return "Sin duplicado";
    case "suspected_duplicate":
      return "Duplicado sospechoso";
    case "confirmed_duplicate":
      return "Duplicado confirmado";
    default:
      return value ? value.replace(/_/g, " ") : "Sin duplicado";
  }
}

export function formatImportOperationStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "approved":
      return "Aprobada";
    case "blocked_manual_review":
      return "Bloqueada por revision";
    case "ready_for_review":
      return "Lista para revision";
    default:
      return formatLifecycleStatusLabel(value);
  }
}

export function formatDgiDifferenceStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "matched":
      return "Sin diferencias";
    case "missing_in_system":
      return "Falta en sistema";
    case "extra_in_system":
      return "Extra en sistema";
    case "amount_mismatch":
      return "Diferencia de monto";
    case "tax_treatment_mismatch":
      return "Tratamiento fiscal distinto";
    case "pending_manual_adjustment":
      return "Ajuste externo pendiente";
    default:
      return value ? value.replace(/_/g, " ") : "Sin diferencia";
  }
}
