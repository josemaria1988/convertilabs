import type { ReactNode } from "react";
import { ConvertilabsLogo } from "@/components/convertilabs-logo";
import { MobileNavigation } from "@/components/dashboard/mobile-navigation";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { DocumentSpreadsheetImportNotifier } from "@/components/documents/document-spreadsheet-import-notifier";
import { LoadingLink } from "@/components/ui/loading-link";

export type PrivateDashboardNavItem = {
  href: string;
  label: string;
  description: string;
  icon?: "home" | "work" | "tray" | "money" | "agenda" | "more" | "accounting" | "tax" | "audit" | "settings";
  current?: boolean;
  mobilePrimary?: boolean;
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
      <path d="M4.5 11.5 12 5l7.5 6.5" />
      <path d="M6.5 10.5v8h11v-8" />
      <path d="M10 18.5v-5h4v5" />
    </svg>
  );
}

function WorkIcon({ className }: IconProps) {
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
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M4.5 8h15v10.5h-15z" />
      <path d="M4.5 12.5h15" />
      <path d="M10 12.5v1.8h4v-1.8" />
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

function MoneyIcon({ className }: IconProps) {
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
      <path d="M5 7h14v10H5z" />
      <path d="M8 12h.01" />
      <path d="M16 12h.01" />
      <path d="M12 9.5a2.5 2.5 0 1 1 0 5" />
    </svg>
  );
}

function AgendaIcon({ className }: IconProps) {
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
      <path d="M6 5.5h12v14H6z" />
      <path d="M8.5 4v3" />
      <path d="M15.5 4v3" />
      <path d="M6 9h12" />
      <path d="M9 13h1.5" />
      <path d="M9 16h4.5" />
    </svg>
  );
}

function MoreIcon({ className }: IconProps) {
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
      <path d="M5 7.5h14" />
      <path d="M5 12h14" />
      <path d="M5 16.5h14" />
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

function getNavIcon(iconKey?: PrivateDashboardNavItem["icon"]) {
  switch (iconKey) {
    case "home":
      return HomeIcon;
    case "work":
      return WorkIcon;
    case "accounting":
      return AccountingIcon;
    case "money":
      return MoneyIcon;
    case "agenda":
      return AgendaIcon;
    case "more":
      return MoreIcon;
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

function NavigationLinks({ navItems }: { navItems: PrivateDashboardNavItem[] }) {
  return (
    <nav className="app-sidebar-nav" aria-label="Navegación principal">
      {navItems.map((item) => {
        const Icon = getNavIcon(item.icon);
        return (
          <LoadingLink key={item.href} href={item.href} pendingLabel="Abriendo..." className="app-nav-item"
            data-current={item.current ? "true" : undefined} aria-current={item.current ? "page" : undefined}>
            <span className="app-nav-item__content"><Icon className="h-[18px] w-[18px] shrink-0" /><span>{item.icon === "more" ? "Más" : item.label}</span></span>
          </LoadingLink>
        );
      })}
    </nav>
  );
}

function SidebarContent({ organizationName, organizationSlug, navItems }: Pick<PrivateDashboardShellProps, "organizationName" | "organizationSlug" | "navItems">) {
  return (
    <div className="app-sidebar-panel">
      <div className="app-sidebar-brand">
        <LoadingLink href="/app" pendingLabel="Abriendo..." className="block"><ConvertilabsLogo /></LoadingLink>
        <p className="app-sidebar-organization">{organizationName}</p>
      </div>
      <NavigationLinks navItems={navItems} />
      <div className="app-sidebar-footer">
        <LoadingLink href={"/app/o/" + organizationSlug + "/settings"} pendingLabel="Abriendo..." className="app-sidebar-footer-link">
          <span className="app-nav-item__content"><SettingsIcon className="h-[18px] w-[18px]" /><span>Ajustes</span></span>
        </LoadingLink>
        <form action="/logout" method="post">
          <button type="submit" className="app-sidebar-footer-link"><ExitIcon className="h-[18px] w-[18px]" /><span>Cerrar sesión</span></button>
        </form>
      </div>
    </div>
  );
}

export function PrivateDashboardShell({ organizationName, organizationSlug, userEmail, title, description, navItems, toolbarLabel, children }: PrivateDashboardShellProps) {
  const sectionLabel = toolbarLabel ?? title;
  const currentItem = navItems.find((item) => item.current) ?? null;
  const CurrentIcon = getNavIcon(currentItem?.icon);
  const sidebar = <SidebarContent organizationName={organizationName} organizationSlug={organizationSlug} navItems={navItems} />;
  return (
    <div className="private-app app-shell">
      <a className="app-skip-link" href="#workspace-content">Ir al contenido</a>
      <DocumentSpreadsheetImportNotifier slug={organizationSlug} />
      <aside className="app-sidebar" aria-label="Menú de la organización">{sidebar}</aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar__section">
            <MobileNavigation>{sidebar}</MobileNavigation>
            <CurrentIcon className="app-topbar__section-icon h-[18px] w-[18px]" />
            <span className="truncate">{sectionLabel}</span>
          </div>
          <div className="app-topbar__actions">
            <span className="app-topbar__organization">{organizationName}</span>
            <AccountMenu organizationName={organizationName} organizationSlug={organizationSlug} userEmail={userEmail} />
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1} className="app-content" aria-label={title}>
          <p className="sr-only">{description}</p>
          {children}
        </main>
      </div>
    </div>
  );
}
