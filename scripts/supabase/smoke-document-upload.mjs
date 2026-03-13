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

function buildOrganizationPayload(name) {
  return {
    p_name: name,
    p_legal_entity_type: "SAS",
    p_tax_id: "211234560019",
    p_tax_regime_code: "IRAE_GENERAL",
    p_vat_regime: "GENERAL",
    p_dgi_group: "NO_CEDE",
    p_cfe_status: "ELECTRONIC_ISSUER",
  };
}

async function createOrganization(client, name) {
  const { data, error } = await client
    .rpc("create_organization_with_owner", buildOrganizationPayload(name))
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
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required for the document upload smoke test.",
    );
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const suffix = crypto.randomBytes(5).toString("hex");
  const email = `upload-smoke-${suffix}@example.com`;
  const password = `SmokeTest!${suffix}`;
  const fullName = `Upload Smoke ${suffix}`;
  const organizationName = `Upload Org ${suffix}`;
  let storagePath;
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

    const fileBytes = new TextEncoder().encode("%PDF-1.4\n% smoke test\n");
    const { data: preparedUpload, error: preparedUploadError } = await userClient
      .rpc("prepare_document_upload", {
        p_org_id: organizationId,
        p_original_filename: `invoice-${suffix}.pdf`,
        p_mime_type: "application/pdf",
        p_file_size: fileBytes.byteLength,
        p_direction: "purchase",
      })
      .single();

    if (preparedUploadError) {
      throw preparedUploadError;
    }

    if (
      !preparedUpload?.document_id
      || !preparedUpload.storage_bucket
      || !preparedUpload.storage_path
    ) {
      throw new Error("prepare_document_upload() did not return the upload metadata.");
    }

    storagePath = preparedUpload.storage_path;
    const { data: signedUpload, error: signedUploadError } = await serviceClient.storage
      .from(preparedUpload.storage_bucket)
      .createSignedUploadUrl(preparedUpload.storage_path, {
        upsert: false,
      });

    if (signedUploadError || !signedUpload?.token) {
      throw signedUploadError ?? new Error("Could not create a signed upload token.");
    }

    const { error: storageUploadError } = await userClient.storage
      .from(preparedUpload.storage_bucket)
      .uploadToSignedUrl(
        preparedUpload.storage_path,
        signedUpload.token,
        new Blob([fileBytes], {
          type: "application/pdf",
        }),
        {
          contentType: "application/pdf",
          upsert: false,
        },
      );

    if (storageUploadError) {
      throw storageUploadError;
    }

    const { error: completeUploadError } = await userClient.rpc(
      "complete_document_upload",
      {
        p_document_id: preparedUpload.document_id,
      },
    );

    if (completeUploadError) {
      throw completeUploadError;
    }

    const { data: documentRow, error: documentRowError } = await userClient
      .from("documents")
      .select("id, status, storage_path")
      .eq("id", preparedUpload.document_id)
      .maybeSingle();

    if (documentRowError) {
      throw documentRowError;
    }

    if (!documentRow || documentRow.status !== "uploaded") {
      throw new Error("Document row was not finalized with status uploaded.");
    }

    if (documentRow.storage_path !== preparedUpload.storage_path) {
      throw new Error("Document row storage_path does not match the prepared upload path.");
    }

    const { data: dashboardRows, error: dashboardError } = await userClient.rpc(
      "list_dashboard_documents",
      {
        p_org_id: organizationId,
        p_limit: 12,
      },
    );

    if (dashboardError) {
      throw dashboardError;
    }

    const dashboardRow = dashboardRows?.find(
      (row) => row.id === preparedUpload.document_id,
    );

    if (!dashboardRow) {
      throw new Error("Dashboard list did not include the uploaded document.");
    }

    console.log("Document upload smoke test passed.");
  } finally {
    if (storagePath) {
      const { error: removeStorageError } = await serviceClient.storage
        .from("documents-private")
        .remove([storagePath]);

      if (removeStorageError) {
        console.error(
          `Failed to delete smoke-test storage object ${storagePath}: ${removeStorageError.message}`,
        );
        process.exitCode = 1;
      }
    }

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
