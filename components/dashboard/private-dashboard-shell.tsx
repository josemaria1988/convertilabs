import Link from "next/link";
import type { ReactNode } from "react";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { LoadingLink } from "@/components/ui/loading-link";

export type PrivateDashboardNavItem = {
  href: string;
  label: string;
  description: string;
  current?: boolean;
};

type PrivateDashboardShellProps = {
  organizationName: string;
  organizationSlug: string;
  userEmail?: string | null;
  userRole: string;
  title: string;
  description: string;
  navItems: PrivateDashboardNavItem[];
  toolbarLabel?: string;
  isExportCurrent?: boolean;
  children: ReactNode;
};

type IconProps = {
  className?: string;
};

function HomeIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13V10.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

function DocumentIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14 3.5V8h5" />
      <path d="M10 12h6" />
      <path d="M10 16h6" />
    </svg>
  );
}

function JournalIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 5h14v14H5z" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
      <path d="M9 17h3" />
    </svg>
  );
}

function TaxIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 18V6h16v12" />
      <path d="M7.5 15.5 10 12l2 2 4.5-5" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="m19.4 15-.9 1.55 1 1.85-1.8 1.6-1.8-1-1.55.9L12 22l-2.35-1.1-1.55-.9-1.8 1-1.8-1.6 1-1.85L4.6 15 2 12l2.6-3 .9-1.55-1-1.85 1.8-1.6 1.8 1 1.55-.9L12 2l2.35 1.1 1.55.9 1.8-1 1.8 1.6-1 1.85.9 1.55L22 12Z" />
    </svg>
  );
}

function ExportIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function ImportIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20V9" />
      <path d="m7.5 13.5 4.5-4.5 4.5 4.5" />
      <path d="M5 4h14" />
    </svg>
  );
}

function OpenItemsIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h9" />
      <path d="M17 16.5 19.5 19 22 16.5" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function CaretIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
    >
      <path d="M5.2 7.3 10 12.1l4.8-4.8.9.9-5.7 5.6-5.7-5.6.9-.9Z" />
    </svg>
  );
}

function UtilityIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 7h12" />
      <path d="M6 12h12" />
      <path d="M6 17h8" />
    </svg>
  );
}

function getNavIcon(label: string) {
  switch (label) {
    case "Inicio":
      return HomeIcon;
    case "Documentos":
      return DocumentIcon;
    case "Importaciones":
      return ImportIcon;
    case "Asientos":
      return JournalIcon;
    case "Saldos abiertos":
      return OpenItemsIcon;
    case "Impuestos":
      return TaxIcon;
    case "Configuracion":
      return SettingsIcon;
    default:
      return DocumentIcon;
  }
}

export function PrivateDashboardShell({
  organizationName,
  organizationSlug,
  userEmail,
  userRole,
  title,
  description,
  navItems,
  toolbarLabel,
  isExportCurrent = false,
  children,
}: PrivateDashboardShellProps) {
  const primaryItems = navItems.filter((item) => item.label !== "Configuracion");
  const settingsItem = navItems.find((item) => item.label === "Configuracion");
  const sectionLabel = toolbarLabel ?? title;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-panel">
          <div className="app-sidebar-brand">
            <Link href="/app" className="block">
              <ConvertilabsLogo />
            </Link>
          </div>

          <nav className="app-sidebar-nav">
            {primaryItems.map((item) => {
              const Icon = getNavIcon(item.label);

              if (item.current) {
                return (
                  <div
                    key={item.href}
                    className="app-nav-item"
                    data-current="true"
                >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              }

              return (
                <LoadingLink
                  key={item.href}
                  href={item.href}
                  pendingLabel="Abriendo..."
                  className="app-nav-item"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </LoadingLink>
              );
            })}
            <div className="app-sidebar-divider" />
            {isExportCurrent ? (
              <div className="app-nav-item opacity-95" data-current="true">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <ExportIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate text-white">Exportar</span>
              </div>
            ) : (
              <LoadingLink
                href={`/app/o/${organizationSlug}/exports`}
                pendingLabel="Abriendo..."
                className="app-nav-item opacity-95"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <ExportIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate text-white">Exportar</span>
              </LoadingLink>
            )}
          </nav>

          <div className="app-sidebar-footer">
            <span className="app-sidebar-footer-link">
              <UtilityIcon className="h-[14px] w-[14px]" />
              Tablero de ventas
            </span>
            <span className="app-sidebar-footer-link">
              <UtilityIcon className="h-[14px] w-[14px]" />
              Pendientes visibles
            </span>
            <span className="app-sidebar-footer-link">
              <UtilityIcon className="h-[14px] w-[14px]" />
              Procesamiento impositivo
            </span>
            {settingsItem ? (
              settingsItem.current ? (
                <span className="app-sidebar-footer-link pt-2 text-white">
                  <SettingsIcon className="h-[14px] w-[14px]" />
                  Configuracion
                </span>
              ) : (
                <LoadingLink
                  href={settingsItem.href}
                  pendingLabel="Abriendo..."
                  className="app-sidebar-footer-link pt-2"
                >
                  <SettingsIcon className="h-[14px] w-[14px]" />
                  Configuracion
                </LoadingLink>
              )
            ) : null}
          </div>
        </div>
      </aside>

      <main className="app-main" title={description}>
        <div className="app-topbar">
          <div className="app-topbar__section">
            <span className="flex h-4 w-4 items-center justify-center text-[color:var(--color-muted)]">
              <DocumentIcon className="h-[12px] w-[12px]" />
            </span>
            <span className="truncate">{sectionLabel}</span>
            <CaretIcon className="h-[11px] w-[11px] text-[color:var(--color-muted)]" />
          </div>

          <div className="app-topbar__actions">
            <span
              className="app-topbar__badge"
              title={`/app/o/${organizationSlug} | Rol ${userRole}`}
            >
              {organizationName}
            </span>
            <button type="button" className="app-topbar__icon" aria-label="Buscar">
              <SearchIcon className="h-[12px] w-[12px]" />
            </button>
            <AccountMenu
              organizationName={organizationName}
              organizationSlug={organizationSlug}
              userEmail={userEmail}
            />
          </div>
        </div>

        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
