import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  buildPresetAiSettingsOrganizationContext,
  buildPresetAiInputHash,
  buildPresetAiInputSnapshot,
  buildPresetAiRouteResponse,
  createPresetAiRunRecord,
  derivePresetHybridRecommendation,
  enforcePresetAiRateLimit,
  hashIpAddress,
  resolvePresetAiRecommendation,
} from "@/modules/accounting/presets/ai-recommendation";
import { buildPresetRecommendation } from "@/modules/accounting/presets/recommendation-engine";
import {
  applyActivityRecommendationToProfile,
  resolveActivitySelectionWithAi,
} from "@/modules/organizations/activity-ai-selection";
import { getOrganizationFeatureFlags } from "@/modules/organizations/feature-flags";

type RecommendationRequestBody = {
  scope?: "onboarding" | "settings";
  slug?: string;
  organizationContext?: {
    organizationName?: string | null;
    legalEntityType?: string | null;
    taxId?: string | null;
    taxRegimeCode?: string | null;
    vatRegime?: string | null;
    dgiGroup?: string | null;
    cfeStatus?: string | null;
  };
  profile?: {
    primaryActivityCode?: string;
    secondaryActivityCodes?: string[];
    selectedTraits?: string[];
    shortDescription?: string | null;
  };
};

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return headerStore.get("x-real-ip")
    ?? headerStore.get("cf-connecting-ip")
    ?? null;
}

async function parseBody(request: Request) {
  try {
    return await request.json() as RecommendationRequestBody;
  } catch {
    return null;
  }
}

async function resolveSettingsOrganization(input: {
  slug: string;
  userId: string;
}) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, legal_entity_type, tax_id, tax_regime_code, vat_regime, dgi_group, cfe_status, organization_members!inner(role)")
    .eq("slug", input.slug)
    .eq("organization_members.user_id", input.userId)
    .eq("organization_members.is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const membership = Array.isArray(data.organization_members)
    ? data.organization_members[0]
    : data.organization_members;
  const role = membership?.role ?? "member";

  if (!["owner", "admin", "accountant"].includes(role)) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    organizationName: data.name,
    legalEntityType: data.legal_entity_type,
    taxId: data.tax_id,
    taxRegimeCode: data.tax_regime_code,
    vatRegime: data.vat_regime,
    dgiGroup: data.dgi_group,
    cfeStatus: data.cfe_status,
  };
}

export async function POST(request: Request) {
  const featureFlags = getOrganizationFeatureFlags();

  if (!featureFlags.presetAiRecommendationEnabled) {
    return NextResponse.json(
      {
        message: "La recomendacion IA esta desactivada en este entorno.",
      },
      { status: 403 },
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        message: "Debes iniciar sesion para consultar la recomendacion IA.",
      },
      { status: 401 },
    );
  }

  const body = await parseBody(request);

  if (!body?.profile) {
    return NextResponse.json(
      {
        message: "Falta el perfil de negocio para consultar la recomendacion IA.",
      },
      { status: 400 },
    );
  }

  const profile = {
    primaryActivityCode: String(body.profile.primaryActivityCode ?? "").trim(),
    secondaryActivityCodes: parseStringArray(body.profile.secondaryActivityCodes),
    selectedTraits: parseStringArray(body.profile.selectedTraits),
    shortDescription: typeof body.profile.shortDescription === "string"
      ? body.profile.shortDescription
      : null,
  };

  if ((!profile.primaryActivityCode && !profile.shortDescription?.trim()) || profile.selectedTraits.length === 0) {
    return NextResponse.json(
      {
        message: "Completa una descripcion del negocio o una actividad principal, y al menos un rasgo antes de consultar la IA.",
      },
      { status: 400 },
    );
  }

  const headerStore = await headers();
  const ipHash = hashIpAddress(getClientIp(headerStore));
  const serviceRole = getSupabaseServiceRoleClient();
  const rateLimit = await enforcePresetAiRateLimit(serviceRole, {
    requestedBy: user.id,
    ipHash,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      {
        message: "Llegaste al limite temporal de consultas IA. Intenta de nuevo en unos minutos.",
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
      },
    );
  }

  let organizationContext = body.organizationContext ?? {};
  let organizationId: string | null = null;

  if (body.scope === "settings") {
    const slug = String(body.slug ?? "").trim();

    if (!slug) {
      return NextResponse.json(
        {
          message: "Falta la organizacion para consultar la recomendacion IA en settings.",
        },
        { status: 400 },
      );
    }

    const organization = await resolveSettingsOrganization({
      slug,
      userId: user.id,
    });

    if (!organization) {
      return NextResponse.json(
        {
          message: "No tienes acceso a esta organizacion para consultar la IA.",
        },
        { status: 403 },
      );
    }

    organizationId = organization.id;
    organizationContext = buildPresetAiSettingsOrganizationContext({
      organizationId: organization.id,
      slug: organization.slug,
      organizationName: organization.organizationName,
      legalEntityType: organization.legalEntityType,
      taxId: organization.taxId,
      taxRegimeCode: organization.taxRegimeCode,
      vatRegime: organization.vatRegime,
      dgiGroup: organization.dgiGroup,
      cfeStatus: organization.cfeStatus,
    });
  }

  const activitySelectionAttempt = await resolveActivitySelectionWithAi({
    profile,
  });
  const resolvedProfile = applyActivityRecommendationToProfile({
    profile,
    activityRecommendation: activitySelectionAttempt.output,
  });

  if (!resolvedProfile.primaryActivityCode) {
    return NextResponse.json(
      {
        message: activitySelectionAttempt.failureMessage
          ?? "No pudimos determinar una actividad principal CIIU valida con la informacion disponible.",
      },
      { status: 400 },
    );
  }

  const recommendation = buildPresetRecommendation(resolvedProfile);
  const inputHash = buildPresetAiInputHash({
    scope: body.scope === "settings" ? "settings" : "onboarding",
    organizationContext,
    profile: resolvedProfile,
    recommendation,
  });
  const inputSnapshot = buildPresetAiInputSnapshot({
    scope: body.scope === "settings" ? "settings" : "onboarding",
    organizationContext,
    profile: resolvedProfile,
    recommendation,
  });
  const aiAttempt = await resolvePresetAiRecommendation({
    scope: body.scope === "settings" ? "settings" : "onboarding",
    organizationContext,
    profile: resolvedProfile,
    recommendation,
  });
  const storedAiAttempt = {
    ...aiAttempt,
    requestPayload: {
      ...aiAttempt.requestPayload,
      requestedProfile: profile,
      resolvedProfile,
      activitySelection: {
        status: activitySelectionAttempt.status,
        output: activitySelectionAttempt.output,
        requestPayload: activitySelectionAttempt.requestPayload,
        failureMessage: activitySelectionAttempt.failureMessage,
      },
    },
    responsePayload: {
      activitySelection: activitySelectionAttempt.responsePayload,
      presetRecommendation: aiAttempt.responsePayload,
    },
  };
  const runId = await createPresetAiRunRecord(serviceRole, {
    organizationId,
    businessProfileVersionId: null,
    requestedBy: user.id,
    requestOrigin: body.scope === "settings" ? "settings" : "onboarding",
    ipHash,
    inputHash,
    inputSnapshot,
    recommendation,
    aiAttempt: storedAiAttempt,
  });

  if (aiAttempt.status !== "completed" || !aiAttempt.output) {
    return NextResponse.json(
      {
        message: aiAttempt.failureMessage ?? "La IA no pudo devolver una recomendacion utilizable.",
        runId,
      },
      { status: 503 },
    );
  }

  const hybridRecommendation = derivePresetHybridRecommendation({
    recommendation,
    aiOutput: aiAttempt.output,
    runId,
    inputHash,
    costCenterDraftSaved: false,
  });

  return NextResponse.json(
    buildPresetAiRouteResponse({
      runId,
      inputHash,
      resolvedProfile,
      activityRecommendation: activitySelectionAttempt.output,
      recommendation,
      aiOutput: aiAttempt.output,
      hybridRecommendation,
    }),
  );
}
