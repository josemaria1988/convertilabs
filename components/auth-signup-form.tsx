"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  signupPasswordMinLength,
  type SignupFieldErrors,
  type SignupInput,
  validateSignupInput,
} from "@/modules/auth/signup-schema";

type SignupFormFieldErrors = SignupFieldErrors & {
  confirmPassword?: string;
};

type SignupFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: SignupFormFieldErrors;
};

type SignupApiResponse = {
  data?: {
    status: string;
    email: string;
    message: string;
    next_step: string;
  };
  error?: {
    code: string;
    message: string;
    details?: SignupFieldErrors;
  };
};

const initialState: SignupFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

function getClientFieldErrors(input: SignupInput, confirmPassword: string) {
  const validation = validateSignupInput(input);
  const fieldErrors: SignupFormFieldErrors = validation.success
    ? {}
    : { ...validation.errors };

  if (input.password !== confirmPassword) {
    fieldErrors.confirmPassword = "Las contrasenas no coinciden.";
  }

  return fieldErrors;
}

export function AuthSignupForm() {
  const [state, setState] = useState<SignupFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  async function submitSignup(
    form: HTMLFormElement,
    payload: SignupInput,
  ) {
    try {
      const response = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as SignupApiResponse;

      if (!response.ok) {
        setState({
          status: "error",
          message:
            body.error?.message ??
            "No se pudo crear la cuenta. Intenta de nuevo.",
          fieldErrors: body.error?.details ?? {},
        });
        return;
      }

      form.reset();
      setState({
        status: "success",
        message:
          body.data?.message ??
          "La solicitud de alta fue registrada correctamente.",
        fieldErrors: {},
      });
    } catch {
      setState({
        status: "error",
        message:
          "No pudimos comunicarnos con el servicio de alta. Intenta de nuevo.",
        fieldErrors: {},
      });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: SignupInput = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const fieldErrors = getClientFieldErrors(payload, confirmPassword);

    if (Object.keys(fieldErrors).length > 0) {
      setState({
        status: "error",
        message: "Revisa los campos marcados antes de continuar.",
        fieldErrors,
      });
      return;
    }

    startTransition(() => {
      void submitSignup(form, payload);
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div aria-live="polite" className="min-h-6">
        {state.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
              state.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            {state.message}
          </div>
        ) : null}
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Nombre completo</span>
        <input
          type="text"
          name="fullName"
          autoComplete="name"
          placeholder="Jose Maria Sosa"
          aria-invalid={Boolean(state.fieldErrors.fullName)}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {state.fieldErrors.fullName ? (
          <p className="text-sm text-amber-800">{state.fieldErrors.fullName}</p>
        ) : null}
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          placeholder="equipo@convertilabs.com"
          aria-invalid={Boolean(state.fieldErrors.email)}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {state.fieldErrors.email ? (
          <p className="text-sm text-amber-800">{state.fieldErrors.email}</p>
        ) : null}
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Contrasena</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Minimo 12 caracteres"
          aria-invalid={Boolean(state.fieldErrors.password)}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
        />
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          Usa al menos {signupPasswordMinLength} caracteres y combina letras con
          numeros.
        </p>
        {state.fieldErrors.password ? (
          <p className="text-sm text-amber-800">{state.fieldErrors.password}</p>
        ) : null}
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Confirmar contrasena</span>
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Repite tu contrasena"
          aria-invalid={Boolean(state.fieldErrors.confirmPassword)}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
        />
        {state.fieldErrors.confirmPassword ? (
          <p className="text-sm text-amber-800">
            {state.fieldErrors.confirmPassword}
          </p>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-medium text-white transition hover:bg-[color:var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--color-muted)]">
        <p>La cuenta se crea en Supabase Auth y puede requerir confirmacion por email.</p>
        <Link href="/login" className="font-medium text-[color:var(--color-accent)]">
          Ya tengo cuenta
        </Link>
      </div>
    </form>
  );
}
