import { redirect } from "next/navigation";

type OrganizationJournalEntriesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function OrganizationJournalEntriesPage({
  params,
}: OrganizationJournalEntriesPageProps) {
  const { slug } = await params;

  redirect(`/app/o/${slug}/documents`);
}
