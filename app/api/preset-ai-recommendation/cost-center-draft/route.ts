import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  loadPresetAiRunForUser,
  markPresetAiCostCenterDraftSaved,
  toPresetAiRunSummary,
} from "@/modules/accounting/presets/ai-recommendation";
import { getOrganizationFeatureFlags } from "@/modules/organizations/feature-flags";

type DraftRequestBody = {
  runId?: string;
};

async function parseBody(request: Request) {
  try {
    return await request.json() as DraftRequestBody;
  } catch {
    return null;
  }
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
        message: "Debes iniciar sesion para guardar este borrador.",
      },
      { status: 401 },
    );
  }

  const body = await parseBody(request);
  const runId = String(body?.runId ?? "").trim();

  if (!runId) {
    return NextResponse.json(
      {
        message: "Falta la corrida IA que quieres guardar como borrador.",
      },
      { status: 400 },
    );
  }

  const serviceRole = getSupabaseServiceRoleClient();
  const existingRun = await loadPresetAiRunForUser(serviceRole, {
    runId,
    requestedBy: user.id,
  });

  if (!existingRun) {
    return NextResponse.json(
      {
        message: "No encontramos esa corrida IA para tu usuario.",
      },
      { status: 404 },
    );
  }

  const updated = await markPresetAiCostCenterDraftSaved(serviceRole, {
    runId,
    requestedBy: user.id,
  });

  return NextResponse.json({
    run: toPresetAiRunSummary(updated),
  });
}
