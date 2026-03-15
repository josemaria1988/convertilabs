import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function RootLoading() {
  return (
    <div className="auth-stage">
      <div className="auth-grid">
        <section className="panel auth-card px-6 py-8 md:px-8 md:py-10">
          <PageLoadingState
            title="Abriendo Convertilabs"
            message="Estamos preparando la sesion y cargando la siguiente pantalla."
          />
        </section>
      </div>
    </div>
  );
}
