import { redirect } from "next/navigation";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export default async function JournalEntriesRedirectPage() {
  const authState = await requirePrivateAppPage("/journal-entries");

  if (!authState.primaryOrganization) {
    redirect("/onboarding");
  }

  redirect(`/app/o/${authState.primaryOrganization.slug}/journal-entries`);
}
