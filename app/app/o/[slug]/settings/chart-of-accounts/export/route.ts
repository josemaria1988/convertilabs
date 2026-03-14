import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildOrganizationChartCsv,
  loadOrganizationChartManagementData,
} from "@/modules/accounting/chart-admin";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

type OrganizationAccessRow = {
  id: string;
  slug: string;
  name: string;
  organization_members:
    | {
        role: string;
      }
    | {
        role: string;
      }[] | null;
};

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "organizacion";
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      error: {
        code: "unauthenticated",
        message: "Debes iniciar sesion para exportar el plan de cuentas.",
      },
    }, { status: 401 });
  }

  const { data: organizationAccess, error } = await supabase
    .from("organizations")
    .select("id, slug, name, organization_members!inner(role)")
    .eq("slug", slug)
    .eq("organization_members.user_id", user.id)
    .eq("organization_members.is_active", true)
    .limit(1)
    .maybeSingle();

  const organization = organizationAccess as OrganizationAccessRow | null;

  if (error) {
    return NextResponse.json({
      error: {
        code: "organization_lookup_failed",
        message: error.message,
      },
    }, { status: 500 });
  }

  if (!organization?.id) {
    return NextResponse.json({
      error: {
        code: "forbidden",
        message: "No tienes acceso a esta organizacion.",
      },
    }, { status: 403 });
  }

  const chart = await loadOrganizationChartManagementData(organization.id);
  const csv = buildOrganizationChartCsv(chart.accounts);
  const fileName = `${sanitizeFilename(organization.slug)}-chart-of-accounts.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      "Cache-Control": "no-store",
    },
  });
}
