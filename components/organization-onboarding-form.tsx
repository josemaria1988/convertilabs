"use client";

import { useActionState, useState } from "react";
import {
  createOrganizationAction,
  initialOnboardingActionState,
} from "@/app/onboarding/actions";
import {
  organizationNameMaxLength,
  organizationNameMinLength,
  slugifyOrganizationNamePreview,
} from "@/modules/organizations/onboarding-schema";

type OrganizationOnboardingFormProps = {
  userEmail?: string | null;
};

export function OrganizationOnboardingForm({
  userEmail,
}: OrganizationOnboardingFormProps) {
  const [organizationName, setOrganizationName] = useState("");
  const [state, formAction, isPending] = useActionState(
    createOrganizationAction,
    initialOnboardingActionState,
  );
  const slugPreview = slugifyOrganizationNamePreview(organizationName);

  return (
    <form className="space-y-5" action={formAction}>
      <div aria-live="polite" className="min-h-6">
        {state.message ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {state.message}
          </div>
        ) : null}
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Nombre de la organizacion</span>
        <input
          type="text"
          name="name"
          value={organizationName}
          onChange={(event) => {
            setOrganizationName(event.target.value);
          }}
          maxLength={organizationNameMaxLength}
          placeholder="Rontil SAS"
          aria-invalid={Boolean(state.fieldErrors.name)}
          className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
        />
        <p className="text-sm leading-6 text-[color:var(--color-muted)]">
          Usa entre {organizationNameMinLength} y {organizationNameMaxLength}{" "}
          caracteres. El slug final se genera en servidor.
        </p>
        {state.fieldErrors.name ? (
          <p className="text-sm text-amber-800">{state.fieldErrors.name}</p>
        ) : null}
      </label>

      <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
        <p className="text-sm font-semibold">Preview de slug</p>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">
          {slugPreview
            ? `/app/o/${slugPreview}/dashboard`
            : "/app/o/<slug>/dashboard"}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          {userEmail ? `Owner inicial: ${userEmail}` : "Owner inicial: cuenta autenticada"}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-medium text-white transition hover:bg-[color:var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Creando organizacion..." : "Crear organizacion"}
      </button>
    </form>
  );
}
