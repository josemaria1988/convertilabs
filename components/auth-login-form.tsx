"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { LoadingLink } from "@/components/ui/loading-link";
import {
  type LoginFieldErrors,
  type LoginInput,
  validateLoginInput,
} from "@/modules/auth/login-schema";

type LoginFormState = {
  status: "idle" | "error";
  message: string;
  fieldErrors: LoginFieldErrors;
};

type LoginApiResponse = {
  data?: {
    status: string;
    message: string;
    redirect_to: string;
  };
  error?: {
    code: string;
    message: string;
    details?: LoginFieldErrors;
  };
};

const initialState: LoginFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

type AuthLoginFormProps = {
  nextPath?: string | null;
};

export function AuthLoginForm({ nextPath }: AuthLoginFormProps) {
  const router = useRouter();
  const [state, setState] = useState<LoginFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  async function submitLogin(payload: LoginInput) {
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as LoginApiResponse;

      if (!response.ok) {
        setState({
          status: "error",
          message:
            body.error?.message ??
            "No se pudo iniciar sesion. Intenta de nuevo.",
          fieldErrors: body.error?.details ?? {},
        });
        return;
      }

      router.replace(body.data?.redirect_to ?? "/app");
      router.refresh();
    } catch {
      setState({
        status: "error",
        message:
          "No pudimos comunicarnos con el servicio de ingreso. Intenta de nuevo.",
        fieldErrors: {},
      });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: LoginInput = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      next: nextPath ?? undefined,
    };
    const validation = validateLoginInput(payload);

    if (!validation.success) {
      setState({
        status: "error",
        message: "Revisa los campos marcados antes de continuar.",
        fieldErrors: validation.errors,
      });
      return;
    }

    startTransition(() => {
      void submitLogin(validation.data);
    });
  }

  return (
    <form className="max-w-[270px] space-y-4" onSubmit={handleSubmit}>
      <div aria-live="polite" className="min-h-5">
        {state.message ? (
          <div className="rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-6 text-amber-950">
            {state.message}
          </div>
        ) : null}
      </div>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-[color:var(--color-muted)]">
          Correo electronico
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="equipo@convertilabs.com"
          aria-invalid={Boolean(state.fieldErrors.email)}
          className="h-[36px] w-full rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(56,66,86,0.42)] px-3.5 text-[14px] outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {state.fieldErrors.email ? (
          <p className="text-[13px] text-amber-800">{state.fieldErrors.email}</p>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium text-[color:var(--color-muted)]">
          Contrasena
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Tu contrasena"
          aria-invalid={Boolean(state.fieldErrors.password)}
          className="h-[36px] w-full rounded-[6px] border border-[color:var(--color-border)] bg-[rgba(56,66,86,0.42)] px-3.5 text-[14px] outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {state.fieldErrors.password ? (
          <p className="text-[13px] text-amber-800">{state.fieldErrors.password}</p>
        ) : null}
      </label>

      <div className="flex items-center justify-between gap-4 text-[13px] text-[color:var(--color-muted)]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="remember" className="h-3.5 w-3.5" />
          <span>Recordarme</span>
        </label>
        <span className="text-[color:var(--color-accent-strong)]">
          Olvidaste tu contrasena?
        </span>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="ui-button ui-button--primary min-w-[118px] flex-1 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <InlineSpinner /> : null}
          {isPending ? "Ingresando..." : "Ingresar"}
        </button>
        <LoadingLink
          href="/signup"
          pendingLabel="Abriendo..."
          className="ui-button ui-button--secondary min-w-[118px] flex-1"
        >
          Crear cuenta
        </LoadingLink>
      </div>
    </form>
  );
}
