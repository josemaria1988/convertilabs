import { redirect } from "next/navigation";

type OrganizationOpenItemsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function OrganizationOpenItemsPage({
  params,
}: OrganizationOpenItemsPageProps) {
  const { slug } = await params;

  redirect(`/app/o/${slug}/documents`);
}
