import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

export const metadata: Metadata = {
  title: "Pricing",
};

const tiers = [
  {
    title: "Starter",
    description:
      "Para equipos que quieren centralizar documentos y tener un dashboard operativo inicial.",
    price: "USD 299",
  },
  {
    title: "Growth",
    description:
      "Incluye journals, permisos por organizacion y pipeline fiscal sobre el core contable.",
    price: "USD 899",
  },
  {
    title: "Custom",
    description:
      "Integraciones, reglas avanzadas, AI aplicada y despliegue adaptado al flujo real del cliente.",
    price: "A medida",
  },
];

export default function PricingPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Pricing"
        title="Pricing inicial para validar valor antes de complejizar infraestructura."
        description="Estos planes son placeholders de producto. Sirven para definir narrativa comercial, alcance de modulos y futuras decisiones de packaging."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {tiers.map((tier) => (
          <SectionCard
            key={tier.title}
            title={tier.title}
            description={tier.description}
          >
            <p className="text-3xl font-semibold tracking-[-0.05em]">{tier.price}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
