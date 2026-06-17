import type {
  CompanyStatusBrief,
  OperationalSuggestionPayload,
  OperationalSuggestionType,
} from "@/modules/intelligence/types";

function compactText(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

function requiredText(value: string | null | undefined, label: string) {
  const normalized = compactText(value);

  if (!normalized) {
    throw new Error(`${label} es obligatorio.`);
  }

  return normalized;
}

function normalizeConfidence(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("La confianza de una sugerencia IA debe estar entre 0 y 1.");
  }

  return Math.round(value * 10000) / 10000;
}

export function buildOperationalSuggestionPayload(input: {
  organizationId: string;
  suggestionType: OperationalSuggestionType;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  suggestedAction: Record<string, unknown>;
  confidence?: number | null;
  reason?: string | null;
  requiredEvidence?: unknown[] | null;
  expiresAt?: string | null;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}): OperationalSuggestionPayload {
  return {
    organization_id: input.organizationId,
    suggestion_type: input.suggestionType,
    source_entity_type: compactText(input.sourceEntityType),
    source_entity_id: compactText(input.sourceEntityId),
    suggested_action_json: input.suggestedAction,
    confidence: normalizeConfidence(input.confidence),
    reason: compactText(input.reason),
    required_evidence_json: input.requiredEvidence ?? [],
    status: "pending",
    expires_at: compactText(input.expiresAt),
    metadata_json: {
      ...input.metadata,
      assistant_contract: input.suggestionType,
      review_required: true,
    },
    created_by: input.actorId ?? null,
  };
}

export function buildTaskSuggestionAction(input: {
  title: string;
  description?: string | null;
  priority?: "low" | "normal" | "high" | "urgent";
  dueDate?: string | null;
  partyId?: string | null;
  workUnitId?: string | null;
  documentId?: string | null;
}) {
  return {
    action: "create_task",
    title: requiredText(input.title, "Titulo de tarea sugerida"),
    description: compactText(input.description),
    priority: input.priority ?? "normal",
    dueDate: compactText(input.dueDate),
    partyId: compactText(input.partyId),
    workUnitId: compactText(input.workUnitId),
    documentId: compactText(input.documentId),
  };
}

export function buildWorkUnitAssignmentSuggestionAction(input: {
  documentId: string;
  workUnitId: string;
  confidence?: number | null;
}) {
  return {
    action: "link_document_to_work_unit",
    sourceEntityType: "document",
    sourceEntityId: requiredText(input.documentId, "Documento sugerido"),
    targetEntityType: "work_unit",
    targetEntityId: requiredText(input.workUnitId, "Trabajo sugerido"),
    relationType: "belongs_to",
    confidence: normalizeConfidence(input.confidence) ?? 0.7,
  };
}

export function buildProcessStructuringSuggestionAction(input: {
  processName: string;
  steps: string[];
  sourceNoteId?: string | null;
}) {
  return {
    action: "propose_process_structure",
    processName: requiredText(input.processName, "Nombre de proceso"),
    steps: input.steps.map((step) => requiredText(step, "Paso")).filter(Boolean),
    sourceNoteId: compactText(input.sourceNoteId),
  };
}

export function buildCompanyStatusBrief(input: {
  actions: Array<{
    title: string;
    description?: string | null;
    href: string;
  }>;
  fallbackHref: string;
}): CompanyStatusBrief {
  const links = input.actions
    .filter((action) => action.href)
    .slice(0, 3)
    .map((action) => ({
      title: action.title,
      href: action.href,
    }));

  if (links.length === 0) {
    return {
      question: "Que tengo que mirar hoy?",
      answer: "No hay bloqueos fuertes detectados en Inicio. Lo mas util es mantener cargados trabajos, documentos y tareas para que el tablero siga leyendo entidades reales.",
      links: [
        {
          title: "Abrir documentos",
          href: input.fallbackHref,
        },
      ],
    };
  }

  return {
    question: "Que tengo que mirar hoy?",
    answer: `Prioriza ${links[0].title}. Despues revisa ${links.slice(1).map((link) => link.title).join(" y ") || "la agenda operativa"}.`,
    links,
  };
}
