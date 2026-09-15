import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { planAgendaPush, type AgendaTask, type AgendaObligation, type AgendaOccurrence, type PushEvent } from "./agenda";
import { addDays, isPushEndpoint, localDay, type BrowserSubscription, type VapidConfig } from "./validation";

export type PushPayload = { title: string; body: string; url: string; tag: string };
export type PushTransport = (subscription: BrowserSubscription, payload: PushPayload, config: VapidConfig) => Promise<{ statusCode: number }>;
export const sendWebPush: PushTransport = (subscription, payload, config) => webpush.sendNotification(subscription, JSON.stringify(payload), {
  vapidDetails: config, TTL: 60 * 60 * 12, urgency: "normal", timeout: 5000,
  topic: payload.tag.slice(0, 32),
});
type SubscriptionRow = { id: string; organization_id: string; user_id: string; device_id: string };
type Claim = { delivery_id: string; endpoint: string; p256dh: string; auth_key: string };
export type DeliveryResult = "accepted" | "already_attempted" | "failed" | "expired" | "unknown";

// Claim is committed before network I/O. Uncertain outcomes are never retried:
// Web Push has no end-to-end idempotency acknowledgement from the phone.
export async function deliverPush(input: { supabase: SupabaseClient; subscriptionId: string; event: PushEvent; day: string;
  slug: string; config: VapidConfig; transport?: PushTransport }): Promise<DeliveryResult> {
  const { data, error } = await input.supabase.rpc("claim_agenda_push_delivery", {
    p_subscription_id: input.subscriptionId, p_event_key: input.event.key, p_source_type: input.event.sourceType,
    p_source_id: input.event.sourceId, p_source_due_date: input.event.sourceDueDate,
    p_reminder_date: input.day, p_vapid_public_key: input.config.publicKey,
  });
  if (error) throw new Error("push_claim_failed");
  const claim = (data as Claim[] | null)?.[0];
  if (!claim) return "already_attempted";
  let result: Exclude<DeliveryResult, "already_attempted"> = "unknown";
  let status: number | null = null;
  let code = "network_outcome_unknown";
  if (!isPushEndpoint(claim.endpoint)) { result = "failed"; code = "endpoint_rejected"; }
  else {
    try {
      const response = await (input.transport ?? sendWebPush)({ endpoint: claim.endpoint, keys: { p256dh: claim.p256dh, auth: claim.auth_key } }, {
        title: input.event.title, body: input.event.body, url: `/app/o/${input.slug}/agenda`, tag: input.event.key,
      }, input.config);
      status = response.statusCode;
      result = status >= 200 && status < 300 ? "accepted" : status === 404 || status === 410 ? "expired" : "failed";
      code = result === "accepted" ? "provider_accepted" : "provider_rejected";
    } catch (error) {
      const candidate = error && typeof error === "object" && "statusCode" in error ? (error as { statusCode: unknown }).statusCode : null;
      status = typeof candidate === "number" && candidate >= 100 && candidate <= 599 ? candidate : null;
      if (status) { result = status === 404 || status === 410 ? "expired" : "failed"; code = "provider_rejected"; }
      // Do not persist provider bodies, URLs, key material or arbitrary error text.
    }
  }
  const finished = await input.supabase.rpc("finish_agenda_push_delivery", {
    p_delivery_id: claim.delivery_id, p_status: result, p_provider_status: status, p_result_code: code,
  });
  if (finished.error) throw new Error("push_result_record_failed");
  return result;
}

// Explicit paging avoids silently missing rows past PostgREST's default page limit.
async function allRows<T>(load: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await load(offset, offset + 499);
    if (error) throw new Error("push_source_read_failed");
    rows.push(...(data ?? []) as T[]);
    if (!data || data.length < 500) return rows;
    if (offset >= 100000) throw new Error("push_source_limit_exceeded");
  }
}
export async function dispatchAgendaPush(input: { supabase: SupabaseClient; config: VapidConfig; now?: Date; transport?: PushTransport }) {
  const day = localDay(input.now); const maturity = addDays(day, 2);
  const subscriptions = await allRows<SubscriptionRow>((from, to) => input.supabase.from("web_push_subscriptions")
    .select("id,organization_id,user_id,device_id").eq("enabled", true).eq("vapid_public_key", input.config.publicKey).order("id").range(from, to));
  const summary = { day, organizations: 0, candidates: 0, accepted: 0, already_attempted: 0, failed: 0, expired: 0, unknown: 0, errors: 0 };
  for (const organizationId of new Set(subscriptions.map((row) => row.organization_id))) {
    const org = await input.supabase.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
    if (org.error || !org.data || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(org.data.slug)) { summary.errors++; continue; }
    const slug: string = org.data.slug;
    summary.organizations++;
    const [tasks, obligations, occurrences] = await Promise.all([
      allRows<AgendaTask>((from, to) => input.supabase.from("tasks").select("id,title,status,due_date,party_id,metadata_json").eq("organization_id", organizationId).eq("due_date", day).order("id").range(from, to)),
      allRows<AgendaObligation>((from, to) => input.supabase.from("obligations").select("id,title,status,frequency,next_due_date,party_id,metadata_json").eq("organization_id", organizationId).order("id").range(from, to)),
      allRows<AgendaOccurrence>((from, to) => input.supabase.from("obligation_occurrences").select("id,obligation_id,due_date,status,task_id").eq("organization_id", organizationId).eq("due_date", maturity).order("id").range(from, to)),
    ]);
    const events = planAgendaPush({ day, tasks, obligations, occurrences }); summary.candidates += events.length;
    const pending = subscriptions.filter((row) => row.organization_id === organizationId)
      .flatMap((subscription) => events.map((event) => ({ subscription, event })));
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (index < pending.length) {
        const job = pending[index++];
        try {
          const result = await deliverPush({ ...input, day, slug, subscriptionId: job.subscription.id, event: job.event });
          summary[result]++;
        } catch { summary.errors++; }
      }
    }));
  }
  return summary;
}
