import { redirect } from "next/navigation";

type OrganizationTesoreriaAliasPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function OrganizationTesoreriaAliasPage({
  params,
}: OrganizationTesoreriaAliasPageProps) {
  const { slug } = await params;

  redirect(`/app/o/${slug}/money`);
}
