import { normalizeTaxId } from "@/modules/accounting";
import {
  asRecord,
  firstNumber,
  firstString,
  parseZetaDate,
  type JsonRecord,
  type ZetaCanonicalDocument,
} from "@/modules/integrations/zeta/normalizers/common";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function externalKeyFromRaw(raw: JsonRecord, fallbackPrefix: string) {
  return firstString(raw.Codigo, raw.CodigoContacto, raw.Id, raw.RUT)
    ?? `${fallbackPrefix}:sin-codigo`;
}

function zetaCostCenterCode(workUnit: {
  externalCode?: string | null;
  code?: string | null;
  metadata?: JsonRecord | null;
} | null | undefined) {
  const metadata = asRecord(workUnit?.metadata);

  return compactText(workUnit?.externalCode)
    ?? firstString(
      metadata.zeta_cost_center_code,
      metadata.zeta_centro_costo_codigo,
      metadata.cost_center_external_code,
      metadata.external_code,
    )
    ?? compactText(workUnit?.code);
}

export function buildZetaContactPartyDraft(input: {
  organizationId: string;
  raw: JsonRecord;
}) {
  const raw = input.raw;
  const externalKey = externalKeyFromRaw(raw, "contact");
  const taxId = firstString(raw.RUT, raw.Ruc, raw.Documento);

  return {
    party: {
      organization_id: input.organizationId,
      display_name: firstString(raw.Nombre, raw.RazonSocial, raw.NombreFantasia) ?? externalKey,
      legal_name: firstString(raw.RazonSocial, raw.Nombre),
      tax_id: taxId,
      source: "zetasoftware",
      status: "active",
      metadata_json: {
        zeta_external_key: externalKey,
        zeta_raw_entity_type: "contact",
      },
    },
    identifier: taxId
      ? {
        organization_id: input.organizationId,
        identifier_type: "rut",
        identifier_value: taxId,
        normalized_value: normalizeTaxId(taxId),
        metadata_json: {
          provider: "zetasoftware",
          external_key: externalKey,
        },
      }
      : null,
    integrationLink: {
      organizationId: input.organizationId,
      provider: "zetasoftware",
      externalEntityType: "contact",
      externalKey,
      localEntityType: "party",
      matchMethod: taxId ? "rut" : "external_key",
      confidence: taxId ? 0.98 : 0.82,
    },
  };
}

export function buildZetaCostCenterWorkUnitDraft(input: {
  organizationId: string;
  raw: JsonRecord;
}) {
  const raw = input.raw;
  const externalKey = externalKeyFromRaw(raw, "cost_center");
  const code = firstString(raw.Codigo, raw.CentroCostoCodigo, raw.CodigoCentroCosto) ?? externalKey;

  return {
    workUnit: {
      organization_id: input.organizationId,
      code,
      name: firstString(raw.Nombre, raw.Descripcion) ?? code,
      kind: "cost_center",
      status: firstString(raw.Activo) === "N" ? "archived" : "active",
      source: "zetasoftware",
      metadata_json: {
        zeta_external_key: externalKey,
        zeta_cost_center_code: code,
        zeta_raw_entity_type: "cost_center",
      },
    },
    integrationLink: {
      organizationId: input.organizationId,
      provider: "zetasoftware",
      externalEntityType: "cost_center",
      externalKey,
      localEntityType: "work_unit",
      matchMethod: "zeta_cost_center_code",
      confidence: 0.96,
    },
  };
}

export function buildZetaCfeDocumentDraft(input: {
  organizationId: string;
  document: ZetaCanonicalDocument;
  rawRecordId?: string | null;
}) {
  return {
    document: {
      organization_id: input.organizationId,
      direction: input.document.documentRole,
      document_type: input.document.documentType,
      source_type: "zeta_api",
      source_reference: input.document.externalKey,
      external_reference: input.document.humanKey,
      document_date: input.document.issueDate,
      document_currency_code: input.document.currency.currencyCode,
      document_net_amount_original: input.document.amounts.net,
      document_tax_amount_original: input.document.amounts.tax,
      document_total_amount_original: input.document.amounts.total,
      metadata: {
        integration_provider: "zetasoftware",
        integration_raw_record_id: input.rawRecordId ?? null,
        zeta_source_kind: input.document.sourceKind,
        zeta_payload_hash: input.document.payloadHash,
        zeta_cost_center_external_code: input.document.costCenterExternalCode,
      },
    },
    sourceRef: {
      organization_id: input.organizationId,
      provider: "zetasoftware",
      source_kind: input.document.sourceKind,
      external_key: input.document.externalKey,
      external_version_key: input.document.payloadHash,
      raw_record_id: input.rawRecordId ?? null,
      current_payload_hash: input.document.payloadHash,
      factual_trust_mode: "external_deterministic",
    },
  };
}

export function buildZetaJournalExportPayload(input: {
  reference: string;
  date: string;
  concept: string;
  workUnit?: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    externalCode?: string | null;
    metadata?: JsonRecord | null;
  } | null;
  lines: Array<{
    accountCode: string;
    debit?: number | null;
    credit?: number | null;
    description?: string | null;
  }>;
}) {
  const centroCostos = zetaCostCenterCode(input.workUnit);

  return {
    Data: {
      Asientos: [
        {
          Fecha: parseZetaDate(input.date) ?? input.date,
          Concepto: input.concept,
          Referencia: input.reference,
          Lineas: input.lines.map((line, index) => ({
            Renglon: index + 1,
            Cuenta: line.accountCode,
            Debe: firstNumber(line.debit) ?? 0,
            Haber: firstNumber(line.credit) ?? 0,
            Descripcion: compactText(line.description) ?? input.concept,
            CentroCostos: centroCostos ?? undefined,
          })),
        },
      ],
    },
  };
}
