"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingLink } from "@/components/ui/loading-link";
import type {
  AccountRoleCode,
  ManualAccountRoleOverrides,
} from "@/modules/accounting";
import type { DocumentReviewPageData } from "@/modules/documents/review";
import {
  formatAccountRoleCodeLabel,
  formatAccountTypeLabel,
} from "@/modules/presentation/labels";
import { confirmTaxWorkbenchManualAssignmentAction } from "./actions";

type TaxWorkbenchManualResolveModalProps = {
  slug: string;
  closeHref: string;
  reviewHref: string;
  title: string;
  subtitle: string;
  pageData: {
    documentId: string;
    accountRoleAssignments: DocumentReviewPageData["accountRoleAssignments"];
    accounts: DocumentReviewPageData["accountingOptions"]["accounts"];
    primaryAccountRole: AccountRoleCode | null;
    manualRoleOverrides: ManualAccountRoleOverrides | null;
    manualOverrideAccountId: string | null;
    currentMainAccount: string | null;
    currentVatAccount: string | null;
    isBalanced: boolean;
    totalDebit: number;
    totalCredit: number;
  };
};

type ManualRoleOverrideState = Partial<Record<AccountRoleCode, string>>;

function formatAmount(value: number | null | undefined) {
  return new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(typeof value === "number" ? value : 0);
}

function normalizeAccountType(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isAccountCompatibleWithRole(
  account: Pick<TaxWorkbenchManualResolveModalProps["pageData"]["accounts"][number], "accountType">,
  roleCode: AccountRoleCode | null,
) {
  const accountType = normalizeAccountType(account.accountType);

  switch (roleCode) {
    case "revenue_account":
      return accountType === "revenue" || accountType === "income";
    case "expense_account":
      return accountType === "expense";
    case "inventory_account":
    case "fixed_asset_account":
    case "accounts_receivable_account":
    case "cash_account":
    case "bank_account":
    case "card_clearing_account":
    case "check_clearing_account":
    case "cash_sales_unidentified_account":
    case "input_vat_account":
      return accountType === "asset";
    case "accounts_payable_account":
    case "output_vat_account":
    case "cash_purchases_unidentified_account":
      return accountType === "liability";
    case "bank_fees_account":
      return accountType === "expense";
    case "fx_difference_account":
      return true;
    default:
      return true;
  }
}

function buildInitialManualRoleOverrides(
  pageData: TaxWorkbenchManualResolveModalProps["pageData"],
): ManualRoleOverrideState {
  const storedOverrides = pageData.manualRoleOverrides ?? {};
  const next: ManualRoleOverrideState = {};

  for (const assignment of pageData.accountRoleAssignments) {
    next[assignment.roleCode] = storedOverrides[assignment.roleCode] ?? "";
  }

  if (
    pageData.primaryAccountRole
    && !next[pageData.primaryAccountRole]
    && pageData.manualOverrideAccountId
  ) {
    next[pageData.primaryAccountRole] = pageData.manualOverrideAccountId;
  }

  return next;
}

function formatEffectiveAccountLabel(input: {
  assignment: TaxWorkbenchManualResolveModalProps["pageData"]["accountRoleAssignments"][number];
  overrideAccountId: string;
  accounts: TaxWorkbenchManualResolveModalProps["pageData"]["accounts"];
}) {
  const effectiveAccountId = input.overrideAccountId || input.assignment.accountId || "";
  const effectiveAccount = effectiveAccountId
    ? input.accounts.find((account) => account.id === effectiveAccountId) ?? null
    : null;

  if (effectiveAccount) {
    return `${effectiveAccount.code} - ${effectiveAccount.name}`;
  }

  if (input.overrideAccountId) {
    return "Cuenta no disponible";
  }

  return input.assignment.accountLabel ?? "Sin cuenta resuelta";
}

export function TaxWorkbenchManualResolveModal({
  slug,
  closeHref,
  reviewHref,
  title,
  subtitle,
  pageData,
}: TaxWorkbenchManualResolveModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [manualRoleOverrides, setManualRoleOverrides] = useState<ManualRoleOverrideState>(() =>
    buildInitialManualRoleOverrides(pageData));

  const roleAssignments = useMemo(() =>
    pageData.accountRoleAssignments.map((assignment) => {
      const overrideAccountId = manualRoleOverrides[assignment.roleCode]?.trim() || "";
      const compatibleAccounts = pageData.accounts.filter((account) =>
        isAccountCompatibleWithRole(account, assignment.roleCode));

      return {
        assignment,
        overrideAccountId,
        compatibleAccounts,
        effectiveLabel: formatEffectiveAccountLabel({
          assignment,
          overrideAccountId,
          accounts: pageData.accounts,
        }),
      };
    }), [manualRoleOverrides, pageData]);

  const primaryRoleAssignment = pageData.primaryAccountRole
    ? roleAssignments.find((assignment) => assignment.assignment.roleCode === pageData.primaryAccountRole) ?? null
    : roleAssignments.find((assignment) => assignment.assignment.linePurpose === "main") ?? null;
  const manualAssignmentReady = Boolean(
    (primaryRoleAssignment?.overrideAccountId || primaryRoleAssignment?.assignment.accountId)?.trim(),
  );

  function handleConfirm() {
    setMessage("Guardando correccion manual...");

    startTransition(async () => {
      try {
        const result = await confirmTaxWorkbenchManualAssignmentAction({
          slug,
          documentId: pageData.documentId,
          manualRoleOverrides: Object.fromEntries(
            Object.entries(manualRoleOverrides).map(([roleCode, accountId]) => [
              roleCode,
              accountId?.trim() || null,
            ]),
          ) as ManualAccountRoleOverrides,
        });

        setMessage(result.message);

        if (result.ok) {
          router.push(closeHref);
          router.refresh();
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No pudimos confirmar la correccion manual.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[950] bg-[rgba(17,24,39,0.78)] px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tax-workbench-manual-resolve-title"
        className="mx-auto flex max-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-[color:var(--color-border)] bg-[rgba(23,31,45,0.98)] shadow-[0_32px_90px_rgba(0,0,0,0.35)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--color-border)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              Resolver manualmente desde impuestos
            </p>
            <h3 id="tax-workbench-manual-resolve-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
              Corregir asiento contable
            </h3>
            <p className="mt-2 text-sm text-[color:var(--color-muted)]">{title}</p>
            <p className="mt-1 text-sm text-[color:var(--color-muted)]">{subtitle}</p>
          </div>
          <LoadingLink
            href={closeHref}
            pendingLabel="Cerrando..."
            className="ui-button ui-button--secondary min-h-[34px] px-4 text-[13px]"
          >
            Cerrar
          </LoadingLink>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                <p className="text-sm font-semibold text-white">Elegir cuentas por rol</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                  Esta correccion sirve para ajustar la cuenta principal, IVA y contrapartidas del
                  asiento sin salir del periodo fiscal. La correccion profunda y la creacion de
                  reglas reusables siguen viviendo en la revision completa.
                </p>

                <div className="mt-4 space-y-4">
                  {roleAssignments.map((roleAssignment) => (
                    <div
                      key={roleAssignment.assignment.roleCode}
                      className="rounded-2xl border border-[color:var(--color-border)] bg-white/6 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {formatAccountRoleCodeLabel(roleAssignment.assignment.roleCode)}
                          </p>
                          <p className="mt-1 text-[13px] text-[color:var(--color-muted)]">
                            Cuenta efectiva actual: {roleAssignment.effectiveLabel}
                          </p>
                        </div>
                        <span className="status-pill status-pill--info">
                          {roleAssignment.assignment.linePurpose ?? "linea"}
                        </span>
                      </div>

                      <label className="mt-3 block space-y-2 text-sm">
                        <span className="font-medium text-white">Cuenta a usar</span>
                        <select
                          value={roleAssignment.overrideAccountId}
                          onChange={(event) => {
                            setManualRoleOverrides((current) => ({
                              ...current,
                              [roleAssignment.assignment.roleCode]: event.target.value,
                            }));
                          }}
                          className="w-full rounded-[12px] border border-[color:var(--color-border)] bg-[rgba(53,63,82,0.42)] px-3 py-2 text-[14px] text-white outline-none"
                        >
                          <option value="">Usar cuenta actual del asiento</option>
                          {roleAssignment.compatibleAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                              {account.isProvisional ? " (provisoria)" : ""}
                              {" "}· {formatAccountTypeLabel(account.accountType)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                <p className="text-sm font-semibold text-white">Preview actual</p>
                <div className="mt-3 space-y-2 text-sm text-[color:var(--color-muted)]">
                  <div className="ui-subtle-row">
                    <span>Cuenta principal</span>
                    <span>{pageData.currentMainAccount ?? "Sin cuenta principal"}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Cuenta IVA</span>
                    <span>{pageData.currentVatAccount ?? "Sin cuenta IVA"}</span>
                  </div>
                  <div className="ui-subtle-row">
                    <span>Balance</span>
                    <span>
                      {pageData.isBalanced ? "Balanceado" : "Desbalanceado"} · Debe {formatAmount(pageData.totalDebit)} / Haber {formatAmount(pageData.totalCredit)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 p-4">
                <p className="text-sm font-semibold text-white">Que hace confirmar</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
                  Guarda las cuentas seleccionadas como resolucion manual del documento, recalcula
                  blockers dependientes de baja confianza IA y deja trazabilidad auditada.
                </p>
              </div>

              {message ? (
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-4 py-3 text-sm text-[color:var(--color-muted)]">
                  {message}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--color-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <LoadingLink
                href={reviewHref}
                pendingLabel="Abriendo..."
                className="ui-button ui-button--secondary"
              >
                Abrir revision completa
              </LoadingLink>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                Abre la revision del documento para crear reglas que mejoren el aprendizaje del sistema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <LoadingLink
                href={closeHref}
                pendingLabel="Cerrando..."
                className="ui-button ui-button--secondary"
              >
                Cancelar
              </LoadingLink>
              <button
                type="button"
                disabled={!manualAssignmentReady || isPending}
                onClick={handleConfirm}
                className="ui-button ui-button--primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
