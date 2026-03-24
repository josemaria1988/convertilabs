"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationAppPage } from "@/modules/auth/server-auth";
import {
  pauseAccountingRule,
  reactivateAccountingRule,
} from "@/modules/accounting/rules-admin";

function assertAccountingRulesManagerRole(role: string) {
  if (!["owner", "admin", "accountant"].includes(role)) {
    throw new Error("Tu rol no puede administrar reglas contables.");
  }
}

function buildRulesAdminPath(slug: string, ruleId: string) {
  const params = new URLSearchParams();
  params.set("status", "all");
  params.set("rule", ruleId);
  return `/app/o/${slug}/settings/accounting-rules?${params.toString()}`;
}

export async function pauseAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/settings/accounting-rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  await pauseAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    reason: String(formData.get("reason") ?? ""),
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/settings/accounting-rules`);
  redirect(buildRulesAdminPath(organization.slug, ruleId));
}

export async function reactivateAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/settings/accounting-rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  await reactivateAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    reason: String(formData.get("reason") ?? ""),
  });

  revalidatePath(`/app/o/${organization.slug}/settings`);
  revalidatePath(`/app/o/${organization.slug}/settings/accounting-rules`);
  redirect(buildRulesAdminPath(organization.slug, ruleId));
}
