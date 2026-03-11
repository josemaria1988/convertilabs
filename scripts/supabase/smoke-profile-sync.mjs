import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./env.mjs";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForProfile(supabase, userId, predicate, description) {
  const timeoutAt = Date.now() + 15000;

  while (Date.now() < timeoutAt) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data && predicate(data)) {
      return data;
    }

    await sleep(1000);
  }

  throw new Error(`Timed out while waiting for ${description}.`);
}

async function main() {
  loadProjectEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the profile sync smoke test.",
    );
  }

  const suffix = crypto.randomBytes(6).toString("hex");
  const email = `schema-smoke-${suffix}@example.com`;
  const initialName = `Schema Smoke ${suffix}`;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let userId;

  try {
    const { data: createdUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: `SmokeTest!${suffix}`,
        email_confirm: true,
        user_metadata: {
          full_name: initialName,
        },
      });

    if (createError) {
      throw createError;
    }

    userId = createdUser.user?.id;

    if (!userId) {
      throw new Error("Supabase auth.admin.createUser did not return a user id.");
    }

    await waitForProfile(
      supabase,
      userId,
      (profile) => profile.full_name === initialName && profile.email === email,
      "profile insert sync",
    );

    console.log("Profile insert sync smoke test passed.");
  } finally {
    if (!userId) {
      return;
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(
        `Failed to delete smoke-test user ${userId}: ${deleteError.message}`,
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
