import { redirect } from "next/navigation";
import { requirePrivateAppPage } from "@/modules/auth/server-auth";

export default async function TaxRedirectPage() {
  const authState = await requirePrivateAppPage("/tax");

  if (!authState.primaryOrganization) {
    redirect("/onboarding");
  }

  redirect(`/app/o/${authState.primaryOrganization.slug}/tax`);
}
