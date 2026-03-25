"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildRulesAdminHref } from "@/components/rules/accounting-rules-href";
import { requireOrganizationAppPage } from "@/modules/auth/server-auth";
import {
  changeAccountingRulePriority,
  createAccountingRuleAiThread,
  createManualAccountingRule,
  createSupersedingAccountingRule,
  deleteUnusedAccountingRule,
  loadAccountingRulesAdminPageData,
  pauseAccountingRule,
  reactivateAccountingRule,
  sendAccountingRuleAiMessage,
  simulateAccountingRulePriorityChange,
  simulateManualAccountingRule,
  simulateSupersedingAccountingRule,
} from "@/modules/accounting/rules-admin";

type AccountingRuleAiClientActionResult = {
  ok: boolean;
  message: string;
  threads: Array<{
    id: string;
    title: string;
    contextScope: string;
    contextRuleId: string | null;
    createdAt: string;
    archivedAt: string | null;
  }>;
  selectedThreadId: string | null;
  selectedThread: {
    id: string;
    title: string;
    contextScope: string;
    contextRuleId: string | null;
    messages: Array<{
      id: string;
      role: "user" | "assistant" | "system_context";
      messageText: string;
      structuredPayload: Record<string, unknown>;
      referencedRuleIds: string[];
      referencedDocumentIds: string[];
      provider: string | null;
      model: string | null;
      createdAt: string;
    }>;
  } | null;
};

type AccountingRuleSimulationClientResult = {
  ok: boolean;
  message: string;
  ruleId: string | null;
  simulation: {
    simulationId: string | null;
    sampleSize: number;
    changedDocumentsCount: number;
    examples: Array<{
      documentId: string;
      originalFilename: string;
      documentDate: string | null;
      previousRuleId: string | null;
      previousRuleName: string | null;
      previousScope: string | null;
      nextRuleId: string | null;
      nextRuleName: string | null;
      nextScope: string | null;
      changed: boolean;
    }>;
    summary: Record<string, unknown>;
  } | null;
};

type AccountingRuleMutationClientResult = {
  ok: boolean;
  message: string;
  ruleId: string | null;
};

function assertAccountingRulesManagerRole(role: string) {
  if (!["owner", "admin", "accountant"].includes(role)) {
    throw new Error("Tu rol no puede administrar reglas contables.");
  }
}

function assertAccountingRulesOwnerAdminRole(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new Error("Tu rol no puede eliminar reglas contables.");
  }
}

function revalidateRulesAdminPaths(slug: string) {
  revalidatePath(`/app/o/${slug}/settings`);
  revalidatePath(`/app/o/${slug}/rules`);
  revalidatePath(`/app/o/${slug}/settings/accounting-rules`);
}

function revalidateAccountingRuleDetailPaths(slug: string, ruleId: string | null) {
  if (!ruleId) {
    return;
  }

  revalidatePath(`/app/o/${slug}/rules/${ruleId}`);
  revalidatePath(`/app/o/${slug}/rules/${ruleId}/version`);
}

function buildRulesAdminPath(slug: string, ruleId: string, tab: "summary" | "impact" | "conflicts" | "audit" = "summary") {
  return buildRulesAdminHref(slug, {
    mode: "detail",
    ruleId,
    tab,
  });
}

function buildRulesAdminSimulationPath(
  slug: string,
  ruleId: string,
  simulationId: string | null,
  tab: "summary" | "impact" | "conflicts" | "audit" = "impact",
) {
  return buildRulesAdminHref(slug, {
    mode: "detail",
    ruleId,
    simulationId,
    tab,
  });
}

function buildRulesAdminThreadPath(slug: string, ruleId: string, threadId: string) {
  return buildRulesAdminHref(slug, {
    mode: "detail",
    ruleId,
    threadId,
    tab: "audit",
    assistant: true,
  });
}

async function loadChatStateForRule(input: {
  organizationId: string;
  ruleId: string;
  selectedThreadId?: string | null;
}): Promise<AccountingRuleAiClientActionResult> {
  const pageData = await loadAccountingRulesAdminPageData({
    organizationId: input.organizationId,
    selectedRuleId: input.ruleId,
    selectedThreadId: input.selectedThreadId ?? null,
  });
  const rule = pageData.selectedRule;

  if (!rule) {
    return {
      ok: false,
      message: "No pudimos recargar el contexto del chat para esta regla.",
      threads: [],
      selectedThreadId: null,
      selectedThread: null,
    };
  }

  return {
    ok: true,
    message: "",
    threads: rule.aiThreads,
    selectedThreadId: rule.selectedAiThreadId,
    selectedThread: rule.selectedAiThread,
  };
}

export async function pauseAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const tab = String(formData.get("tab") ?? "summary");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  await pauseAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    reason: String(formData.get("reason") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminPath(
    organization.slug,
    ruleId,
    tab === "impact" || tab === "conflicts" || tab === "audit" ? tab : "summary",
  ));
}

export async function reactivateAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const tab = String(formData.get("tab") ?? "summary");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  await reactivateAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    reason: String(formData.get("reason") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminPath(
    organization.slug,
    ruleId,
    tab === "impact" || tab === "conflicts" || tab === "audit" ? tab : "summary",
  ));
}

export async function createSupersedingAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  const successorRuleId = await createSupersedingAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    reason: String(formData.get("reason") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    scope: String(formData.get("scope") ?? ""),
    documentRole: String(formData.get("documentRole") ?? ""),
    vendorId: String(formData.get("vendorId") ?? ""),
    conceptId: String(formData.get("conceptId") ?? ""),
    accountId: String(formData.get("accountId") ?? ""),
    taxProfileCode: String(formData.get("taxProfileCode") ?? ""),
    operationCategory: String(formData.get("operationCategory") ?? ""),
    linkedOperationType: String(formData.get("linkedOperationType") ?? ""),
    templateCode: String(formData.get("templateCode") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  revalidateAccountingRuleDetailPaths(organization.slug, successorRuleId);
  redirect(buildRulesAdminPath(organization.slug, successorRuleId));
}

export async function simulateSupersedingAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  const simulation = await simulateSupersedingAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    scope: String(formData.get("scope") ?? ""),
    documentRole: String(formData.get("documentRole") ?? ""),
    vendorId: String(formData.get("vendorId") ?? ""),
    conceptId: String(formData.get("conceptId") ?? ""),
    accountId: String(formData.get("accountId") ?? ""),
    taxProfileCode: String(formData.get("taxProfileCode") ?? ""),
    operationCategory: String(formData.get("operationCategory") ?? ""),
    linkedOperationType: String(formData.get("linkedOperationType") ?? ""),
    templateCode: String(formData.get("templateCode") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminHref(organization.slug, {
    mode: "version",
    ruleId,
    simulationId: simulation.simulationId,
  }));
}

export async function deleteUnusedAccountingRuleAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const tab = String(formData.get("tab") ?? "summary");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesOwnerAdminRole(organization.role);

  await deleteUnusedAccountingRule({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    reason: String(formData.get("reason") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminPath(
    organization.slug,
    ruleId,
    tab === "impact" || tab === "conflicts" || tab === "audit" ? tab : "summary",
  ));
}

export async function simulateAccountingRulePriorityChangeAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  const simulation = await simulateAccountingRulePriorityChange({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    direction: direction === "down" ? "down" : "up",
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminSimulationPath(
    organization.slug,
    ruleId,
    simulation.simulationId,
  ));
}

export async function changeAccountingRulePriorityAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const tab = String(formData.get("tab") ?? "conflicts");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  await changeAccountingRulePriority({
    organizationId: organization.id,
    ruleId,
    actorUserId: authState.user?.id ?? null,
    direction: direction === "down" ? "down" : "up",
    reason: String(formData.get("reason") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminPath(
    organization.slug,
    ruleId,
    tab === "impact" || tab === "audit" || tab === "summary" ? tab : "conflicts",
  ));
}

export async function simulateManualAccountingRuleClientAction(input: {
  slug: string;
  name: string;
  description: string;
  scope: string;
  documentRole: string;
  vendorId: string;
  conceptId: string;
  accountId: string;
  taxProfileCode: string;
  operationCategory: string;
  linkedOperationType: string;
  templateCode: string;
  priority: string;
}): Promise<AccountingRuleSimulationClientResult> {
  try {
    const { authState, organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules/new`,
    );

    assertAccountingRulesManagerRole(organization.role);
    const simulation = await simulateManualAccountingRule({
      organizationId: organization.id,
      actorUserId: authState.user?.id ?? null,
      name: input.name,
      description: input.description,
      scope: input.scope,
      documentRole: input.documentRole,
      vendorId: input.vendorId,
      conceptId: input.conceptId,
      accountId: input.accountId,
      taxProfileCode: input.taxProfileCode,
      operationCategory: input.operationCategory,
      linkedOperationType: input.linkedOperationType,
      templateCode: input.templateCode,
      priority: input.priority,
    });

    return {
      ok: true,
      message: "Simulacion lista.",
      ruleId: null,
      simulation,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos simular la regla nueva.",
      ruleId: null,
      simulation: null,
    };
  }
}

export async function createManualAccountingRuleClientAction(input: {
  slug: string;
  name: string;
  description: string;
  scope: string;
  documentRole: string;
  vendorId: string;
  conceptId: string;
  accountId: string;
  taxProfileCode: string;
  operationCategory: string;
  linkedOperationType: string;
  templateCode: string;
  priority: string;
  reason: string;
}): Promise<AccountingRuleMutationClientResult> {
  try {
    const { authState, organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules/new`,
    );

    assertAccountingRulesManagerRole(organization.role);
    const ruleId = await createManualAccountingRule({
      organizationId: organization.id,
      actorUserId: authState.user?.id ?? null,
      reason: input.reason,
      name: input.name,
      description: input.description,
      scope: input.scope,
      documentRole: input.documentRole,
      vendorId: input.vendorId,
      conceptId: input.conceptId,
      accountId: input.accountId,
      taxProfileCode: input.taxProfileCode,
      operationCategory: input.operationCategory,
      linkedOperationType: input.linkedOperationType,
      templateCode: input.templateCode,
      priority: input.priority,
    });

    revalidateRulesAdminPaths(organization.slug);
    revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
    return {
      ok: true,
      message: "Regla creada.",
      ruleId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos crear la regla.",
      ruleId: null,
    };
  }
}

export async function simulateSupersedingAccountingRuleClientAction(input: {
  slug: string;
  ruleId: string;
  name: string;
  description: string;
  scope: string;
  documentRole: string;
  vendorId: string;
  conceptId: string;
  accountId: string;
  taxProfileCode: string;
  operationCategory: string;
  linkedOperationType: string;
  templateCode: string;
}): Promise<AccountingRuleSimulationClientResult> {
  try {
    const { authState, organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules/${input.ruleId}/version`,
    );

    assertAccountingRulesManagerRole(organization.role);
    const simulation = await simulateSupersedingAccountingRule({
      organizationId: organization.id,
      ruleId: input.ruleId,
      actorUserId: authState.user?.id ?? null,
      name: input.name,
      description: input.description,
      scope: input.scope,
      documentRole: input.documentRole,
      vendorId: input.vendorId,
      conceptId: input.conceptId,
      accountId: input.accountId,
      taxProfileCode: input.taxProfileCode,
      operationCategory: input.operationCategory,
      linkedOperationType: input.linkedOperationType,
      templateCode: input.templateCode,
    });

    return {
      ok: true,
      message: "Simulacion lista.",
      ruleId: input.ruleId,
      simulation,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos simular la nueva version.",
      ruleId: input.ruleId,
      simulation: null,
    };
  }
}

export async function createSupersedingAccountingRuleClientAction(input: {
  slug: string;
  ruleId: string;
  reason: string;
  name: string;
  description: string;
  scope: string;
  documentRole: string;
  vendorId: string;
  conceptId: string;
  accountId: string;
  taxProfileCode: string;
  operationCategory: string;
  linkedOperationType: string;
  templateCode: string;
}): Promise<AccountingRuleMutationClientResult> {
  try {
    const { authState, organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules/${input.ruleId}/version`,
    );

    assertAccountingRulesManagerRole(organization.role);
    const successorRuleId = await createSupersedingAccountingRule({
      organizationId: organization.id,
      ruleId: input.ruleId,
      actorUserId: authState.user?.id ?? null,
      reason: input.reason,
      name: input.name,
      description: input.description,
      scope: input.scope,
      documentRole: input.documentRole,
      vendorId: input.vendorId,
      conceptId: input.conceptId,
      accountId: input.accountId,
      taxProfileCode: input.taxProfileCode,
      operationCategory: input.operationCategory,
      linkedOperationType: input.linkedOperationType,
      templateCode: input.templateCode,
    });

    revalidateRulesAdminPaths(organization.slug);
    revalidateAccountingRuleDetailPaths(organization.slug, input.ruleId);
    revalidateAccountingRuleDetailPaths(organization.slug, successorRuleId);
    return {
      ok: true,
      message: "Nueva version creada.",
      ruleId: successorRuleId,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos crear la nueva version.",
      ruleId: null,
    };
  }
}

export async function createAccountingRuleAiThreadAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  const threadId = await createAccountingRuleAiThread({
    organizationId: organization.id,
    actorUserId: authState.user?.id ?? null,
    ruleId,
    title: String(formData.get("title") ?? ""),
    initialPrompt: String(formData.get("initialPrompt") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminThreadPath(organization.slug, ruleId, threadId));
}

export async function sendAccountingRuleAiMessageAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const threadId = String(formData.get("threadId") ?? "");
  const ruleId = String(formData.get("ruleId") ?? "");
  const { authState, organization } = await requireOrganizationAppPage(
    slug,
    `/app/o/${slug}/rules`,
  );

  assertAccountingRulesManagerRole(organization.role);

  await sendAccountingRuleAiMessage({
    organizationId: organization.id,
    actorUserId: authState.user?.id ?? null,
    threadId,
    message: String(formData.get("message") ?? ""),
  });

  revalidateRulesAdminPaths(organization.slug);
  revalidateAccountingRuleDetailPaths(organization.slug, ruleId);
  redirect(buildRulesAdminThreadPath(organization.slug, ruleId, threadId));
}

export async function loadAccountingRuleAiThreadClientAction(input: {
  slug: string;
  ruleId: string;
  threadId: string;
}): Promise<AccountingRuleAiClientActionResult> {
  try {
    const { organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules`,
    );

    assertAccountingRulesManagerRole(organization.role);
    const result = await loadChatStateForRule({
      organizationId: organization.id,
      ruleId: input.ruleId,
      selectedThreadId: input.threadId,
    });

    return {
      ...result,
      message: result.ok ? "Hilo cargado." : result.message,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos abrir el hilo consultivo.",
      threads: [],
      selectedThreadId: null,
      selectedThread: null,
    };
  }
}

export async function createAccountingRuleAiThreadClientAction(input: {
  slug: string;
  ruleId: string;
  title: string;
  initialPrompt: string;
}): Promise<AccountingRuleAiClientActionResult> {
  try {
    const { authState, organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules`,
    );

    assertAccountingRulesManagerRole(organization.role);
    const threadId = await createAccountingRuleAiThread({
      organizationId: organization.id,
      actorUserId: authState.user?.id ?? null,
      ruleId: input.ruleId,
      title: input.title,
      initialPrompt: input.initialPrompt,
    });

    revalidateRulesAdminPaths(organization.slug);
    return loadChatStateForRule({
      organizationId: organization.id,
      ruleId: input.ruleId,
      selectedThreadId: threadId,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos crear el hilo consultivo.",
      threads: [],
      selectedThreadId: null,
      selectedThread: null,
    };
  }
}

export async function sendAccountingRuleAiMessageClientAction(input: {
  slug: string;
  ruleId: string;
  threadId: string;
  message: string;
}): Promise<AccountingRuleAiClientActionResult> {
  try {
    const { authState, organization } = await requireOrganizationAppPage(
      input.slug,
      `/app/o/${input.slug}/rules`,
    );

    assertAccountingRulesManagerRole(organization.role);
    await sendAccountingRuleAiMessage({
      organizationId: organization.id,
      actorUserId: authState.user?.id ?? null,
      threadId: input.threadId,
      message: input.message,
    });

    revalidateRulesAdminPaths(organization.slug);
    return loadChatStateForRule({
      organizationId: organization.id,
      ruleId: input.ruleId,
      selectedThreadId: input.threadId,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No pudimos enviar la consulta.",
      threads: [],
      selectedThreadId: null,
      selectedThread: null,
    };
  }
}
