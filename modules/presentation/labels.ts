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

export function formatDocumentRoleLabel(value: string | null | undefined) {
  switch (value) {
    case "purchase":
      return "Compra";
    case "sale":
      return "Venta";
    case "other":
      return "Otro";
    default:
      return value ? value.replace(/_/g, " ") : "Sin rol";
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

export function formatOrganizationMatchStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "matched":
      return "Coincidencia confirmada";
    case "tentative":
      return "Coincidencia tentativa";
    case "not_matched":
      return "Sin coincidencia";
    case "ambiguous":
      return "Coincidencia ambigua";
    default:
      return value ? value.replace(/_/g, " ") : "Sin estado";
  }
}

export function formatOrganizationMatchStrategyLabel(value: string | null | undefined) {
  switch (value) {
    case "tax_id":
      return "RUT";
    case "exact_alias":
      return "Alias exacto";
    case "token_overlap":
      return "Coincidencia parcial de nombre";
    case "none":
      return "Sin estrategia";
    case "ambiguous":
      return "Estrategia ambigua";
    default:
      return value ? value.replace(/_/g, " ") : "Sin estrategia";
  }
}

export function formatOperationKindLabel(value: string | null | undefined) {
  switch (value) {
    case "sale_invoice":
      return "Factura de venta";
    case "purchase_invoice":
      return "Factura de compra";
    case "customer_receipt":
      return "Cobranza o recibo";
    case "supplier_payment":
      return "Pago a proveedor";
    case "sale_credit_note":
      return "Nota de credito de venta";
    case "purchase_credit_note":
      return "Nota de credito de compra";
    case "card_settlement":
      return "Liquidacion de tarjeta";
    case "bank_transfer_settlement":
      return "Liquidacion por transferencia";
    case "manual_settlement_adjustment":
      return "Ajuste manual de cobro o pago";
    default:
      return value ? value.replace(/_/g, " ") : "Sin operacion";
  }
}

export function formatPostingModeLabel(value: string | null | undefined) {
  switch (value) {
    case "provisional":
      return "Provisional";
    case "final":
      return "Final";
    default:
      return value ? value.replace(/_/g, " ") : "Sin modo";
  }
}

export function formatPaymentTermsLabel(value: string | null | undefined) {
  switch (value) {
    case "cash":
      return "Contado";
    case "credit":
      return "Credito";
    case "unknown":
      return "Sin definir";
    default:
      return value ? value.replace(/_/g, " ") : "Sin definir";
  }
}

export function formatRuleScopeLabel(value: string | null | undefined) {
  switch (value) {
    case "document_override":
      return "Override del documento";
    case "vendor_concept_operation_category":
      return "Proveedor + concepto + categoria";
    case "vendor_concept":
      return "Proveedor + concepto";
    case "concept_global":
      return "Concepto global";
    case "vendor_default":
      return "Default del proveedor";
    case "assistant":
      return "Sugerencia de IA";
    case "manual_review":
      return "Revision manual";
    default:
      return value ? value.replace(/_/g, " ") : "Sin alcance";
  }
}

export function formatSettlementMethodLabel(value: string | null | undefined) {
  switch (value) {
    case "cash":
      return "Caja o efectivo";
    case "bank_transfer":
      return "Banco o transferencia";
    case "card":
      return "Tarjeta";
    case "check":
      return "Cheque";
    case "mixed":
      return "Mixto";
    case "unknown":
      return "Sin definir";
    default:
      return value ? value.replace(/_/g, " ") : "Sin definir";
  }
}

export function formatSettlementEvidenceSourceLabel(value: string | null | undefined) {
  switch (value) {
    case "invoice_document":
      return "Surge del documento comercial";
    case "receipt_document":
      return "Surge de un recibo o comprobante de cobro/pago";
    case "bank_statement":
      return "Surge del estado de cuenta bancario";
    case "card_settlement_document":
      return "Surge de una liquidacion de tarjeta";
    case "user_input":
      return "Confirmado manualmente en la revision";
    case "imported_erp":
      return "Importado desde otro sistema";
    case "none":
      return "No surge del documento";
    default:
      return value ? value.replace(/_/g, " ") : "Sin evidencia";
  }
}

export function formatSettlementStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "not_applicable":
      return "No aplica";
    case "settled_on_document":
      return "Cobrado o pagado en el documento";
    case "open_receivable":
      return "Queda saldo a cobrar";
    case "open_payable":
      return "Queda saldo a pagar";
    case "pending_resolution":
      return "Pendiente de definir el medio real";
    case "pending_followup_event":
      return "Requiere registrar un movimiento posterior";
    case "resolved":
      return "Resuelto";
    default:
      return value ? value.replace(/_/g, " ") : "Sin estado";
  }
}

export function formatPostingTemplateCodeLabel(value: string | null | undefined) {
  switch (value) {
    case "sale_local_cash":
      return "Venta local contado";
    case "sale_local_credit":
      return "Venta local a credito";
    case "purchase_local_cash":
      return "Compra local contado";
    case "purchase_local_credit":
      return "Compra local a credito";
    case "customer_collection":
      return "Cobranza de cliente";
    case "supplier_payment":
      return "Pago a proveedor";
    case "sale_cash_unknown_clearing":
      return "Venta contado con medio a confirmar";
    case "purchase_cash_unknown_clearing":
      return "Compra contado con medio a confirmar";
    case "card_sale_clearing":
      return "Venta con tarjeta pendiente de liquidacion";
    case "card_settlement":
      return "Liquidacion de tarjeta";
    case "sale_export_cash":
      return "Venta de exportacion contado";
    case "sale_export_credit":
      return "Venta de exportacion a credito";
    default:
      return value ? value.replace(/_/g, " ") : "Sin plantilla";
  }
}

export function formatAccountRoleCodeLabel(value: string | null | undefined) {
  switch (value) {
    case "revenue_account":
      return "Cuenta principal de ingresos";
    case "expense_account":
      return "Cuenta principal de gastos";
    case "inventory_account":
      return "Cuenta principal de inventario";
    case "fixed_asset_account":
      return "Cuenta principal de activo";
    case "output_vat_account":
      return "Cuenta de IVA ventas";
    case "input_vat_account":
      return "Cuenta de IVA compras";
    case "accounts_receivable_account":
      return "Cuenta de clientes";
    case "accounts_payable_account":
      return "Cuenta de proveedores";
    case "cash_account":
      return "Cuenta de caja";
    case "bank_account":
      return "Cuenta bancaria";
    case "card_clearing_account":
      return "Cuenta de tarjetas a cobrar";
    case "check_clearing_account":
      return "Cuenta de cheques";
    case "cash_sales_unidentified_account":
      return "Cuenta provisoria para cobros a identificar";
    case "cash_purchases_unidentified_account":
      return "Cuenta provisoria para pagos a identificar";
    case "bank_fees_account":
      return "Cuenta de comisiones o gastos bancarios";
    case "fx_difference_account":
      return "Cuenta de diferencias de cambio";
    default:
      return value ? value.replace(/_/g, " ") : "Sin rol";
  }
}

export function formatVatBucketLabel(value: string | null | undefined) {
  switch (value) {
    case "input_creditable":
      return "IVA compras acreditable";
    case "input_non_deductible":
      return "IVA compras no deducible";
    case "input_exempt":
      return "Compra exenta o sin credito fiscal";
    case "output_vat":
      return "IVA ventas";
    default:
      return value ? value.replace(/_/g, " ") : "Manual";
  }
}

export function formatVatDeductibilityStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "full":
      return "Total";
    case "partial_prorrata":
      return "Parcial por prorrata";
    case "none":
      return "No deducible";
    case "pending_review":
      return "Pendiente de revision";
    default:
      return value ? value.replace(/_/g, " ") : "Sin definir";
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
    case "vendor_rule":
      return "Regla por proveedor";
    case "concept_rule":
      return "Regla por concepto";
    case "assistant":
      return "Asistente IA";
    case "manual_override":
      return "Override manual";
    case "imported":
      return "Importado";
    default:
      return value ? value.replace(/_/g, " ") : "Sin decision";
  }
}

export function formatDecisionRunTypeLabel(value: string | null | undefined) {
  switch (value) {
    case "document_intake":
      return "Extraccion documental";
    case "accounting_resolution":
      return "Resolucion contable";
    default:
      return value ? value.replace(/_/g, " ") : "Sin corrida";
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
