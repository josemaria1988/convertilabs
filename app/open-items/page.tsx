import { redirect } from "next/navigation";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export default async function OpenItemsRedirectPage() {
  const authState = await requirePrivateAppPage("/open-items");

  if (!authState.primaryOrganization) {
    redirect("/onboarding");
  }

  redirect(`/app/o/${authState.primaryOrganization.slug}/open-items`);
}
