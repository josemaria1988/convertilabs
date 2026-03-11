import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

function assertServerContext() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase server clients can only be created on the server.");
  }
}

export function getSupabaseServerClient() {
  assertServerContext();

  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseServiceRoleClient() {
  assertServerContext();

  const { supabaseUrl } = getPublicEnv();
  const { supabaseServiceRoleKey } = getServerEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
