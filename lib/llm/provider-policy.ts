import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

// Follows asynchronous work, including secondary AI calls.
const paidAIPolicy = new AsyncLocalStorage<{ disabled: boolean }>();

export class PaidAIDisabledError extends Error {
  readonly code = "paid_ai_disabled";
  constructor() {
    super("La API paga de OpenAI está deshabilitada para este flujo. Usá Codex local o seleccioná explícitamente el proveedor API.");
    this.name = "PaidAIDisabledError";
  }
}

export function isPaidAIAllowed() {
  const provider = process.env.CONVERTILABS_PROCESSING_PROVIDER?.trim();
  const disabled = process.env.CONVERTILABS_DISABLE_PAID_AI?.trim();
  return !paidAIPolicy.getStore()?.disabled
    && (provider === undefined || provider === "openai")
    && disabled !== "true"
    && disabled !== "1";
}

export function assertPaidAIAllowed() {
  if (!isPaidAIAllowed()) throw new PaidAIDisabledError();
}

export function withPaidAIDisabled<T>(work: () => Promise<T>): Promise<T> {
  return paidAIPolicy.run({ disabled: true }, work);
}

/** Local documents must not acquire paid review side effects in the cloud. */
export async function isPaidAIAllowedForDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string,
) {
  if (!isPaidAIAllowed()) return false;
  try {
    const { data, error } = await supabase.from("documents")
      .select("metadata").eq("organization_id", organizationId).eq("id", documentId).maybeSingle();
    if (error || !data) return false;
    const provider = data.metadata?.processing_provider;
    return provider === undefined || provider === null || provider === "openai";
  } catch {
    return false;
  }
}
