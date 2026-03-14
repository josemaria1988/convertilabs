function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

function parseBooleanFlag(value: string | undefined) {
  return value === "1" || value === "true";
}

function parseIntegerFlag(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(value: string | undefined) {
  const parsed = Number.parseFloat(value ?? "");

  return Number.isFinite(parsed) ? parsed : null;
}

function resolveOpenAIModelConfig() {
  const openAiPrimaryModel = firstDefined(process.env.OPENAI_PRIMARY_MODEL) ?? "gpt-4o";
  const openAiMiniModel = firstDefined(process.env.OPENAI_MINI_MODEL) ?? "gpt-4o-mini";
  const openAiUseMiniByDefault = parseBooleanFlag(process.env.OPENAI_USE_MINI_BY_DEFAULT);
  const openAiDefaultModel =
    openAiUseMiniByDefault
      ? openAiMiniModel
      : openAiPrimaryModel;
  const openAiDocumentModel =
    firstDefined(process.env.OPENAI_DOCUMENT_MODEL) ?? openAiDefaultModel;
  const openAiRulesModel =
    firstDefined(process.env.OPENAI_RULES_MODEL) ?? openAiDocumentModel;
  const openAiAccountingModel =
    firstDefined(process.env.OPENAI_ACCOUNTING_MODEL) ?? openAiDocumentModel;
  const openAiHttpMaxRetries = parseIntegerFlag(process.env.OPENAI_HTTP_MAX_RETRIES, 2);
  const openAiHttpRetryDelayMs = parseIntegerFlag(process.env.OPENAI_HTTP_RETRY_DELAY_MS, 250);
  const openAiUsageCostInputUsdPer1M = parseOptionalNumber(
    process.env.OPENAI_USAGE_COST_INPUT_USD_PER_1M,
  );
  const openAiUsageCostOutputUsdPer1M = parseOptionalNumber(
    process.env.OPENAI_USAGE_COST_OUTPUT_USD_PER_1M,
  );

  return {
    openAiPrimaryModel,
    openAiMiniModel,
    openAiUseMiniByDefault,
    openAiDefaultModel,
    openAiDocumentModel,
    openAiRulesModel,
    openAiAccountingModel,
    openAiHttpMaxRetries,
    openAiHttpRetryDelayMs,
    openAiUsageCostInputUsdPer1M,
    openAiUsageCostOutputUsdPer1M,
  };
}

const canonicalProductionAppUrl = "https://convertilabs.com";

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function resolveAppUrl() {
  const explicitAppUrl = firstDefined(
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  );

  if (explicitAppUrl) {
    if (process.env.NODE_ENV === "production" && isLocalhostUrl(explicitAppUrl)) {
      return canonicalProductionAppUrl;
    }

    return explicitAppUrl;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const vercelHost = firstDefined(
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  );

  if (vercelHost) {
    return `https://${vercelHost}`;
  }

  if (process.env.NODE_ENV === "production") {
    return canonicalProductionAppUrl;
  }

  return "http://localhost:3000";
}

export function getPublicEnv() {
  const supabaseUrl = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_URL,
  );
  const supabaseAnonKey = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_ANON_KEY,
  );
  const supabasePublishableKey =
    firstDefined(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_PUBLISHABLE_KEY,
    ) ?? "";

  return {
    appUrl: resolveAppUrl(),
    supabaseUrl: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_URL",
      supabaseUrl,
    ),
    supabaseAnonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_ANON_KEY",
      supabaseAnonKey,
    ),
    supabasePublishableKey,
  };
}

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv can only be used on the server.");
  }

  const databaseUrl = firstDefined(
    process.env.DATABASE_URL,
    process.env.SUPABASE_CONVERTILABS_POSTGRES_PRISMA_URL,
    process.env.SUPABASE_CONVERTILABS_POSTGRES_URL,
  );
  const directUrl =
    firstDefined(
      process.env.DIRECT_URL,
      process.env.SUPABASE_CONVERTILABS_POSTGRES_URL_NON_POOLING,
    ) ?? "";
  const supabaseServiceRoleKey = firstDefined(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_CONVERTILABS_SUPABASE_SERVICE_ROLE_KEY,
  );
  const supabaseJwtSecret =
    firstDefined(
      process.env.SUPABASE_JWT_SECRET,
      process.env.SUPABASE_CONVERTILABS_SUPABASE_JWT_SECRET,
    ) ?? "";
  const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

  return {
    databaseUrl: requireEnv(
      "DATABASE_URL or SUPABASE_CONVERTILABS_POSTGRES_PRISMA_URL",
      databaseUrl,
    ),
    directUrl,
    supabaseServiceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_CONVERTILABS_SUPABASE_SERVICE_ROLE_KEY",
      supabaseServiceRoleKey,
    ),
    supabaseJwtSecret,
    openAiApiKey,
    ...resolveOpenAIModelConfig(),
  };
}

export function getOpenAIModelConfig() {
  if (typeof window !== "undefined") {
    throw new Error("getOpenAIModelConfig can only be used on the server.");
  }

  return resolveOpenAIModelConfig();
}

export function getOpenAIEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getOpenAIEnv can only be used on the server.");
  }

  return {
    openAiApiKey: requireEnv("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
    ...resolveOpenAIModelConfig(),
  };
}

export function getInngestEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getInngestEnv can only be used on the server.");
  }

  return {
    eventKey: process.env.INNGEST_EVENT_KEY ?? "",
    signingKey: process.env.INNGEST_SIGNING_KEY ?? "",
    baseUrl: process.env.INNGEST_BASE_URL ?? "",
    isDev: parseBooleanFlag(process.env.INNGEST_DEV),
    appVersion: firstDefined(
      process.env.VERCEL_GIT_COMMIT_SHA,
      process.env.GITHUB_SHA,
    ),
  };
}

export function getSupabaseConfigStatus() {
  const publicSupabaseUrl = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_URL,
  );
  const publicSupabaseAnonKey = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_ANON_KEY,
  );
  const publicSupabasePublishableKey = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_CONVERTILABS_SUPABASE_PUBLISHABLE_KEY,
  );
  const databaseUrl = firstDefined(
    process.env.DATABASE_URL,
    process.env.SUPABASE_CONVERTILABS_POSTGRES_PRISMA_URL,
    process.env.SUPABASE_CONVERTILABS_POSTGRES_URL,
  );
  const directUrl = firstDefined(
    process.env.DIRECT_URL,
    process.env.SUPABASE_CONVERTILABS_POSTGRES_URL_NON_POOLING,
  );
  const serviceRoleKey = firstDefined(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_CONVERTILABS_SUPABASE_SERVICE_ROLE_KEY,
  );
  const jwtSecret = firstDefined(
    process.env.SUPABASE_JWT_SECRET,
    process.env.SUPABASE_CONVERTILABS_SUPABASE_JWT_SECRET,
  );

  return {
    publicClientConfigured: Boolean(publicSupabaseUrl && publicSupabaseAnonKey),
    publishableKeyConfigured: Boolean(publicSupabasePublishableKey),
    databaseConfigured: Boolean(databaseUrl),
    directDatabaseConfigured: Boolean(directUrl),
    serviceRoleConfigured: Boolean(serviceRoleKey),
    jwtSecretConfigured: Boolean(jwtSecret),
  };
}

export function getOpenAIConfigStatus() {
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const {
    openAiDefaultModel,
    openAiDocumentModel,
    openAiRulesModel,
    openAiAccountingModel,
    openAiUseMiniByDefault,
  } = resolveOpenAIModelConfig();

  return {
    configured: Boolean(openAiApiKey),
    defaultModel: openAiDefaultModel,
    documentModel: openAiDocumentModel,
    rulesModel: openAiRulesModel,
    accountingModel: openAiAccountingModel,
    documentModelConfigured: Boolean(firstDefined(process.env.OPENAI_DOCUMENT_MODEL)),
    rulesModelConfigured: Boolean(firstDefined(process.env.OPENAI_RULES_MODEL)),
    accountingModelConfigured: Boolean(firstDefined(process.env.OPENAI_ACCOUNTING_MODEL)),
    useMiniByDefault: openAiUseMiniByDefault,
  };
}

export function getInngestConfigStatus() {
  const isDev = parseBooleanFlag(process.env.INNGEST_DEV);
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  const baseUrl = process.env.INNGEST_BASE_URL;

  return {
    configured: isDev || Boolean(eventKey && signingKey),
    isDev,
    eventKeyConfigured: Boolean(eventKey),
    signingKeyConfigured: Boolean(signingKey),
    baseUrlConfigured: Boolean(baseUrl),
  };
}
