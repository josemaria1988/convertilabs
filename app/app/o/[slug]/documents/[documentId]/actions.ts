"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  confirmDocumentReview,
  reopenDocumentReview,
  resolveDocumentDuplicate,
  saveDraftReview,
} from "@/modules/documents/review";

type SaveDraftPayload = Parameters<typeof saveDraftReview>[0]["payload"];

function buildPaths(slug: string, documentId: string) {
  return {
    dashboard: `/app/o/${slug}/dashboard`,
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

  revalidatePath(paths.dashboard);
  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}

export async function confirmDocumentReviewAction(input: {
  slug: string;
  documentId: string;
  learning?: {
    scope: "none" | "document_override" | "vendor_concept" | "concept_global" | "vendor_default";
    learnedConceptName: string | null;
  };
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);
  const role = organization.role;

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
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

  revalidatePath(paths.dashboard);
  revalidatePath(paths.documents);
  revalidatePath(paths.review);
  revalidatePath(paths.tax);
  revalidatePath(paths.journalEntries);

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

  if (!["owner", "admin", "accountant", "reviewer"].includes(role)) {
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

  revalidatePath(paths.dashboard);
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

  const result = await reopenDocumentReview({
    organizationId: organization.id,
    documentId: input.documentId,
    actorId: authState.user?.id ?? null,
  });
  const paths = buildPaths(input.slug, input.documentId);

  revalidatePath(paths.dashboard);
  revalidatePath(paths.documents);
  revalidatePath(paths.review);

  return result;
}
