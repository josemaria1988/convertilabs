import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./env.mjs";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForProfile(serviceClient, userId) {
  const timeoutAt = Date.now() + 15000;

  while (Date.now() < timeoutAt) {
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return;
    }

    await sleep(1000);
  }

  throw new Error(`Timed out while waiting for profile ${userId}.`);
}

async function createConfirmedUser(serviceClient, email, password, fullName) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error) {
    throw error;
  }

  const userId = data.user?.id;

  if (!userId) {
    throw new Error("Supabase auth.admin.createUser did not return a user id.");
  }

  await waitForProfile(serviceClient, userId);

  return {
    userId,
    email,
    password,
    fullName,
  };
}

async function signInAsUser(supabaseUrl, anonKey, email, password) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session || !data.user) {
    throw new Error(`Supabase did not return a session for ${email}.`);
  }

  return client;
}

async function createOrganization(client, name) {
  const { data, error } = await client
    .rpc("create_organization_with_owner", {
      p_name: name,
    })
    .single();

  if (error) {
    throw error;
  }

  if (!data?.organization_id || !data.slug) {
    throw new Error("Organization RPC did not return organization_id and slug.");
  }

  return data;
}

async function main() {
  loadProjectEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required for the private dashboard smoke test.",
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const suffix = crypto.randomBytes(5).toString("hex");
  const email = `dashboard-smoke-${suffix}@example.com`;
  const password = `SmokeTest!${suffix}`;
  const fullName = `Dashboard Smoke ${suffix}`;
  const organizationName = `Dashboard Org ${suffix}`;
  const filename = `dashboard-smoke-${suffix}.pdf`;
  const storagePath = `${suffix}/documents/${filename}`;
  let organizationId;
  let userId;

  try {
    const user = await createConfirmedUser(
      serviceClient,
      email,
      password,
      fullName,
    );
    userId = user.userId;

    const userClient = await signInAsUser(
      supabaseUrl,
      anonKey,
      email,
      password,
    );
    const organization = await createOrganization(userClient, organizationName);
    organizationId = organization.organization_id;

    const { error: insertDocumentError } = await serviceClient
      .from("documents")
      .insert({
        organization_id: organizationId,
        original_filename: filename,
        storage_path: storagePath,
        uploaded_by: userId,
        mime_type: "application/pdf",
        file_size: 1024,
      });

    if (insertDocumentError) {
      throw insertDocumentError;
    }

    const { count, error: countError } = await userClient
      .from("documents")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organizationId);

    if (countError) {
      throw countError;
    }

    if (count !== 1) {
      throw new Error(`Expected documents count 1, got ${count ?? "null"}.`);
    }

    const { data: dashboardDocuments, error: dashboardError } = await userClient
      .rpc("list_dashboard_documents", {
        p_org_id: organizationId,
        p_limit: 12,
      });

    if (dashboardError) {
      throw dashboardError;
    }

    const firstRow = dashboardDocuments?.[0];

    if (!firstRow) {
      throw new Error("Dashboard RPC did not return documents.");
    }

    if (firstRow.original_filename !== filename) {
      throw new Error(
        `Expected dashboard filename ${filename}, got ${firstRow.original_filename}.`,
      );
    }

    if (firstRow.uploaded_by_display !== fullName) {
      throw new Error(
        `Expected uploader display ${fullName}, got ${firstRow.uploaded_by_display}.`,
      );
    }

    console.log("Private dashboard smoke test passed.");
  } finally {
    if (organizationId) {
      const { error: deleteOrganizationError } = await serviceClient
        .from("organizations")
        .delete()
        .eq("id", organizationId);

      if (deleteOrganizationError) {
        console.error(
          `Failed to delete smoke-test organization ${organizationId}: ${deleteOrganizationError.message}`,
        );
        process.exitCode = 1;
      }
    }

    if (userId) {
      const { error: deleteUserError } =
        await serviceClient.auth.admin.deleteUser(userId);

      if (deleteUserError) {
        console.error(
          `Failed to delete smoke-test user ${userId}: ${deleteUserError.message}`,
        );
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
