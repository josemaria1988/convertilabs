import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type PrimaryOrganization = {
  id: string;
  slug: string;
  name: string;
  role: string;
};

export type ServerAuthState = {
  user: User | null;
  hasMembership: boolean;
  primaryOrganization: PrimaryOrganization | null;
};

const disallowedNextPrefixes = [
  "/login",
  "/signup",
  "/logout",
  "/auth/confirm",
  "/onboarding",
];

type OrganizationMembershipRow = {
  role: string;
  organization:
    | {
        id: string;
        slug: string;
        name: string;
      }
    | {
        id: string;
        slug: string;
        name: string;
      }[]
    | null;
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
      }[]
    | null;
};

export function normalizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return null;
  }

  if (disallowedNextPrefixes.some((prefix) => nextPath.startsWith(prefix))) {
    return null;
  }

  return nextPath;
}

export async function getPrimaryOrganization(
  supabase: SupabaseClient,
  userId: string,
): Promise<PrimaryOrganization | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "role, created_at, organization:organizations!organization_members_organization_id_fkey(id, slug, name)",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const membershipRow = data as OrganizationMembershipRow | null;

  if (error) {
    console.error("Failed to load primary organization for authenticated user.", error);
    return null;
  }

  const organization = Array.isArray(membershipRow?.organization)
    ? membershipRow.organization[0]
    : membershipRow?.organization;

  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
    role: membershipRow?.role ?? "member",
  };
}

export async function getAuthStateForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<ServerAuthState> {
  const primaryOrganization = await getPrimaryOrganization(supabase, user.id);

  return {
    user,
    hasMembership: Boolean(primaryOrganization),
    primaryOrganization,
  };
}

export function resolvePostAuthDestination(
  authState: Pick<ServerAuthState, "hasMembership" | "primaryOrganization">,
  requestedNext?: string | null,
) {
  const safeNext = normalizeNextPath(requestedNext);

  if (!authState.hasMembership || !authState.primaryOrganization) {
    return "/onboarding";
  }

  return safeNext ?? resolveOrganizationDocumentsPath(authState.primaryOrganization.slug);
}

export function resolveOrganizationDocumentsPath(slug: string) {
  return `/app/o/${slug}/documents`;
}

export async function getServerAuthState(): Promise<ServerAuthState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      hasMembership: false,
      primaryOrganization: null,
    };
  }

  return getAuthStateForUser(supabase, user);
}

export async function redirectAuthenticatedUserFromPublicAuthPage(
  requestedNext?: string | null,
) {
  const authState = await getServerAuthState();

  if (authState.user) {
    redirect(resolvePostAuthDestination(authState, requestedNext));
  }
}

export async function requirePrivateAppPage(pathname: string) {
  const authState = await getServerAuthState();

  if (!authState.user) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (!authState.hasMembership) {
    redirect("/onboarding");
  }

  return authState;
}

export async function requireOnboardingPage() {
  const authState = await getServerAuthState();

  if (!authState.user) {
    redirect("/login?next=/onboarding");
  }

  if (authState.hasMembership) {
    redirect(resolvePostAuthDestination(authState));
  }

  return authState;
}

export async function requireOrganizationAppPage(
  slug: string,
  pathname = resolveOrganizationDocumentsPath(slug),
) {
  const authState = await requirePrivateAppPage(pathname);
  const user = authState.user;

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, organization_members!inner(role)")
    .eq("slug", slug)
    .eq("organization_members.user_id", user.id)
    .eq("organization_members.is_active", true)
    .limit(1)
    .maybeSingle();

  const organizationRow = data as OrganizationAccessRow | null;

  if (error) {
    console.error("Failed to resolve organization app context.", error);
  }

  if (!organizationRow) {
    notFound();
  }

  const membership = Array.isArray(organizationRow.organization_members)
    ? organizationRow.organization_members[0]
    : organizationRow.organization_members;

  return {
    authState,
    organization: {
      id: organizationRow.id,
      slug: organizationRow.slug,
      name: organizationRow.name,
      role: membership?.role ?? authState.primaryOrganization?.role ?? "member",
    },
  };
}

export async function requireOrganizationDashboardPage(slug: string) {
  return requireOrganizationAppPage(slug);
}
