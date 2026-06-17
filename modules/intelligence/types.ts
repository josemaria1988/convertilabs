export const OPERATIONAL_SUGGESTION_TYPES = [
  "work_unit_assignment_suggestion",
  "party_resolution_suggestion",
  "task_suggestion",
  "process_structuring_suggestion",
  "continuity_risk_suggestion",
  "company_status_summary",
  "money_risk_summary",
] as const;

export type OperationalSuggestionType = (typeof OPERATIONAL_SUGGESTION_TYPES)[number];

export const OPERATIONAL_SUGGESTION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "expired",
] as const;

export type OperationalSuggestionStatus = (typeof OPERATIONAL_SUGGESTION_STATUSES)[number];

export type OperationalSuggestionAction = Record<string, unknown>;

export type OperationalSuggestionPayload = {
  organization_id: string;
  suggestion_type: OperationalSuggestionType;
  source_entity_type: string | null;
  source_entity_id: string | null;
  suggested_action_json: OperationalSuggestionAction;
  confidence: number | null;
  reason: string | null;
  required_evidence_json: unknown[];
  status: "pending";
  expires_at: string | null;
  metadata_json: Record<string, unknown>;
  created_by: string | null;
};

export type OperationalSuggestionRow = Omit<OperationalSuggestionPayload, "status"> & {
  id: string;
  status: OperationalSuggestionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  result_entity_type: string | null;
  result_entity_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyStatusBrief = {
  question: string;
  answer: string;
  links: Array<{
    title: string;
    href: string;
  }>;
};
