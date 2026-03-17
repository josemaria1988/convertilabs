import { PageLoadingState } from "@/components/ui/page-loading-state";

export default function ChartMapLoading() {
  return (
    <PageLoadingState
      title="Cargando mapa contable"
      message="Estamos reuniendo el plan, las reglas activas y el contexto documental para armar la vista coordinada."
    />
  );
}
