import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="About"
        title="Convertilabs nace para ordenar el backoffice financiero con menos friccion."
        description="La tesis es simple: documentos, contabilidad y fiscalidad comparten demasiados datos como para vivir en silos desde el inicio. El producto se diseña desde esa convergencia."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Principio de producto"
          description="Menos capas al comienzo, mas claridad de dominio, y una estructura que soporte evolucion tecnica sin rehacer el negocio."
        />
        <SectionCard
          title="Direccion tecnica"
          description="Next.js para velocidad, modulos por dominio para orden, y base de datos en Supabase o Neon mientras se define la plataforma definitiva."
        />
      </div>
    </div>
  );
}
