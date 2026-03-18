import type { ReactNode } from "react";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { DocumentSpreadsheetImportNotifier } from "@/components/documents/document-spreadsheet-import-notifier";
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

function AccountingIcon({ className }: IconProps) {
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
      <path d="M5 6.5h14" />
      <path d="M5 12h14" />
      <path d="M5 17.5h9" />
      <path d="M17 17.5h2" />
      <path d="M7 5v14" />
      <path d="M15 5v9" />
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

function ChartMapIcon({ className }: IconProps) {
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
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="17" r="2.2" />
      <path d="M8 7h7.7" />
      <path d="M7.4 8.8 10.6 15" />
      <path d="M16.6 7.8 13.4 15" />
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

function getNavIcon(label: string) {
  switch (label) {
    case "Documentos":
      return DocumentIcon;
    case "Contabilidad":
      return AccountingIcon;
    case "Impuestos":
      return TaxIcon;
    case "Mapa contable":
      return ChartMapIcon;
    case "Configuracion":
      return SettingsIcon;
    default:
      return HomeIcon;
  }
}

export function PrivateDashboardShell({
  organizationName,
  organizationSlug,
  userEmail,
  title,
  navItems,
  toolbarLabel,
  children,
}: PrivateDashboardShellProps) {
  const sectionLabel = toolbarLabel ?? title;

  return (
    <div className="app-shell">
      <DocumentSpreadsheetImportNotifier slug={organizationSlug} />
      <aside className="app-sidebar">
        <div className="app-sidebar-panel">
          <div className="app-sidebar-brand">
            <LoadingLink href="/app" pendingLabel="Abriendo..." className="block">
              <ConvertilabsLogo />
            </LoadingLink>
          </div>

          <nav className="app-sidebar-nav">
            {navItems.map((item) => {
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
          </nav>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-topbar">
          <div className="app-topbar__section">
            <span className="flex h-4 w-4 items-center justify-center text-[color:var(--color-muted)]">
              <DocumentIcon className="h-[12px] w-[12px]" />
            </span>
            <span className="truncate">{sectionLabel}</span>
            <CaretIcon className="h-[11px] w-[11px] text-[color:var(--color-muted)]" />
          </div>

          <div className="app-topbar__actions">
            <span className="app-topbar__badge">
              {organizationName}
            </span>
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
