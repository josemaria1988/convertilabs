export const ACCOUNTING_ASSISTANT_DISPLAY_NAME = "Asistente Contable";
export const ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID = "system_ai_assistant";
export const DOCUMENT_REVIEWER_ASSISTANT_CODE = "document_reviewer_assistant";

export type AssistantPersonaCode =
  | "document_reviewer_assistant"
  | "tax_assistant"
  | "close_assistant"
  | "audit_assistant";

export type AssistantPersonaPresentation = {
  code: AssistantPersonaCode;
  displayName: string;
  subtitle: string;
  scope: "documents" | "tax" | "close" | "audit";
  avatarLabel: string;
  tone: string;
  specialty: string;
  systemActorId: string;
};

const PERSONA_PRESENTATION: Record<AssistantPersonaCode, AssistantPersonaPresentation> = {
  document_reviewer_assistant: {
    code: "document_reviewer_assistant",
    displayName: ACCOUNTING_ASSISTANT_DISPLAY_NAME,
    subtitle: "Revision documental",
    scope: "documents",
    avatarLabel: "AC",
    tone: "claro, analitico y consultivo",
    specialty: "Revision documental y propuestas contables dentro del workflow de documentos.",
    systemActorId: ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID,
  },
  tax_assistant: {
    code: "tax_assistant",
    displayName: ACCOUNTING_ASSISTANT_DISPLAY_NAME,
    subtitle: "Fiscal",
    scope: "tax",
    avatarLabel: "AC",
    tone: "claro, analitico y consultivo",
    specialty: "Asistencia fiscal y trazabilidad sobre IVA, validaciones y anomalias.",
    systemActorId: ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID,
  },
  close_assistant: {
    code: "close_assistant",
    displayName: ACCOUNTING_ASSISTANT_DISPLAY_NAME,
    subtitle: "Cierre",
    scope: "close",
    avatarLabel: "AC",
    tone: "claro, analitico y consultivo",
    specialty: "Asistencia sobre cierre contable, checks y bloqueos operativos.",
    systemActorId: ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID,
  },
  audit_assistant: {
    code: "audit_assistant",
    displayName: ACCOUNTING_ASSISTANT_DISPLAY_NAME,
    subtitle: "Auditoria",
    scope: "audit",
    avatarLabel: "AC",
    tone: "claro, analitico y consultivo",
    specialty: "Asistencia sobre imports, evidencia y resoluciones auditables.",
    systemActorId: ACCOUNTING_ASSISTANT_SYSTEM_ACTOR_ID,
  },
};

export function isAssistantPersonaCode(value: string | null | undefined): value is AssistantPersonaCode {
  return Boolean(value && value in PERSONA_PRESENTATION);
}

export function getAssistantPersonaPresentation(
  personaCode: string | null | undefined,
): AssistantPersonaPresentation {
  if (personaCode && isAssistantPersonaCode(personaCode)) {
    return PERSONA_PRESENTATION[personaCode];
  }

  return PERSONA_PRESENTATION.document_reviewer_assistant;
}
