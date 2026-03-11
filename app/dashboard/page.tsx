import { redirect } from "next/navigation";
import {
  requirePrivateAppPage,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";

export default async function LegacyDashboardPage() {
  const authState = await requirePrivateAppPage("/dashboard");

  redirect(resolvePostAuthDestination(authState));
}
