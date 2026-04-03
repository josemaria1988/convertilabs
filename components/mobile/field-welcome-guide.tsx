"use client";

import { useEffect, useState } from "react";

type FieldWelcomeGuideProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
};

const fieldGuideSteps = [
  {
    title: "Para que sirve la app de campo",
    body:
      "Esta superficie te ayuda a capturar comprobantes, seguir su estado y dejar el documento entrando al workflow principal sin abrir toda la vista experta.",
  },
  {
    title: "Como subir un documento",
    body:
      "Usa Subir documento para sacar una foto o cargar un PDF o imagen. La carga reutiliza el mismo intake privado y la misma extraccion que la web.",
  },
  {
    title: "Como seguir el estado",
    body:
      "Actividad reciente muestra si un documento esta procesando, listo para revisar o bloqueado. Cuando haga falta una decision humana, se abre el carril de Revision.",
  },
  {
    title: "Como asociarlo a un proyecto",
    body:
      "Puedes crear proyectos o centros de costo minimos y asociar cada documento para agrupar actividad de campo por obra, cliente o servicio.",
  },
  {
    title: "Cuando ir a la web completa",
    body:
      "IVA, cierre, auditoria, imports, exports, reglas, mapa contable, journal, balance y otros flujos expertos siguen viviendo en la web desktop.",
  },
];

export function FieldWelcomeGuide({
  open,
  onClose,
  onComplete,
}: FieldWelcomeGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const step = fieldGuideSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === fieldGuideSteps.length - 1;

  return (
    <div className="field-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="field-guide-title">
      <div className="field-guide-dialog">
        <div className="field-guide-dialog__header">
          <div>
            <p className="field-guide-dialog__eyebrow">Guia mobile</p>
            <h2 id="field-guide-title" className="field-guide-dialog__title">{step.title}</h2>
          </div>
          <button
            type="button"
            className="ui-button ui-button--ghost min-h-[38px] px-3"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="field-guide-dialog__progress">
          <div
            className="field-guide-dialog__progress-bar"
            style={{
              width: `${((stepIndex + 1) / fieldGuideSteps.length) * 100}%`,
            }}
          />
        </div>

        <p className="field-guide-dialog__body">{step.body}</p>

        <div className="field-guide-dialog__footer">
          <p className="text-sm text-[color:var(--color-muted)]">
            Paso {stepIndex + 1} de {fieldGuideSteps.length}
          </p>
          <div className="flex flex-wrap gap-3">
            {!isFirstStep ? (
              <button
                type="button"
                className="ui-button ui-button--secondary min-h-[42px] px-4"
                onClick={() => {
                  setStepIndex((current) => Math.max(0, current - 1));
                }}
              >
                Anterior
              </button>
            ) : null}
            <button
              type="button"
              className="ui-button ui-button--primary min-h-[42px] px-4"
              onClick={() => {
                if (isLastStep) {
                  onComplete();
                  return;
                }

                setStepIndex((current) => Math.min(fieldGuideSteps.length - 1, current + 1));
              }}
            >
              {isLastStep ? "Empezar" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
