"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { FieldWelcomeGuide } from "@/components/mobile/field-welcome-guide";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { LoadingLink } from "@/components/ui/loading-link";

type FieldExperienceFrameProps = {
  organizationName: string;
  organizationSlug: string;
  userId?: string | null;
  children: ReactNode;
};

function resolveGuideStorageKey(input: {
  userId?: string | null;
  slug: string;
}) {
  return `convertilabs:field-welcome:v1:${input.userId ?? "anonymous"}:${input.slug}`;
}

export function FieldExperienceFrame({
  organizationName,
  organizationSlug,
  userId,
  children,
}: FieldExperienceFrameProps) {
  const pathname = usePathname();
  const [guideOpen, setGuideOpen] = useState(false);
  const guideStorageKey = useMemo(() =>
    resolveGuideStorageKey({
      userId,
      slug: organizationSlug,
    }), [organizationSlug, userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const guideAlreadySeen = window.localStorage.getItem(guideStorageKey);

    if (!guideAlreadySeen) {
      setGuideOpen(true);
    }
  }, [guideStorageKey]);

  const navItems = [
    {
      href: `/app/o/${organizationSlug}/field`,
      label: "Inicio",
    },
    {
      href: `/app/o/${organizationSlug}/field/upload`,
      label: "Subir",
    },
    {
      href: `/app/o/${organizationSlug}/field/activity`,
      label: "Actividad",
    },
    {
      href: `/app/o/${organizationSlug}/field/projects`,
      label: "Proyectos",
    },
  ];

  return (
    <div className="field-shell">
      <FieldWelcomeGuide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
        }}
        onComplete={() => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(guideStorageKey, "seen");
          }

          setGuideOpen(false);
        }}
      />

      <header className="field-shell__header">
        <LoadingLink
          href={`/app/o/${organizationSlug}/field`}
          pendingLabel="Abriendo..."
          className="min-w-0"
        >
          <ConvertilabsLogo subtitle="Campo" />
        </LoadingLink>

        <div className="field-shell__header-actions">
          <span className="field-shell__organization">{organizationName}</span>
          <button
            type="button"
            className="ui-button ui-button--ghost min-h-[38px] px-3"
            onClick={() => {
              setGuideOpen(true);
            }}
          >
            Guia
          </button>
          <LoadingLink
            href={`/app/o/${organizationSlug}/dashboard`}
            pendingLabel="Abriendo..."
            className="ui-button ui-button--secondary min-h-[38px] px-4"
          >
            Abrir web
          </LoadingLink>
        </div>
      </header>

      <PwaInstallPrompt />

      <main className="field-shell__content">{children}</main>

      <nav className="field-shell__nav" aria-label="Navegacion mobile de campo">
        {navItems.map((item) => {
          const isCurrent = pathname === item.href;

          return (
            <LoadingLink
              key={item.href}
              href={item.href}
              pendingLabel={item.label}
              className="field-shell__nav-item"
              data-current={isCurrent ? "true" : undefined}
              aria-current={isCurrent ? "page" : undefined}
            >
              {item.label}
            </LoadingLink>
          );
        })}
      </nav>
    </div>
  );
}
