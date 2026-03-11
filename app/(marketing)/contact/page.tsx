import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { SectionCard } from "@/components/section-card";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHero
        eyebrow="Contact"
        title="Contacto directo para discovery, pilotos e integraciones."
        description="La pagina es un placeholder util para el repo inicial. Mas adelante puede conectarse a CRM, email transactional o un flujo propio dentro de la app."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Email"
          description="Canal mas directo para oportunidades, demos o decisiones tecnicas."
        >
          <p className="text-lg font-semibold">{siteConfig.contactEmail}</p>
        </SectionCard>
        <SectionCard
          title="Base operativa"
          description="El producto se puede desplegar en Vercel y operar con equipo distribuido desde el dia uno."
        >
          <p className="text-lg font-semibold">{siteConfig.location}</p>
        </SectionCard>
      </div>
    </div>
  );
}
