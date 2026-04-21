import { normalizeTaxId } from "@/modules/accounting";
import type { ZetaCatalogRow, ZetaPurchaseExportBlocker } from "@/modules/integrations/zeta/export/types";

export type ZetaSupplierResolution = {
  found: boolean;
  zetaSupplierCode: string | null;
  zetaSupplierName: string | null;
  blockers: ZetaPurchaseExportBlocker[];
};

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function isInactive(value: unknown) {
  const raw = firstText(value)?.toLowerCase();

  return raw === "n" || raw === "no" || raw === "false" || raw === "0" || raw === "inactivo";
}

function isExplicitNonSupplier(value: unknown) {
  const raw = firstText(value)?.toLowerCase();

  return raw === "n" || raw === "no" || raw === "false" || raw === "0";
}

function supplierBlocker(name: string | null, rut: string | null): ZetaPurchaseExportBlocker {
  const label = [name, rut].filter(Boolean).join(" / ") || "sin nombre ni RUT";

  return {
    code: "zeta_supplier_missing",
    field: "supplier",
    message: `El proveedor ${label} no esta dado de alta en Zeta. Debe crearse primero en Zeta y luego sincronizar maestros.`,
  };
}

export function resolveZetaSupplier(input: {
  supplierRut: string | null;
  supplierName: string | null;
  contacts: ZetaCatalogRow[];
  supplierCommercialData?: ZetaCatalogRow[];
}): ZetaSupplierResolution {
  const normalizedRut = normalizeTaxId(input.supplierRut);
  const suppliersByCode = new Set(
    (input.supplierCommercialData ?? [])
      .map((row) => firstText(row.Codigo, row.ProveedorCodigo))
      .filter((value): value is string => Boolean(value)),
  );
  const byRut = normalizedRut
    ? input.contacts.find((row) => {
      if (isInactive(row.ContactoActivo) || isInactive(row.Activo)) {
        return false;
      }

      const candidateRut = normalizeTaxId(firstText(row.RUT, row.Documento, row.DocumentoNumero));

      if (candidateRut !== normalizedRut) {
        return false;
      }

      const code = firstText(row.Codigo, row.ProveedorCodigo);
      const hasSupplierEvidence = suppliersByCode.has(code ?? "")
        || !isExplicitNonSupplier(row.EsProveedor);

      return Boolean(code && hasSupplierEvidence);
    })
    : null;

  if (byRut) {
    return {
      found: true,
      zetaSupplierCode: firstText(byRut.Codigo, byRut.ProveedorCodigo),
      zetaSupplierName: firstText(byRut.Nombre, byRut.RazonSocial, input.supplierName),
      blockers: [],
    };
  }

  const normalizedName = input.supplierName?.trim().toLowerCase() ?? null;
  const byName = normalizedName
    ? input.contacts.find((row) => {
      if (isInactive(row.ContactoActivo) || isInactive(row.Activo)) {
        return false;
      }

      const code = firstText(row.Codigo, row.ProveedorCodigo);
      const candidateName = firstText(row.Nombre, row.RazonSocial)?.toLowerCase() ?? null;
      const hasSupplierEvidence = suppliersByCode.has(code ?? "")
        || !isExplicitNonSupplier(row.EsProveedor);

      return Boolean(code && hasSupplierEvidence && candidateName === normalizedName);
    })
    : null;

  if (byName) {
    return {
      found: true,
      zetaSupplierCode: firstText(byName.Codigo, byName.ProveedorCodigo),
      zetaSupplierName: firstText(byName.Nombre, byName.RazonSocial, input.supplierName),
      blockers: [],
    };
  }

  return {
    found: false,
    zetaSupplierCode: null,
    zetaSupplierName: null,
    blockers: [supplierBlocker(input.supplierName, input.supplierRut)],
  };
}

