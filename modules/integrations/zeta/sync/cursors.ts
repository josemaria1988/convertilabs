import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  integrationTables,
  upsertIntegrationCursor,
} from "@/modules/integrations/repository";

type JsonRecord = Record<string, unknown>;

export type ZetaCursorStream =
  | "masters"
  | "accounting_masters"
  | "sales_documents"
  | "received_cfes";

export function buildZetaSyncCursorKey(input: {
  stream: ZetaCursorStream;
  period?: string | null;
}) {
  return input.period ? `${input.stream}:${input.period}` : input.stream;
}

export async function readZetaSyncCursor(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    stream: ZetaCursorStream;
    period?: string | null;
  },
) {
  const cursorKey = buildZetaSyncCursorKey({
    stream: input.stream,
    period: input.period,
  });
  const { data, error } = await supabase
    .from(integrationTables.syncCursors)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("provider", "zetasoftware")
    .eq("stream", input.stream)
    .eq("cursor_key", cursorKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as JsonRecord | null) ?? null;
}

export async function writeZetaSyncCursor(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    connectionId?: string | null;
    stream: ZetaCursorStream;
    period?: string | null;
    cursorValue?: string | null;
    cursor?: JsonRecord;
    lastSuccessRunId?: string | null;
    lastSyncedAt?: string | null;
  },
) {
  return upsertIntegrationCursor(supabase, {
    organizationId: input.organizationId,
    connectionId: input.connectionId ?? null,
    provider: "zetasoftware",
    stream: input.stream,
    cursorKey: buildZetaSyncCursorKey({
      stream: input.stream,
      period: input.period,
    }),
    cursorValue: input.cursorValue ?? null,
    cursor: input.cursor ?? {},
    lastSuccessRunId: input.lastSuccessRunId ?? null,
    lastSyncedAt: input.lastSyncedAt ?? null,
  });
}
