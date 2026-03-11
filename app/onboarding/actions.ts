"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAuthStateForUser,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";
import type { OnboardingActionState } from "@/modules/organizations/onboarding-action-state";
import {
  validateOrganizationOnboardingInput,
} from "@/modules/organizations/onboarding-schema";

type CreateOrganizationRpcResult = {
  organization_id: string;
  slug: string;
};

function buildActionError(
  message: string,
  fieldErrors = {},
): OnboardingActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function mapCreateOrganizationError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("already belongs to an active organization")) {
    return buildActionError(
      "Tu cuenta ya tiene una organizacion activa. Redirigiendo al espacio privado si corresponde.",
    );
  }

  if (
    normalizedMessage.includes("at least 2 characters")
    || normalizedMessage.includes("at most 120 characters")
    || normalizedMessage.includes("include letters or numbers")
  ) {
    return buildActionError(
      "Revisa el nombre de la organizacion antes de continuar.",
      {
        name: "El nombre debe ser valido para generar un slug estable.",
      },
    );
  }

  return buildActionError(
    "No se pudo crear la organizacion en este momento. Intenta de nuevo.",
  );
}

export async function createOrganizationAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const validation = validateOrganizationOnboardingInput({
    name: String(formData.get("name") ?? ""),
  });

  if (!validation.success) {
    return buildActionError(
      "Revisa el nombre de la organizacion antes de continuar.",
      validation.errors,
    );
  }

  const authState = await getAuthStateForUser(supabase, user);

  if (authState.primaryOrganization) {
    redirect(resolvePostAuthDestination(authState));
  }

  const rpcResult = await supabase
    .rpc("create_organization_with_owner", {
      p_name: validation.data.name,
    })
    .single();

  const data = rpcResult.data as CreateOrganizationRpcResult | null;

  if (rpcResult.error || !data?.slug) {
    const refreshedAuthState = await getAuthStateForUser(supabase, user);

    if (refreshedAuthState.primaryOrganization) {
      redirect(resolvePostAuthDestination(refreshedAuthState));
    }

    return mapCreateOrganizationError(
      rpcResult.error?.message ?? "Unknown create organization error.",
    );
  }

  revalidatePath("/app");
  revalidatePath("/onboarding");
  redirect(`/app/o/${data.slug}/dashboard`);
}
