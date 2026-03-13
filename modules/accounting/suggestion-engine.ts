import { resolveUyVatTreatment } from "@/modules/tax/uy-vat-engine";
import type {
  AccountingSuggestionContext,
  DerivedDraftArtifacts,
  ReviewJournalLine,
  ReviewJournalSuggestion,
} from "@/modules/accounting/types";
import { roundCurrency } from "@/modules/accounting/normalization";

function buildJournalSuggestion(input: AccountingSuggestionContext) {
  const taxTreatment = resolveUyVatTreatment({
    documentRole: input.documentRole,
    facts: input.facts,
    amountBreakdown: input.amountBreakdown,
    operationCategory: input.operationCategory,
    profile: input.profile,
    ruleSnapshot: input.ruleSnapshot,
  });
  const journalSeed = taxTreatment.journalSeed;
  let journalSuggestion: ReviewJournalSuggestion;

  if (taxTreatment.ready && journalSeed) {
    if (input.documentRole === "purchase") {
      const lines: ReviewJournalLine[] = [
        {
          lineNumber: 1,
          accountCode: journalSeed.accountCode,
          accountName: journalSeed.accountName,
          debit:
            taxTreatment.vatBucket === "input_creditable"
              ? taxTreatment.taxableAmount
              : journalSeed.totalAmount,
          credit: 0,
          provenance: "uy_vat_engine",
        },
      ];

      if (taxTreatment.vatBucket === "input_creditable" && taxTreatment.taxAmount > 0) {
        lines.push({
          lineNumber: 2,
          accountCode: "1181",
          accountName: "IVA compras credito fiscal",
          debit: taxTreatment.taxAmount,
          credit: 0,
          provenance: "uy_vat_engine",
        });
      }

      lines.push({
        lineNumber: lines.length + 1,
        accountCode: journalSeed.counterpartyAccountCode,
        accountName: journalSeed.counterpartyAccountName,
        debit: 0,
        credit: journalSeed.totalAmount,
        provenance: "uy_vat_engine",
      });

      journalSuggestion = {
        ready: true,
        isBalanced: true,
        totalDebit: roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0)),
        totalCredit: roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0)),
        explanation: `Asiento sugerido desde motor IVA Uruguay para ${taxTreatment.label.toLowerCase()}.`,
        lines,
        blockingReasons: [],
      };
    } else if (input.documentRole === "sale") {
      const lines: ReviewJournalLine[] = [
        {
          lineNumber: 1,
          accountCode: journalSeed.counterpartyAccountCode,
          accountName: journalSeed.counterpartyAccountName,
          debit: journalSeed.totalAmount,
          credit: 0,
          provenance: "uy_vat_engine",
        },
        {
          lineNumber: 2,
          accountCode: journalSeed.accountCode,
          accountName: journalSeed.accountName,
          debit: 0,
          credit: taxTreatment.taxableAmount,
          provenance: "uy_vat_engine",
        },
      ];

      if (taxTreatment.taxAmount > 0) {
        lines.push({
          lineNumber: 3,
          accountCode: "2131",
          accountName: "IVA ventas debito fiscal",
          debit: 0,
          credit: taxTreatment.taxAmount,
          provenance: "uy_vat_engine",
        });
      }

      journalSuggestion = {
        ready: true,
        isBalanced: true,
        totalDebit: roundCurrency(lines.reduce((sum, line) => sum + line.debit, 0)),
        totalCredit: roundCurrency(lines.reduce((sum, line) => sum + line.credit, 0)),
        explanation: `Asiento sugerido desde motor IVA Uruguay para ${taxTreatment.label.toLowerCase()}.`,
        lines,
        blockingReasons: [],
      };
    } else {
      journalSuggestion = {
        ready: false,
        isBalanced: false,
        totalDebit: 0,
        totalCredit: 0,
        explanation: "No hay sugerencia contable automatica para documentos fuera de compra/venta en V1.",
        lines: [],
        blockingReasons: [...taxTreatment.blockingReasons],
      };
    }
  } else {
    journalSuggestion = {
      ready: false,
      isBalanced: false,
      totalDebit: 0,
      totalCredit: 0,
      explanation:
        "La sugerencia contable queda bloqueada hasta que el motor IVA deje el caso confirmable.",
      lines: [],
      blockingReasons: [...taxTreatment.blockingReasons],
    };
  }

  return {
    taxTreatment,
    journalSuggestion,
  };
}

export function buildAccountingDraftArtifacts(input: AccountingSuggestionContext) {
  const { taxTreatment, journalSuggestion } = buildJournalSuggestion(input);
  const blockers = [
    ...input.vendorResolution.blockingReasons,
    ...(input.invoiceIdentity?.blockingReasons ?? []),
    ...taxTreatment.blockingReasons,
    ...journalSuggestion.blockingReasons,
  ].filter((value, index, array) => array.indexOf(value) === index);

  return {
    taxTreatment,
    journalSuggestion,
    vendorResolution: input.vendorResolution,
    invoiceIdentity: input.invoiceIdentity,
    conceptResolution: input.conceptResolution,
    validation: {
      canConfirm:
        blockers.length === 0
        && journalSuggestion.isBalanced
        && journalSuggestion.totalDebit > 0,
      blockers,
    },
  } satisfies DerivedDraftArtifacts;
}
