import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./env.mjs";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function slugifyPreview(value) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function assertOrganizationOwner(serviceClient, organizationId, userId) {
  const { data: organization, error: organizationError } = await serviceClient
    .from("organizations")
    .select("id, slug, created_by")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    throw organizationError;
  }

  if (!organization || organization.created_by !== userId) {
    throw new Error(`Organization ${organizationId} is missing or has an unexpected owner.`);
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("organization_members")
    .select("organization_id, user_id, role, is_active")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership || membership.role !== "owner" || membership.is_active !== true) {
    throw new Error(`Owner membership for organization ${organizationId} is missing.`);
  }

  return organization;
}

async function main() {
  loadProjectEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required for the organization onboarding smoke test.",
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const suffix = crypto.randomBytes(5).toString("hex");
  const organizationName = `Smoke Org ${suffix}`;
  const expectedBaseSlug = slugifyPreview(organizationName);
  const createdUsers = [];
  const createdOrganizationIds = [];

  try {
    const firstUser = await createConfirmedUser(
      serviceClient,
      `org-smoke-a-${suffix}@example.com`,
      `SmokeTest!${suffix}A`,
      `Org Smoke A ${suffix}`,
    );
    createdUsers.push(firstUser.userId);

    const firstClient = await signInAsUser(
      supabaseUrl,
      anonKey,
      firstUser.email,
      firstUser.password,
    );
    const firstOrganization = await createOrganization(firstClient, organizationName);
    createdOrganizationIds.push(firstOrganization.organization_id);

    if (firstOrganization.slug !== expectedBaseSlug) {
      throw new Error(
        `Expected first slug ${expectedBaseSlug}, got ${firstOrganization.slug}.`,
      );
    }

    await assertOrganizationOwner(
      serviceClient,
      firstOrganization.organization_id,
      firstUser.userId,
    );

    const secondUser = await createConfirmedUser(
      serviceClient,
      `org-smoke-b-${suffix}@example.com`,
      `SmokeTest!${suffix}B`,
      `Org Smoke B ${suffix}`,
    );
    createdUsers.push(secondUser.userId);

    const secondClient = await signInAsUser(
      supabaseUrl,
      anonKey,
      secondUser.email,
      secondUser.password,
    );
    const secondOrganization = await createOrganization(secondClient, organizationName);
    createdOrganizationIds.push(secondOrganization.organization_id);

    if (secondOrganization.slug !== `${expectedBaseSlug}-1`) {
      throw new Error(
        `Expected collision slug ${expectedBaseSlug}-1, got ${secondOrganization.slug}.`,
      );
    }

    await assertOrganizationOwner(
      serviceClient,
      secondOrganization.organization_id,
      secondUser.userId,
    );

    console.log("Organization onboarding smoke test passed.");
  } finally {
    if (createdOrganizationIds.length > 0) {
      const { error: deleteOrganizationsError } = await serviceClient
        .from("organizations")
        .delete()
        .in("id", createdOrganizationIds);

      if (deleteOrganizationsError) {
        console.error(
          `Failed to delete smoke-test organizations: ${deleteOrganizationsError.message}`,
        );
        process.exitCode = 1;
      }
    }

    for (const userId of createdUsers) {
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
