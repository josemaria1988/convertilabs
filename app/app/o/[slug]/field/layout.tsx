import type { ReactNode } from "react";
import { FieldExperienceFrame } from "@/components/mobile/field-experience-frame";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";

type OrganizationFieldLayoutProps = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export default async function OrganizationFieldLayout({
  children,
  params,
}: OrganizationFieldLayoutProps) {
  const { slug } = await params;
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  return (
    <FieldExperienceFrame
      organizationName={organization.name}
      organizationSlug={organization.slug}
      userId={authState.user?.id ?? null}
    >
      {children}
    </FieldExperienceFrame>
  );
}
