"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ManualAccountRoleOverrides } from "@/modules/accounting";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { approveDocumentLearning } from "@/modules/accounting/learning-approval-service";
import { runDocumentClassification } from "@/modules/accounting/classification-runner";
import {
  refreshDocumentAssistantAnalysis,
  resolveDocumentAssistantSuggestion,
} from "@/modules/assistant/document-assistant";
import { confirmDocumentFinal } from "@/modules/documents/confirm-final-service";
import { postDocumentProvisional } from "@/modules/documents/post-provisional-service";
import { reopenDocumentForRemap } from "@/modules/documents/reopen-remap-service";
import {
  confirmDocumentManualAssignment,
  confirmDocumentReview,
  createDocumentReviewOverrideAccount,
  resolveDocumentDuplicate,
  saveDraftReview,
  loadDocumentReviewPageData,
} from "@/modules/documents/review";

type SaveDraftPayload = Parameters<typeof saveDraftReview>[0]["payload"];

function buildPaths(slug: string, documentId: string) {
  return {
    documents: `/app/o/${slug}/documents`,
    review: `/app/o/${slug}/documents/${documentId}`,
    tax: `/app/o/${slug}/tax`,
    journalEntries: `/app/o/${slug}/journal-entries`,
  };
}

export async function saveDocumentDraftReviewAction(input: {
  slug: string;
  documentId: string;
  stepCode:
    | "identity"
    | "fields"
    | "amounts"
    | "operation_context"
    | "accounting_context";
  payload: SaveDraftPayload;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (organization.role === "viewer") {
    return {
      ok: false,
      status: "blocked",
      blockers: ["Tu rol solo puede ver este draft."],
    };
  }

  const result = await saveDraftReview({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    stepCode: input.stepCode,
    payload: input.payload,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function confirmDocumentReviewAction(input: {
  slug: string;
  documentId: string;
  learning?: {
    scope: "none" | "document_override" | "vendor_concept_operation_category" | "vendor_concept" | "concept_global" | "vendor_default";
    learnedConceptName: string | null;
  };
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede confirmar este documento.",
    };
  }

  const result = await confirmDocumentReview({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    learning: input.learning,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);
  revalidatePath(paths.tax);
  revalidatePath(paths.journalEntries);

  return result;
}

export async function confirmDocumentManualAssignmentAction(input: {
  slug: string;
  documentId: string;
  manualRoleOverrides?: ManualAccountRoleOverrides | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede confirmar asignaciones manuales.",
    };
  }

  const result = await confirmDocumentManualAssignment({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    manualRoleOverrides: input.manualRoleOverrides ?? null,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);
  revalidatePath(paths.tax);

  return result;
}

export async function postProvisionalDocumentReviewAction(input: {
  slug: string;
  documentId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede postear este documento en modo provisional.",
    };
  }

  const result = await postDocumentProvisional({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);
  revalidatePath(paths.tax);
  revalidatePath(paths.journalEntries);

  return result;
}

export async function confirmFinalDocumentReviewAction(input: {
  slug: string;
  documentId: string;
  learning?: {
    scope: "none" | "document_override" | "vendor_concept_operation_category" | "vendor_concept" | "concept_global" | "vendor_default";
    learnedConceptName: string | null;
  };
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede confirmar este documento.",
    };
  }

  const result = await confirmDocumentFinal({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    learning: input.learning,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);
  revalidatePath(paths.tax);
  revalidatePath(paths.journalEntries);

  return result;
}

export async function createDocumentReviewOverrideAccountAction(input: {
  slug: string;
  documentId: string;
  code: string;
  name: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (organization.role === "viewer") {
    return {
      ok: false,
      message: "Tu rol solo puede ver este draft.",
      account: null,
    };
  }

  const result = await createDocumentReviewOverrideAccount({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    code: input.code,
    name: input.name,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function resolveDocumentDuplicateAction(input: {
  slug: string;
  documentId: string;
  action: "confirmed_duplicate" | "false_positive" | "justified_non_duplicate";
  note: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede resolver duplicados documentales.",
    };
  }

  const result = await resolveDocumentDuplicate({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    action: input.action,
    note: input.note,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function reopenDocumentReviewAction(input: {
  slug: string;
  documentId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin"].includes(role)) {
    return {
      ok: false,
      message: "Solo owner y admin pueden reabrir revisiones.",
    };
  }

  const result = await reopenDocumentForRemap({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function runDocumentClassificationAction(input: {
  slug: string;
  documentId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede ejecutar clasificacion contable.",
    };
  }

  const result = await runDocumentClassification({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return {
    ok: result.ok,
    message: result.message,
  };
}

export async function saveDocumentLearningRuleAction(input: {
  slug: string;
  documentId: string;
  learning: {
    scope: "none" | "document_override" | "vendor_concept_operation_category" | "vendor_concept" | "concept_global" | "vendor_default";
    learnedConceptName: string | null;
  };
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede guardar criterios reusables.",
      ruleId: null,
    };
  }

  const result = await approveDocumentLearning({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    learning: input.learning,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function refreshDocumentAssistantAction(input: {
  slug: string;
  documentId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede actualizar el analisis del Asistente Contable.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  const pageData = await loadDocumentReviewPageData({
    organizationId: organization.id,
    organizationSlug: organization.slug,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
    userRole: organization.role as
      | "owner"
      | "admin"
      | "admin_processing"
      | "accountant"
      | "reviewer"
      | "operator"
      | "viewer"
      | "developer",
  });
  const result = await refreshDocumentAssistantAnalysis(supabase, {
    organizationId: organization.id,
    userRole: organization.role as
      | "owner"
      | "admin"
      | "admin_processing"
      | "accountant"
      | "reviewer"
      | "operator"
      | "viewer"
      | "developer",
    actorId: authState.user?.id ?? null,
    document: {
      id: pageData.document.id,
      status: pageData.document.status,
      postingStatus: pageData.document.postingStatus,
      originalFilename: pageData.document.originalFilename,
    },
    draft: {
      id: pageData.draft.id,
      revisionNumber: pageData.draft.revisionNumber,
      status: pageData.draft.status,
      documentRole: pageData.draft.documentRole,
      documentType: pageData.draft.documentType,
    },
    facts: pageData.draft.facts,
    derived: pageData.derived,
    workflowState: pageData.workflowState,
    latestClassificationRun: pageData.latestClassificationRun,
    learningSuggestions: pageData.learningSuggestions,
    accountRoleAssignments: pageData.accountRoleAssignments,
    certaintyConfidence: pageData.certaintySummary.confidence,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function resolveDocumentAssistantSuggestionAction(input: {
  slug: string;
  documentId: string;
  suggestionId: string;
  resolutionStatus: "accepted" | "rejected" | "edited";
  execute?: boolean;
  resolutionComment?: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "admin_processing", "accountant", "reviewer"].includes(role)) {
    return {
      ok: false,
      message: "Tu rol no puede resolver sugerencias del Asistente Contable.",
    };
  }

  const supabase = getSupabaseServiceRoleClient();
  const resolution = await resolveDocumentAssistantSuggestion(supabase, {
    organizationId: organization.id,
    suggestionId: input.suggestionId,
    actorId: authState.user?.id ?? null,
    resolutionStatus: input.resolutionStatus,
    resolutionComment: input.resolutionComment ?? null,
  });

  if (
    resolution.ok
    && input.execute
    && input.resolutionStatus === "accepted"
    && resolution.actionKind === "run_classification"
  ) {
    await runDocumentClassification({
      organizationId: organization.id,
      documentId: input.documentId,
      actorId: authState.user?.id ?? null,
    });
  }

  if (
    resolution.ok
    && input.execute
    && input.resolutionStatus === "accepted"
    && resolution.actionKind === "post_provisional"
  ) {
    await postDocumentProvisional({
      organizationId: organization.id,
      documentId: input.documentId,
      actorId: authState.user?.id ?? null,
    });
  }

  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.documents);
  revalidatePath(paths.review);
  revalidatePath(paths.tax);
  revalidatePath(paths.journalEntries);

  return resolution;
}
