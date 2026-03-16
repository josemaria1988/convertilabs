import { redirect } from "next/navigation";

type OrganizationDashboardPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function OrganizationDashboardPage({
  params,
}: OrganizationDashboardPageProps) {
  const { slug } = await params;

  redirect(`/app/o/${slug}/documents`);
}
