import { redirect } from "next/navigation";
import {
  getServerAuthState,
  resolveOrganizationFieldPath,
} from "@/modules/auth/server-auth";

export default async function MobileEntryPage() {
  const authState = await getServerAuthState();

  if (!authState.user) {
    redirect("/login?next=/mobile");
  }

  if (!authState.hasMembership || !authState.primaryOrganization) {
    redirect("/onboarding?next=/mobile");
  }

  redirect(resolveOrganizationFieldPath(authState.primaryOrganization.slug));
}
