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

function supplierAmbiguousBlocker(input: {
  name: string | null;
  rut: string | null;
  matchedBy: "rut" | "name";
  candidateCodes: string[];
}): ZetaPurchaseExportBlocker {
  const matchLabel = input.matchedBy === "rut"
    ? `el RUT ${input.rut ?? "informado"}`
    : `el nombre ${input.name ?? "informado"}`;

  return {
    code: "supplier_ambiguous",
    field: "supplier",
    message: `Hay ${input.candidateCodes.length} proveedores activos en Zeta que coinciden con ${matchLabel} (${input.candidateCodes.join(", ")}). Seleccione el proveedor correcto o corrija sus datos antes de exportar.`,
  };
}

function normalizeSupplierCode(value: string) {
  return value.toLowerCase();
}

function supplierCandidates(input: {
  contacts: ZetaCatalogRow[];
  suppliersByCode: Set<string>;
  matches: (row: ZetaCatalogRow) => boolean;
}) {
  const uniqueByCode = new Map<string, ZetaCatalogRow>();

  for (const row of input.contacts) {
    if (isInactive(row.ContactoActivo) || isInactive(row.Activo)) {
      continue;
    }

    const code = firstText(row.Codigo, row.ProveedorCodigo);
    const hasSupplierEvidence = code
      ? input.suppliersByCode.has(normalizeSupplierCode(code)) || !isExplicitNonSupplier(row.EsProveedor)
      : false;

    if (!code || !hasSupplierEvidence || !input.matches(row)) {
      continue;
    }

    const normalizedCode = normalizeSupplierCode(code);

    if (!uniqueByCode.has(normalizedCode)) {
      uniqueByCode.set(normalizedCode, row);
    }
  }

  return Array.from(uniqueByCode.values());
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
      .filter((value): value is string => Boolean(value))
      .map(normalizeSupplierCode),
  );
  const byRut = normalizedRut
    ? supplierCandidates({
      contacts: input.contacts,
      suppliersByCode,
      matches: (row) => {
        const candidateRut = normalizeTaxId(firstText(row.RUT, row.Documento, row.DocumentoNumero));

        return candidateRut === normalizedRut;
      },
    })
    : [];

  if (byRut.length > 1) {
    return {
      found: false,
      zetaSupplierCode: null,
      zetaSupplierName: null,
      blockers: [supplierAmbiguousBlocker({
        name: input.supplierName,
        rut: input.supplierRut,
        matchedBy: "rut",
        candidateCodes: byRut
          .map((row) => firstText(row.Codigo, row.ProveedorCodigo))
          .filter((value): value is string => Boolean(value)),
      })],
    };
  }

  if (byRut.length === 1) {
    const supplier = byRut[0];

    return {
      found: true,
      zetaSupplierCode: firstText(supplier.Codigo, supplier.ProveedorCodigo),
      zetaSupplierName: firstText(supplier.Nombre, supplier.RazonSocial, input.supplierName),
      blockers: [],
    };
  }

  // A supplied fiscal identifier is authoritative. Falling back to a matching
  // name after a RUT miss could silently select a different legal supplier.
  if (normalizedRut) {
    return {
      found: false,
      zetaSupplierCode: null,
      zetaSupplierName: null,
      blockers: [supplierBlocker(input.supplierName, input.supplierRut)],
    };
  }

  const normalizedName = input.supplierName?.trim().toLowerCase() ?? null;
  const byName = normalizedName
    ? supplierCandidates({
      contacts: input.contacts,
      suppliersByCode,
      matches: (row) => {
        const candidateName = firstText(row.Nombre, row.RazonSocial)?.toLowerCase() ?? null;

        return candidateName === normalizedName;
      },
    })
    : [];

  if (byName.length > 1) {
    return {
      found: false,
      zetaSupplierCode: null,
      zetaSupplierName: null,
      blockers: [supplierAmbiguousBlocker({
        name: input.supplierName,
        rut: input.supplierRut,
        matchedBy: "name",
        candidateCodes: byName
          .map((row) => firstText(row.Codigo, row.ProveedorCodigo))
          .filter((value): value is string => Boolean(value)),
      })],
    };
  }

  if (byName.length === 1) {
    const supplier = byName[0];

    return {
      found: true,
      zetaSupplierCode: firstText(supplier.Codigo, supplier.ProveedorCodigo),
      zetaSupplierName: firstText(supplier.Nombre, supplier.RazonSocial, input.supplierName),
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

