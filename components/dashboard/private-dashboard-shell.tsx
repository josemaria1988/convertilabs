import type { ReactNode } from "react";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { DocumentSpreadsheetImportNotifier } from "@/components/documents/document-spreadsheet-import-notifier";
import { LoadingLink } from "@/components/ui/loading-link";

export type PrivateDashboardNavItem = {
  href: string;
  label: string;
  description: string;
  icon?: "tray" | "accounting" | "tax" | "audit" | "settings";
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

function TrayIcon({ className }: IconProps) {
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
      <path d="M4.5 6.5h15" />
      <path d="M6 6.5v10.5h12V6.5" />
      <path d="M8.5 10.5h7" />
      <path d="M8.5 14.5h4.5" />
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
      <path d="M5 5.5h14v13H5z" />
      <path d="M8 9.5h8" />
      <path d="M8 13.5h3" />
      <path d="M14.5 12 16 13.5l2.5-3" />
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

function AuditIcon({ className }: IconProps) {
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
      <path d="M7 4.5h8l3 3V19.5H7z" />
      <path d="M15 4.5v3h3" />
      <path d="M9.5 11h5" />
      <path d="M9.5 14.5h5" />
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

function HelpIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.7a2.4 2.4 0 1 1 3.9 1.9c-.8.6-1.2 1-1.2 2" />
      <path d="M12 16.8h.01" />
    </svg>
  );
}

function SupportIcon({ className }: IconProps) {
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
      <path d="M5 12a7 7 0 1 1 14 0" />
      <path d="M5.5 12H4a1.5 1.5 0 0 0 0 3h1.5" />
      <path d="M18.5 12H20a1.5 1.5 0 0 1 0 3h-1.5" />
      <path d="M9.5 18h5" />
    </svg>
  );
}

function ExitIcon({ className }: IconProps) {
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
      <path d="M10 6H6v12h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M8 12h10" />
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

function getNavIcon(iconKey?: PrivateDashboardNavItem["icon"]) {
  switch (iconKey) {
    case "accounting":
      return AccountingIcon;
    case "tax":
      return TaxIcon;
    case "audit":
      return AuditIcon;
    case "settings":
      return SettingsIcon;
    case "tray":
    default:
      return TrayIcon;
  }
}

function isPrimaryMobileNavItem(item: PrivateDashboardNavItem) {
  return ["tray", "accounting", "tax", "audit", "settings"].includes(item.icon ?? "tray");
}

function getMobileNavLabel(item: PrivateDashboardNavItem) {
  return item.label;
}

export function PrivateDashboardShell({
  organizationName,
  organizationSlug,
  userEmail,
  title,
  description,
  navItems,
  toolbarLabel,
  children,
}: PrivateDashboardShellProps) {
  const sectionLabel = toolbarLabel ?? title;
  const currentItem = navItems.find((item) => item.current) ?? null;
  const CurrentIcon = getNavIcon(currentItem?.icon);
  const mobilePrimaryNavItems = navItems.filter(isPrimaryMobileNavItem);

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
              const Icon = getNavIcon(item.icon);

              return (
                <LoadingLink
                  key={item.href}
                  href={item.href}
                  pendingLabel="Abriendo..."
                  className="app-nav-item"
                  data-current={item.current ? "true" : undefined}
                  aria-current={item.current ? "page" : undefined}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </LoadingLink>
              );
            })}
          </nav>

          <div className="app-sidebar-footer">
            <LoadingLink href={`/app/o/${organizationSlug}/settings`} pendingLabel="Abriendo..." className="app-sidebar-footer-link">
              <HelpIcon className="h-[16px] w-[16px]" />
              <span>Ayuda</span>
            </LoadingLink>
            <LoadingLink href={`/app/o/${organizationSlug}/settings?tab=integrations`} pendingLabel="Abriendo..." className="app-sidebar-footer-link">
              <SupportIcon className="h-[16px] w-[16px]" />
              <span>Soporte</span>
            </LoadingLink>
            <form action="/logout" method="post" className="app-sidebar-footer-link">
              <button type="submit" className="flex items-center gap-2 text-inherit">
                <ExitIcon className="h-[16px] w-[16px]" />
                <span>Salir</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-mobile-header">
          <div className="app-mobile-header__top">
            <LoadingLink
              href="/app"
              pendingLabel="Abriendo..."
              className="app-mobile-header__brand"
            >
              <ConvertilabsLogo />
            </LoadingLink>

            <div className="app-mobile-header__actions">
              <span className="app-mobile-header__badge">{organizationName}</span>
              <AccountMenu
                organizationName={organizationName}
                organizationSlug={organizationSlug}
                userEmail={userEmail}
              />
            </div>
          </div>

          <div className="app-mobile-header__card">
            <span className="app-mobile-header__eyebrow">
              <CurrentIcon className="h-[14px] w-[14px]" />
              <span>{sectionLabel}</span>
            </span>
            <h1 className="app-mobile-header__title">{title}</h1>
            <p className="app-mobile-header__description">{description}</p>
          </div>
        </div>

        <div className="app-topbar">
          <div className="app-topbar__section">
            <span className="flex h-4 w-4 items-center justify-center text-[color:var(--color-muted)]">
              <CurrentIcon className="h-[12px] w-[12px]" />
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

        {mobilePrimaryNavItems.length > 0 ? (
          <nav className="app-mobile-nav" aria-label="Navegacion principal">
            {mobilePrimaryNavItems.map((item) => {
              const Icon = getNavIcon(item.icon);

              return (
                <LoadingLink
                  key={item.href}
                  href={item.href}
                  pendingLabel={getMobileNavLabel(item)}
                  className="app-mobile-nav__item"
                  data-current={item.current ? "true" : undefined}
                  aria-current={item.current ? "page" : undefined}
                >
                  <span className="app-mobile-nav__content">
                    <span className="app-mobile-nav__icon">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="app-mobile-nav__label">
                      {getMobileNavLabel(item)}
                    </span>
                  </span>
                </LoadingLink>
              );
            })}
          </nav>
        ) : null}
      </main>
    </div>
  );
}
