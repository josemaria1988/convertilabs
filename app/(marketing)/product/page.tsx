import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

export const metadata: Metadata = {
  title: "Product",
};

const productAreas = [
  {
    title: "Documents",
    description:
      "Ingreso multicanal, extraccion asistida y aprobaciones con trazabilidad.",
  },
  {
    title: "Accounting",
    description:
      "Reglas de contabilizacion, journals y cierres preparados para operar por organizacion.",
  },
  {
    title: "Tax",
    description:
      "Vencimientos, validaciones y checklist fiscal sin sacar datos del flujo principal.",
  },
  {
    title: "AI",
    description:
      "Clasificacion documental, sugerencias operativas y soporte contextual para el equipo.",
  },
];

export default function ProductPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Producto"
        title="Un producto pensado por modulos, no por paginas sueltas."
        description="La arquitectura funcional se apoya en dominios claros: autenticacion, organizaciones, documentos, contabilidad, fiscalidad y AI. La UI es solo la capa visible de esos modulos."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {productAreas.map((area) => (
          <SectionCard key={area.title} title={area.title} description={area.description} />
        ))}
      </div>
    </div>
  );
}
