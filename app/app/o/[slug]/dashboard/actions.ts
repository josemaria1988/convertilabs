"use server";

export {
  failDocumentUploadAction as failDashboardDocumentUpload,
  finalizeDocumentUploadAction as finalizeDashboardDocumentUpload,
  prepareDocumentUploadAction as prepareDashboardDocumentUpload,
} from "@/app/app/o/[slug]/documents/actions";
