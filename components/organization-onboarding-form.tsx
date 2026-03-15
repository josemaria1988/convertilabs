"use client";

import { useActionState, useState } from "react";
import { createOrganizationAction } from "@/app/onboarding/actions";
import { BusinessProfileConfigurator } from "@/components/onboarding/business-profile-configurator";
import { HelpHint } from "@/components/ui/help-hint";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import type { OnboardingFeatureFlags } from "@/modules/organizations/feature-flags";
import {
  initialOnboardingActionState,
  normalizeOnboardingActionState,
} from "@/modules/organizations/onboarding-action-state";
import {
  organizationNameMaxLength,
  organizationNameMinLength,
  slugifyOrganizationNamePreview,
  supportedCfeStatuses,
  supportedDgiGroups,
  supportedLegalEntityTypes,
  supportedTaxRegimeCodes,
  supportedVatRegimes,
} from "@/modules/organizations/onboarding-schema";

type OrganizationOnboardingFormProps = {
  userEmail?: string | null;
  featureFlags: OnboardingFeatureFlags;
};

type LabelWithHelpProps = {
  label: string;
  helpKey?: string;
  enabled?: boolean;
};

function LabelWithHelp({
  label,
  helpKey,
  enabled = true,
}: LabelWithHelpProps) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium">
      <span>{label}</span>
      {enabled && helpKey ? <HelpHint contentKey={helpKey} /> : null}
    </span>
  );
}

export function OrganizationOnboardingForm({
  userEmail,
  featureFlags,
}: OrganizationOnboardingFormProps) {
  const [organizationName, setOrganizationName] = useState("");
  const [legalEntityType, setLegalEntityType] = useState("SAS");
  const [taxRegimeCode, setTaxRegimeCode] = useState("IRAE_GENERAL");
  const [vatRegime, setVatRegime] = useState("GENERAL");
  const [dgiGroup, setDgiGroup] = useState("NO_CEDE");
  const [cfeStatus, setCfeStatus] = useState("ELECTRONIC_ISSUER");
  const [taxId, setTaxId] = useState("");
  const [highlightSubmit, setHighlightSubmit] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createOrganizationAction,
    initialOnboardingActionState,
  );
  const safeState = normalizeOnboardingActionState(state);
  const slugPreview = slugifyOrganizationNamePreview(organizationName);
  const showGuidedBusinessProfile = featureFlags.onboardingActivityBasedPresetsEnabled;

  return (
    <form className="space-y-6" action={formAction}>
      <div aria-live="polite" className="min-h-6">
        {safeState.message ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            {safeState.message}
          </div>
        ) : null}
      </div>

      <section className="space-y-5">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            Datos base
          </p>
          <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
            Identidad legal y fiscal
          </h3>
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            Esto deja creada la organizacion y materializa el contexto base para operar en Uruguay.
          </p>
        </div>

        <label className="block space-y-2">
          <LabelWithHelp
            label="Nombre de la organizacion"
            enabled={featureFlags.uiHelpHintsEnabled}
          />
          <input
            type="text"
            name="name"
            value={organizationName}
            onChange={(event) => {
              setOrganizationName(event.target.value);
            }}
            maxLength={organizationNameMaxLength}
            placeholder="Rontil S.A."
            aria-invalid={Boolean(safeState.fieldErrors.name)}
            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
          />
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            Usa entre {organizationNameMinLength} y {organizationNameMaxLength} caracteres. El slug final se genera en servidor.
          </p>
          {safeState.fieldErrors.name ? (
            <p className="text-sm text-amber-800">{safeState.fieldErrors.name}</p>
          ) : null}
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block space-y-2">
            <LabelWithHelp
              label="Forma juridica"
              helpKey="forma_juridica"
              enabled={featureFlags.uiHelpHintsEnabled}
            />
            <select
              name="legalEntityType"
              value={legalEntityType}
              onChange={(event) => {
                setLegalEntityType(event.target.value);
              }}
              aria-invalid={Boolean(safeState.fieldErrors.legalEntityType)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
            >
              {supportedLegalEntityTypes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {safeState.fieldErrors.legalEntityType ? (
              <p className="text-sm text-amber-800">
                {safeState.fieldErrors.legalEntityType}
              </p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <LabelWithHelp
              label="Regimen tributario"
              helpKey="regimen_tributario"
              enabled={featureFlags.uiHelpHintsEnabled}
            />
            <select
              name="taxRegimeCode"
              value={taxRegimeCode}
              onChange={(event) => {
                setTaxRegimeCode(event.target.value);
              }}
              aria-invalid={Boolean(safeState.fieldErrors.taxRegimeCode)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
            >
              {supportedTaxRegimeCodes.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {safeState.fieldErrors.taxRegimeCode ? (
              <p className="text-sm text-amber-800">
                {safeState.fieldErrors.taxRegimeCode}
              </p>
            ) : null}
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <label className="block space-y-2">
            <LabelWithHelp
              label="Regimen IVA"
              helpKey="regimen_iva"
              enabled={featureFlags.uiHelpHintsEnabled}
            />
            <select
              name="vatRegime"
              value={vatRegime}
              onChange={(event) => {
                setVatRegime(event.target.value);
              }}
              aria-invalid={Boolean(safeState.fieldErrors.vatRegime)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
            >
              {supportedVatRegimes.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {safeState.fieldErrors.vatRegime ? (
              <p className="text-sm text-amber-800">{safeState.fieldErrors.vatRegime}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <LabelWithHelp
              label="Grupo DGI"
              helpKey="grupo_dgi"
              enabled={featureFlags.uiHelpHintsEnabled}
            />
            <select
              name="dgiGroup"
              value={dgiGroup}
              onChange={(event) => {
                setDgiGroup(event.target.value);
              }}
              aria-invalid={Boolean(safeState.fieldErrors.dgiGroup)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
            >
              {supportedDgiGroups.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {safeState.fieldErrors.dgiGroup ? (
              <p className="text-sm text-amber-800">{safeState.fieldErrors.dgiGroup}</p>
            ) : null}
          </label>

          <label className="block space-y-2">
            <LabelWithHelp
              label="Estado CFE"
              helpKey="estado_cfe"
              enabled={featureFlags.uiHelpHintsEnabled}
            />
            <select
              name="cfeStatus"
              value={cfeStatus}
              onChange={(event) => {
                setCfeStatus(event.target.value);
              }}
              aria-invalid={Boolean(safeState.fieldErrors.cfeStatus)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
            >
              {supportedCfeStatuses.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            {safeState.fieldErrors.cfeStatus ? (
              <p className="text-sm text-amber-800">{safeState.fieldErrors.cfeStatus}</p>
            ) : null}
          </label>
        </div>

        <label className="block space-y-2">
          <LabelWithHelp
            label="RUT de la organizacion"
            enabled={featureFlags.uiHelpHintsEnabled}
          />
          <input
            type="text"
            name="taxId"
            value={taxId}
            onChange={(event) => {
              setTaxId(event.target.value);
            }}
            inputMode="numeric"
            placeholder="211234560019"
            aria-invalid={Boolean(safeState.fieldErrors.taxId)}
            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white/75 px-4 py-3 outline-none transition focus:border-[color:var(--color-accent)]"
          />
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            V1 usa pais UY y exige RUT, forma juridica, regimen tributario, regimen IVA, grupo DGI y estado CFE para materializar el perfil base y las reglas resumidas.
          </p>
          {safeState.fieldErrors.taxId ? (
            <p className="text-sm text-amber-800">{safeState.fieldErrors.taxId}</p>
          ) : null}
        </label>
      </section>

      {showGuidedBusinessProfile ? (
        <BusinessProfileConfigurator
          presetAiRecommendationEnabled={featureFlags.presetAiRecommendationEnabled}
          organizationContext={{
            organizationName,
            legalEntityType,
            taxId,
            taxRegimeCode,
            vatRegime,
            dgiGroup,
            cfeStatus,
          }}
          onReadyToSaveHighlightChange={setHighlightSubmit}
          uiHelpHintsEnabled={featureFlags.uiHelpHintsEnabled}
          fieldErrors={safeState.fieldErrors}
        />
      ) : null}

      <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-white/72 p-4">
        <p className="text-sm font-semibold">Vista previa del slug</p>
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
        className={`inline-flex w-full items-center justify-center gap-2 rounded-[0.95rem] border border-[rgba(124,157,255,0.22)] bg-[linear-gradient(180deg,rgba(104,143,255,0.95),rgba(72,115,235,0.95))] px-4 py-3 font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 ${
          highlightSubmit
            ? "shadow-[0_0_0_1px_rgba(124,157,255,0.4),0_18px_44px_rgba(54,82,144,0.24)]"
            : ""
        }`}
      >
        {isPending ? <InlineSpinner /> : null}
        {isPending ? "Creando organizacion..." : "Crear organizacion"}
      </button>
    </form>
  );
}
