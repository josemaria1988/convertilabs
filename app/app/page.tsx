import { redirect } from "next/navigation";
import {
  getServerAuthState,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";

export default async function AppEntryPage() {
  const authState = await getServerAuthState();

  if (!authState.user) {
    redirect("/login?next=/app");
  }

  redirect(resolvePostAuthDestination(authState));
}
