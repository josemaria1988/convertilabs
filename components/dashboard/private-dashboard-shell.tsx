import type { ReactNode } from "react";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { DocumentSpreadsheetImportNotifier } from "@/components/documents/document-spreadsheet-import-notifier";
import { LoadingLink } from "@/components/ui/loading-link";

export type PrivateDashboardNavItem = {
  href: string;
  label: string;
  description: string;
  icon?: "home" | "documents" | "review" | "tax" | "close" | "settings" | "advanced";
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

function ReviewIcon({ className }: IconProps) {
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
      <path d="M5 12h8" />
      <path d="M5 17.5h10" />
      <path d="m16.8 15.8 1.6 1.6 2.8-3.3" />
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

function CloseIcon({ className }: IconProps) {
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
      <path d="M6 4.5h12v15H6z" />
      <path d="M9 2.5v4" />
      <path d="M15 2.5v4" />
      <path d="M9 11.5h6" />
      <path d="M9 15.5h4" />
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

function AdvancedIcon({ className }: IconProps) {
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
      <path d="M12 3.5 14 7.5l4.5.7-3.2 3.1.8 4.7-4.1-2.1-4.1 2.1.8-4.7-3.2-3.1 4.5-.7Z" />
      <path d="M18.5 16.5 20.5 18.5" />
      <path d="M3.5 18.5 5.5 16.5" />
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
    case "documents":
      return DocumentIcon;
    case "review":
      return ReviewIcon;
    case "tax":
      return TaxIcon;
    case "close":
      return CloseIcon;
    case "settings":
      return SettingsIcon;
    case "advanced":
      return AdvancedIcon;
    case "home":
    default:
      return HomeIcon;
  }
}

function isPrimaryMobileNavItem(item: PrivateDashboardNavItem) {
  return ["home", "documents", "review", "tax", "settings"].includes(item.icon ?? "home");
}

function getMobileNavLabel(item: PrivateDashboardNavItem) {
  switch (item.icon) {
    case "tax":
      return "IVA";
    case "settings":
      return "Ajustes";
    default:
      return item.label;
  }
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
