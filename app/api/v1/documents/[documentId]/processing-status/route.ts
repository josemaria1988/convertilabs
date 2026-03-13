import { NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { loadDocumentProcessingStatus } from "@/modules/documents/processing";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

type OrganizationAccessRow = {
  slug: string;
  organization_members:
    | {
        role: string;
      }
    | {
        role: string;
      }[]
    | null;
};

export async function GET(_request: Request, context: RouteContext) {
  const { documentId } = await context.params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "unauthenticated",
          message: "Debes iniciar sesion para consultar el estado del documento.",
        },
      },
      { status: 401 },
    );
  }

  const supabaseAdmin = getSupabaseServiceRoleClient();
  const { data: documentRow, error: documentError } = await supabaseAdmin
    .from("documents")
    .select("id, organization_id")
    .eq("id", documentId)
    .limit(1)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json(
      {
        error: {
          code: "document_lookup_failed",
          message: documentError.message,
        },
      },
      { status: 500 },
    );
  }

  if (!documentRow) {
    return NextResponse.json(
      {
        error: {
          code: "not_found",
          message: "Documento no encontrado.",
        },
      },
      { status: 404 },
    );
  }

  const { data: organizationAccess, error: organizationError } = await supabase
    .from("organizations")
    .select("slug, organization_members!inner(role)")
    .eq("id", documentRow.organization_id)
    .eq("organization_members.user_id", user.id)
    .eq("organization_members.is_active", true)
    .limit(1)
    .maybeSingle();

  const organization = organizationAccess as OrganizationAccessRow | null;

  if (organizationError) {
    return NextResponse.json(
      {
        error: {
          code: "organization_lookup_failed",
          message: organizationError.message,
        },
      },
      { status: 500 },
    );
  }

  if (!organization?.slug) {
    return NextResponse.json(
      {
        error: {
          code: "forbidden",
          message: "No tienes acceso a este documento.",
        },
      },
      { status: 403 },
    );
  }

  const status = await loadDocumentProcessingStatus({
    documentId,
    organizationSlug: organization.slug,
  });

  if (!status) {
    return NextResponse.json(
      {
        error: {
          code: "not_found",
          message: "Documento no encontrado.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: status,
  });
}
