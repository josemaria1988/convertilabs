"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import { activateOrganizationProfileVersion } from "@/modules/organizations/settings";

export async function activateOrganizationProfileVersionAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const { authState, organization } = await requireOrganizationDashboardPage(slug);

  if (!["owner", "admin", "accountant", "reviewer"].includes(organization.role)) {
    throw new Error("Tu rol no puede activar versiones de perfil.");
  }

  await activateOrganizationProfileVersion({
    organizationId: organization.id,
    actorId: authState.user?.id ?? null,
    legalEntityType: String(formData.get("legalEntityType") ?? "").trim().toUpperCase(),
    taxId: String(formData.get("taxId") ?? "").replace(/\D+/g, ""),
    taxRegimeCode: String(formData.get("taxRegimeCode") ?? "").trim().toUpperCase(),
    vatRegime: String(formData.get("vatRegime") ?? "").trim().toUpperCase(),
    dgiGroup: String(formData.get("dgiGroup") ?? "").trim().toUpperCase(),
    cfeStatus: String(formData.get("cfeStatus") ?? "").trim().toUpperCase(),
    effectiveFrom: String(formData.get("effectiveFrom") ?? "").trim(),
    changeReason: String(formData.get("changeReason") ?? "").trim(),
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/dashboard`);
}
