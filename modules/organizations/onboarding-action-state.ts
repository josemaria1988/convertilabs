import type { OrganizationOnboardingFieldErrors } from "@/modules/organizations/onboarding-schema";

export type OnboardingActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: OrganizationOnboardingFieldErrors;
};

export const initialOnboardingActionState: OnboardingActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

export function normalizeOnboardingActionState(
  state: Partial<OnboardingActionState> | null | undefined,
): OnboardingActionState {
  return {
    status: state?.status === "error" ? "error" : "idle",
    message: typeof state?.message === "string" ? state.message : "",
    fieldErrors: state?.fieldErrors ?? {},
  };
}
