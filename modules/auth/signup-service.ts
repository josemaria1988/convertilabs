import "server-only";
import type { SignupInput } from "@/modules/auth/signup-schema";

type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type SignupServiceResult = {
  ok: false;
  status: 403;
  error: ApiError;
};

export async function signupUser(input: SignupInput): Promise<SignupServiceResult> {
  void input;

  return {
    ok: false,
    status: 403,
    error: {
      code: "invite_only",
      message:
        "El acceso nuevo a Convertilabs se habilita solo por invitacion. Escribenos para solicitar una prueba sin costo.",
    },
  };
}
