function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function getPublicEnv() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    supabaseUrl: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    supabaseAnonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
}

export function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv can only be used on the server.");
  }

  return {
    databaseUrl: requireEnv("DATABASE_URL", process.env.DATABASE_URL),
    directUrl: process.env.DIRECT_URL ?? "",
    supabaseServiceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  };
}

export function getSupabaseConfigStatus() {
  return {
    publicClientConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    publishableKeyConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    directDatabaseConfigured: Boolean(process.env.DIRECT_URL),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    jwtSecretConfigured: Boolean(process.env.SUPABASE_JWT_SECRET),
  };
}
