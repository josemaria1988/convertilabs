import { redirect } from "next/navigation";

type LegacyOriginalDocumentPageProps = {
  params: Promise<{
    slug: string;
    documentId: string;
  }>;
};

export default async function LegacyOriginalDocumentPage({
  params,
}: LegacyOriginalDocumentPageProps) {
  const { slug, documentId } = await params;

  redirect(`/app/o/${slug}/documents/${documentId}`);
}
