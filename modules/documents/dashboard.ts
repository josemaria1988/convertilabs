import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DashboardDocument = {
  id: string;
  originalFilename: string;
  status: string;
  createdAt: string;
  uploadedByDisplay: string;
};

export type DashboardDocumentsState =
  | {
      status: "error";
      documents: DashboardDocument[];
      totalDocuments: number;
      message: string;
    }
  | {
      status: "empty";
      documents: DashboardDocument[];
      totalDocuments: number;
    }
  | {
      status: "populated";
      documents: DashboardDocument[];
      totalDocuments: number;
    };

type DashboardDocumentRow = {
  id: string;
  original_filename: string;
  status: string;
  created_at: string;
  uploaded_by_display: string;
};

export async function loadOrganizationDashboardDocuments(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<DashboardDocumentsState> {
  const [{ count, error: countError }, { data, error }] = await Promise.all([
    supabase
      .from("documents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organizationId),
    supabase.rpc("list_dashboard_documents", {
      p_org_id: organizationId,
      p_limit: 12,
    }),
  ]);

  if (countError || error) {
    console.error("Failed to load dashboard documents.", countError ?? error);
    return {
      status: "error",
      documents: [],
      totalDocuments: 0,
      message: "No pudimos cargar los documentos de esta organizacion.",
    };
  }

  const rows = (data as DashboardDocumentRow[] | null) ?? [];
  const documents = rows.map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    status: row.status,
    createdAt: row.created_at,
    uploadedByDisplay: row.uploaded_by_display,
  }));
  const totalDocuments = count ?? documents.length;

  if (totalDocuments === 0) {
    return {
      status: "empty",
      documents: [],
      totalDocuments: 0,
    };
  }

  return {
    status: "populated",
    documents,
    totalDocuments,
  };
}
