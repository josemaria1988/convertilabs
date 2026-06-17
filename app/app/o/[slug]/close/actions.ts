"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireOrganizationDashboardPage } from "@/modules/auth/server-auth";
import {
  runCloseValidator,
  transitionFiscalPeriodStatus,
} from "@/modules/close/service";
import { createCloseCheckTasks } from "@/modules/close/task-suggestions";
import type { CanonicalFiscalPeriodStatus } from "@/modules/accounting/fiscal-period-status";

function closePath(slug: string) {
  return `/app/o/${slug}/close`;
}

function canManageClose(role: string) {
  return ["owner", "admin", "accountant"].includes(role);
}

function revalidateCloseSurfaces(slug: string) {
  revalidatePath(`/app/o/${slug}`);
  revalidatePath(`/app/o/${slug}/agenda`);
  revalidatePath(closePath(slug));
  revalidatePath(`/app/o/${slug}/documents`);
  revalidatePath(`/app/o/${slug}/trial-balance`);
  revalidatePath(`/app/o/${slug}/tax`);
}

export async function runCloseValidatorAction(input: {
  slug: string;
  fiscalPeriodId: string;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canManageClose(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede ejecutar el close validator.",
    };
  }

  const result = await runCloseValidator(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    fiscalPeriodId: input.fiscalPeriodId,
    actorId: authState.user?.id ?? null,
  });
  const taskCount = await createCloseCheckTasks(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    fiscalPeriodId: input.fiscalPeriodId,
    periodCode: result.snapshot.period.code,
    actorId: authState.user?.id ?? null,
    closeCheckRun: result,
  });

  revalidateCloseSurfaces(input.slug);

  return {
    ok: true,
    message:
      result.blockerCount > 0
        ? `Validator ejecutado con ${result.blockerCount} blocker(s) y ${taskCount} tarea(s) sugerida(s).`
        : result.warningCount > 0
          ? `Validator ejecutado con ${result.warningCount} warning(s) y ${taskCount} tarea(s) sugerida(s).`
          : "Validator ejecutado sin blockers ni warnings.",
  };
}

export async function transitionFiscalPeriodStatusAction(input: {
  slug: string;
  fiscalPeriodId: string;
  nextStatus: CanonicalFiscalPeriodStatus;
  reasonCode?: string | null;
  reasonComment?: string | null;
}) {
  const { authState, organization } = await requireOrganizationDashboardPage(input.slug);

  if (!canManageClose(organization.role)) {
    return {
      ok: false,
      message: "Tu rol no puede transicionar estados de cierre.",
    };
  }

  await transitionFiscalPeriodStatus(getSupabaseServiceRoleClient(), {
    organizationId: organization.id,
    fiscalPeriodId: input.fiscalPeriodId,
    actorId: authState.user?.id ?? null,
    nextStatus: input.nextStatus,
    reasonCode: input.reasonCode ?? "close_cockpit_manual_transition",
    reasonComment: input.reasonComment ?? null,
  });

  revalidateCloseSurfaces(input.slug);

  return {
    ok: true,
    message: `Periodo actualizado a ${input.nextStatus}.`,
  };
}
