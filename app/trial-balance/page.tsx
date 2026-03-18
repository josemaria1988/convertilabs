import { redirect } from "next/navigation";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export default async function TrialBalanceRedirectPage() {
  const authState = await requirePrivateAppPage("/trial-balance");

  if (!authState.primaryOrganization) {
    redirect("/onboarding");
  }

  redirect(`/app/o/${authState.primaryOrganization.slug}/trial-balance`);
}
