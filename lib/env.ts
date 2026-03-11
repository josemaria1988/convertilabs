function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

function resolveAppUrl() {
  const explicitAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (explicitAppUrl) {
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
