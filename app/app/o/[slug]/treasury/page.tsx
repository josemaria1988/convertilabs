import { redirect } from "next/navigation";

type OrganizationTreasuryAliasPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function OrganizationTreasuryAliasPage({
  params,
}: OrganizationTreasuryAliasPageProps) {
  const { slug } = await params;

  redirect(`/app/o/${slug}/money`);
}
