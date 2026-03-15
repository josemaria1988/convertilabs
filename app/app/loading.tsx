import { PageLoadingState } from "@/components/ui/page-loading-state";

const sidebarRows = Array.from({ length: 7 }, (_, index) => `sidebar-${index}`);

export default function PrivateAppLoading() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-panel">
          <div className="app-sidebar-brand">
            <div className="h-9 w-28 animate-pulse rounded-[6px] bg-white/10" />
          </div>
          <div className="app-sidebar-nav">
            {sidebarRows.map((row) => (
              <div
                key={row}
                className="h-[38px] animate-pulse rounded-[5px] border border-white/6 bg-white/6"
              />
            ))}
          </div>
          <div className="app-sidebar-footer">
            <div className="h-4 w-24 animate-pulse rounded bg-white/8" />
            <div className="h-4 w-28 animate-pulse rounded bg-white/8" />
            <div className="h-4 w-32 animate-pulse rounded bg-white/8" />
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-topbar">
          <div className="h-4 w-36 animate-pulse rounded bg-white/8" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-24 animate-pulse rounded-[4px] bg-white/8" />
            <div className="h-7 w-7 animate-pulse rounded-full bg-white/8" />
            <div className="h-7 w-28 animate-pulse rounded-full bg-white/8" />
          </div>
        </div>

        <div className="app-content">
          <PageLoadingState
            compact
            title="Cargando modulo"
            message="Estamos trayendo datos, estados y acciones del workspace."
          />
        </div>
      </main>
    </div>
  );
}
