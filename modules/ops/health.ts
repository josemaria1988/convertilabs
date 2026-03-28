import packageJson from "@/package.json";
import {
  getInngestConfigStatus,
  getOpenAIConfigStatus,
  getSupabaseConfigStatus,
} from "@/lib/env";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type HealthMode = "liveness" | "readiness";
export type ReadinessStatus = "ok" | "degraded" | "failed";
export type DependencyVerification = "not_performed";
export type DatabaseReadinessStatus = "ok" | "missing_config" | "failed";

export type BuildMetadata = {
  version: string | null;
  commitSha: string | null;
  buildTimestamp: string | null;
};

export type DatabaseReadinessCheck = {
  status: DatabaseReadinessStatus;
  required: true;
  checkedAt: string;
  latencyMs: number | null;
  detail: string;
};

type SupabaseConfigStatus = ReturnType<typeof getSupabaseConfigStatus>;
type OpenAIConfigStatus = ReturnType<typeof getOpenAIConfigStatus>;
type InngestConfigStatus = ReturnType<typeof getInngestConfigStatus>;

export type LivenessPayload = {
  name: "convertilabs";
  mode: "liveness";
  kind: "config";
  status: "ok";
  timestamp: string;
  build: BuildMetadata;
  links: {
    ready: "/api/ready";
  };
  services: {
    supabase: SupabaseConfigStatus;
    openai: OpenAIConfigStatus & {
      verification: DependencyVerification;
      lastVerifiedAt: null;
    };
    inngest: InngestConfigStatus & {
      verification: DependencyVerification;
      lastVerifiedAt: null;
    };
  };
};

export type ReadinessPayload = {
  name: "convertilabs";
  mode: "readiness";
  status: ReadinessStatus;
  ready: boolean;
  timestamp: string;
  build: BuildMetadata;
  dependencies: {
    supabase: SupabaseConfigStatus & {
      status: "ok" | "missing_config";
      required: true;
    };
    database: DatabaseReadinessCheck;
    openai: OpenAIConfigStatus & {
      status: "configured" | "missing_config";
      required: false;
      verification: DependencyVerification;
      lastVerifiedAt: null;
    };
    inngest: InngestConfigStatus & {
      status: "configured" | "missing_config";
      required: false;
      verification: DependencyVerification;
      lastVerifiedAt: null;
    };
  };
  summary: {
    failed: string[];
    degraded: string[];
  };
};

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

export function resolveBuildMetadata(): BuildMetadata {
  return {
    version: typeof packageJson.version === "string" ? packageJson.version : null,
    commitSha: firstDefined(
      process.env.VERCEL_GIT_COMMIT_SHA,
      process.env.GITHUB_SHA,
      process.env.SOURCE_COMMIT,
    ),
    buildTimestamp: firstDefined(
      process.env.BUILD_TIMESTAMP,
      process.env.VERCEL_DEPLOYMENT_CREATED_AT,
      process.env.SOURCE_BUILD_TIMESTAMP,
    ),
  };
}

export async function probeDatabaseReadiness() {
  const checkedAt = new Date().toISOString();
  const supabaseConfig = getSupabaseConfigStatus();
  const hasMinimumConfig =
    supabaseConfig.publicClientConfigured
    && supabaseConfig.databaseConfigured
    && supabaseConfig.serviceRoleConfigured;

  if (!hasMinimumConfig) {
    return {
      status: "missing_config",
      required: true,
      checkedAt,
      latencyMs: null,
      detail: "Falta configuracion minima de Supabase o base de datos para verificar readiness real.",
    } satisfies DatabaseReadinessCheck;
  }

  try {
    const supabase = getSupabaseServiceRoleClient();
    const startedAt = Date.now();
    const { error } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        status: "failed",
        required: true,
        checkedAt,
        latencyMs: Date.now() - startedAt,
        detail: error.message,
      } satisfies DatabaseReadinessCheck;
    }

    return {
      status: "ok",
      required: true,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      detail: "Consulta minima a organizations ejecutada correctamente.",
    } satisfies DatabaseReadinessCheck;
  } catch (error) {
    return {
      status: "failed",
      required: true,
      checkedAt,
      latencyMs: null,
      detail: error instanceof Error ? error.message : "Fallo desconocido al verificar la base de datos.",
    } satisfies DatabaseReadinessCheck;
  }
}

export function summarizeReadinessStatus(input: {
  database: DatabaseReadinessCheck;
  openaiConfigured: boolean;
  inngestConfigured: boolean;
}) {
  const failed: string[] = [];
  const degraded: string[] = [];

  if (input.database.status !== "ok") {
    failed.push("database_unavailable");
  }

  if (!input.openaiConfigured) {
    degraded.push("openai_not_configured");
  }

  if (!input.inngestConfigured) {
    degraded.push("inngest_not_configured");
  }

  if (failed.length > 0) {
    return {
      status: "failed",
      ready: false,
      failed,
      degraded,
    } satisfies ReadinessPayload["summary"] & {
      status: ReadinessStatus;
      ready: boolean;
    };
  }

  if (degraded.length > 0) {
    return {
      status: "degraded",
      ready: true,
      failed,
      degraded,
    } satisfies ReadinessPayload["summary"] & {
      status: ReadinessStatus;
      ready: boolean;
    };
  }

  return {
    status: "ok",
    ready: true,
    failed,
    degraded,
  } satisfies ReadinessPayload["summary"] & {
    status: ReadinessStatus;
    ready: boolean;
  };
}

export function buildLivenessPayload(input?: {
  timestamp?: string;
  build?: BuildMetadata;
  supabase?: SupabaseConfigStatus;
  openai?: OpenAIConfigStatus;
  inngest?: InngestConfigStatus;
}) {
  const supabase = input?.supabase ?? getSupabaseConfigStatus();
  const openai = input?.openai ?? getOpenAIConfigStatus();
  const inngest = input?.inngest ?? getInngestConfigStatus();

  return {
    name: "convertilabs",
    mode: "liveness",
    kind: "config",
    status: "ok",
    timestamp: input?.timestamp ?? new Date().toISOString(),
    build: input?.build ?? resolveBuildMetadata(),
    links: {
      ready: "/api/ready",
    },
    services: {
      supabase,
      openai: {
        ...openai,
        verification: "not_performed",
        lastVerifiedAt: null,
      },
      inngest: {
        ...inngest,
        verification: "not_performed",
        lastVerifiedAt: null,
      },
    },
  } satisfies LivenessPayload;
}

export function buildReadinessPayload(input: {
  timestamp?: string;
  build?: BuildMetadata;
  supabase?: SupabaseConfigStatus;
  openai?: OpenAIConfigStatus;
  inngest?: InngestConfigStatus;
  database: DatabaseReadinessCheck;
}) {
  const supabase = input.supabase ?? getSupabaseConfigStatus();
  const openai = input.openai ?? getOpenAIConfigStatus();
  const inngest = input.inngest ?? getInngestConfigStatus();
  const summary = summarizeReadinessStatus({
    database: input.database,
    openaiConfigured: openai.configured,
    inngestConfigured: inngest.configured,
  });

  return {
    name: "convertilabs",
    mode: "readiness",
    status: summary.status,
    ready: summary.ready,
    timestamp: input.timestamp ?? new Date().toISOString(),
    build: input.build ?? resolveBuildMetadata(),
    dependencies: {
      supabase: {
        ...supabase,
        status:
          supabase.publicClientConfigured
          && supabase.databaseConfigured
          && supabase.serviceRoleConfigured
            ? "ok"
            : "missing_config",
        required: true,
      },
      database: input.database,
      openai: {
        ...openai,
        status: openai.configured ? "configured" : "missing_config",
        required: false,
        verification: "not_performed",
        lastVerifiedAt: null,
      },
      inngest: {
        ...inngest,
        status: inngest.configured ? "configured" : "missing_config",
        required: false,
        verification: "not_performed",
        lastVerifiedAt: null,
      },
    },
    summary: {
      failed: summary.failed,
      degraded: summary.degraded,
    },
  } satisfies ReadinessPayload;
}

export function getReadinessHttpStatus(payload: ReadinessPayload) {
  return payload.status === "failed" ? 503 : 200;
}

export async function loadReadinessPayload() {
  const database = await probeDatabaseReadiness();

  return buildReadinessPayload({
    database,
  });
}
