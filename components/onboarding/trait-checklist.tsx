"use client";

import { HelpHint } from "@/components/ui/help-hint";
import { TraitGroupCard } from "@/components/onboarding/trait-group-card";
import type { HelpHintContent } from "@/modules/explanations/types";
import type { OrganizationTraitDefinition, OrganizationTraitGroup } from "@/modules/organizations/activity-types";
import { listOrganizationTraitsByGroup } from "@/modules/organizations/traits-catalog";

type TraitChecklistProps = {
  value: string[];
  onChange: (codes: string[]) => void;
};

const groupLabels: Record<OrganizationTraitGroup, { title: string; description: string }> = {
  business_activity: {
    title: "Que hace la empresa",
    description: "Describe la forma principal en que genera ingresos y organiza su operativa.",
  },
  tax_and_operations: {
    title: "Como opera fiscalmente",
    description: "Estas banderas ajustan IVA, multi-moneda, importaciones, exportaciones y otros tratamientos.",
  },
  operating_model: {
    title: "Como gestiona su operacion",
    description: "Ayuda a sugerir overlays contables orientados al tipo de gestion real del negocio.",
  },
};

function buildTraitHelpContent(trait: OrganizationTraitDefinition): HelpHintContent {
  return {
    key: `trait-${trait.code}`,
    title: trait.label,
    shortLabel: trait.description,
    whatIsIt: trait.description,
    whyItMatters:
      trait.affects_presets.length > 0
        ? `Se pregunta porque puede activar overlays como ${trait.affects_presets.join(", ")}.`
        : "Se pregunta para afinar la recomendacion del plan y explicar mejor el contexto operativo.",
    impact:
      trait.affects_tax_profiles.length > 0
        ? `Puede afectar perfiles fiscales como ${trait.affects_tax_profiles.join(", ")} y cambiar parte del tratamiento sugerido.`
        : "Puede sumar cuentas, templates y comentarios mas cercanos a tu operativa.",
    whatCanYouDo:
      "Marcalo solo si ese rasgo forma parte real de la empresa. Si cambia, puedes versionar el perfil despues desde organizacion.",
    sourceLabel:
      trait.source_kind === "official-inspired"
        ? "Logica registral o fiscal inspirada en Uruguay."
        : "Rasgo operativo propio del sistema.",
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function TraitChecklist({ value, onChange }: TraitChecklistProps) {
  const groups = listOrganizationTraitsByGroup();
  const selected = new Set(value);

  function toggleTrait(traitCode: string) {
    if (selected.has(traitCode)) {
      onChange(value.filter((code) => code !== traitCode));
      return;
    }

    onChange(unique([...value, traitCode]));
  }

  function renderTrait(trait: OrganizationTraitDefinition) {
    return (
      <label
        key={trait.code}
        className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white/8 px-4 py-3 text-sm"
      >
        <input
          type="checkbox"
          checked={selected.has(trait.code)}
          onChange={() => {
            toggleTrait(trait.code);
          }}
          className="mt-1 h-4 w-4 rounded border border-[color:var(--color-border)]"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-medium text-white">
            <span>{trait.label}</span>
            <HelpHint content={buildTraitHelpContent(trait)} />
          </span>
          <span className="mt-1 block leading-6 text-[color:var(--color-muted)]">
            {trait.description}
          </span>
        </span>
      </label>
    );
  }

  return (
    <div className="space-y-4">
      {(["business_activity", "tax_and_operations", "operating_model"] as const).map((groupCode) => (
        <TraitGroupCard
          key={groupCode}
          title={groupLabels[groupCode].title}
          description={groupLabels[groupCode].description}
        >
          {groups[groupCode].map(renderTrait)}
        </TraitGroupCard>
      ))}

      {selected.has("vat_exempt_or_non_taxed_operations")
        && !selected.has("mixed_vat_operations") ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Marcaste operaciones exentas o no gravadas. Si tambien convivis con operaciones gravadas, conviene marcar operativa mixta para que la sugerencia contemple IVA indirecto y prorrata.
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  onChange(unique([...value, "mixed_vat_operations"]));
                }}
                className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-500/20"
              >
                Marcar operativa mixta
              </button>
            </div>
          </div>
        ) : null}
    </div>
  );
}
