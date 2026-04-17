import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const metadata: Metadata = {
  title: "Inicio",
};

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;

  await requireOrganizationDashboardPage(slug);
  redirect(`/app/o/${slug}/documents`);
}
