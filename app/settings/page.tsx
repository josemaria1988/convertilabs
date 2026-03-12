import { redirect } from "next/navigation";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export default async function SettingsRedirectPage() {
  const authState = await requirePrivateAppPage("/settings");

  if (!authState.primaryOrganization) {
    redirect("/onboarding");
  }

  redirect(`/app/o/${authState.primaryOrganization.slug}/settings`);
}
