import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isMissingSupabaseRelationError } from "@/lib/supabase/schema-compat";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  fingerprintIntegrationPayload,
  upsertIntegrationRawRecord,
} from "@/modules/integrations/repository";
import {
  buildRontilWebWorkIntakeInput,
  compactText,
  normalizeAmount,
  normalizeCurrencyCode,
  validateRontilWebWorkIntakePayload,
} from "@/modules/work-intake";
import { createOrReuseWorkIntakeItem } from "@/modules/work-intake";

type JsonRecord = Record<string, unknown>;

type WebhookSubscriptionRow = {
  id: string;
  organization_id: string;
  events: string[] | null;
  is_active: boolean | null;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);

  return compactText(bearerMatch?.[1])
    ?? compactText(request.headers.get("x-convertilabs-token"))
    ?? compactText(request.headers.get("x-rontil-web-token"));
}

function secretHashCandidates(token: string) {
  const hex = createHash("sha256").update(token, "utf8").digest("hex");

  return [`sha256:${hex}`, hex];
}

function canReceiveWorkIntake(events: string[] | null) {
  if (!events || events.length === 0) {
    return true;
  }

  return events.includes("*")
    || events.includes("work_intake.created")
    || events.includes("work_intake.received")
    || events.includes("rontil_web.work_intake");
}

async function findWebhookSubscription(token: string) {
  const supabase = getSupabaseServiceRoleClient();

  for (const secretHash of secretHashCandidates(token)) {
    const { data, error } = await supabase
      .from("webhook_subscriptions")
      .select("id, organization_id, events, is_active")
      .eq("secret_hash", secretHash)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingSupabaseRelationError(error, "webhook_subscriptions")) {
        return {
          subscription: null,
          missingTable: true,
        };
      }

      throw new Error(error.message);
    }

    if (data) {
      return {
        subscription: data as WebhookSubscriptionRow,
        missingTable: false,
      };
    }
  }

  return {
    subscription: null,
    missingTable: false,
  };
}

function externalKeyFromPayload(payload: JsonRecord, idempotencyKey: string | null) {
  return compactText(payload.quote_id ?? payload.quoteId ?? payload.id)
    ?? idempotencyKey
    ?? fingerprintIntegrationPayload(payload);
}

export async function POST(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return jsonError(401, "missing_token", "Falta token Bearer o header x-convertilabs-token.");
  }

  const subscriptionLookup = await findWebhookSubscription(token);

  if (subscriptionLookup.missingTable) {
    return jsonError(503, "integration_schema_missing", "webhook_subscriptions no esta disponible.");
  }

  if (!subscriptionLookup.subscription) {
    return jsonError(401, "invalid_token", "Token de integracion invalido.");
  }

  if (!canReceiveWorkIntake(subscriptionLookup.subscription.events)) {
    return jsonError(403, "event_not_allowed", "El token no permite crear work intake.");
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "El cuerpo de la solicitud debe ser JSON valido.");
  }

  const validation = validateRontilWebWorkIntakePayload(payload);

  if (!validation.ok) {
    return jsonError(400, validation.code, validation.message);
  }

  const supabase = getSupabaseServiceRoleClient();
  const idempotencyKey = compactText(request.headers.get("idempotency-key"))
    ?? compactText(validation.payload.idempotency_key ?? validation.payload.idempotencyKey)
    ?? compactText(validation.payload.quote_id ?? validation.payload.quoteId);
  const externalKey = externalKeyFromPayload(validation.payload, idempotencyKey);
  const sourceAmount = normalizeAmount(
    validation.payload.total
      ?? validation.payload.amount
      ?? validation.payload.estimated_amount,
  );
  const currencyCode = normalizeCurrencyCode(validation.payload.currency ?? validation.payload.moneda);
  let rawRecord: JsonRecord;

  try {
    rawRecord = await upsertIntegrationRawRecord(supabase, {
      organizationId: subscriptionLookup.subscription.organization_id,
      provider: "rontil_web",
      stream: "work_intake",
      entityType: "work_intake_request",
      externalKey,
      payload: validation.payload,
      payloadHash: fingerprintIntegrationPayload(validation.payload),
      currencyCode,
      sourceTotalAmount: sourceAmount,
      metadata: {
        webhook_subscription_id: subscriptionLookup.subscription.id,
        payload_version: compactText(validation.payload.payload_version ?? validation.payload.version) ?? "1",
      },
    });
  } catch (error) {
    const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string };

    if (isMissingSupabaseRelationError(supabaseError, "integration_raw_records")) {
      return jsonError(503, "integration_schema_missing", "integration_raw_records no esta disponible.");
    }

    throw error;
  }

  const rawRecordId = typeof rawRecord.id === "string" ? rawRecord.id : null;
  let result: Awaited<ReturnType<typeof createOrReuseWorkIntakeItem>>;

  try {
    result = await createOrReuseWorkIntakeItem(supabase, buildRontilWebWorkIntakeInput({
      organizationId: subscriptionLookup.subscription.organization_id,
      payload: validation.payload,
      integrationRawRecordId: rawRecordId,
      idempotencyKey,
    }));
  } catch (error) {
    const supabaseError = error as { code?: string; message?: string; details?: string; hint?: string };

    if (isMissingSupabaseRelationError(supabaseError, "work_intake_items")) {
      return jsonError(503, "intake_schema_missing", "work_intake_items no esta disponible.");
    }

    throw error;
  }

  return NextResponse.json(
    {
      data: {
        status: result.created ? "created" : "duplicate",
        work_intake_item_id: result.id,
        integration_raw_record_id: rawRecordId,
      },
    },
    { status: result.created ? 201 : 200 },
  );
}
