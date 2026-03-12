import { redirect } from "next/navigation";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export default async function DocumentsRedirectPage() {
  const authState = await requirePrivateAppPage("/documents");

  if (!authState.primaryOrganization) {
    redirect("/onboarding");
  }

  redirect(`/app/o/${authState.primaryOrganization.slug}/documents`);
}
