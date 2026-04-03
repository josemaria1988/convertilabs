"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type PwaInstallPromptProps = {
  className?: string;
};

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneNavigator = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || standaloneNavigator.standalone === true
  );
}

function isIosSafari() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !/crios|fxios/.test(userAgent);
}

export function PwaInstallPrompt({ className }: PwaInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [wasDismissed, setWasDismissed] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) {
      return;
    }

    setShowIosHint(isIosSafari());

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setShowIosHint(false);
      setWasDismissed(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptLabel = useMemo(() => {
    if (deferredPrompt) {
      return "Instala la app de campo para abrir carga y actividad con acceso rapido desde Android.";
    }

    if (showIosHint) {
      return "En iPhone o iPad puedes usar Compartir > Agregar a inicio para fijar esta app.";
    }

    return "";
  }, [deferredPrompt, showIosHint]);

  if ((!deferredPrompt && !showIosHint) || wasDismissed || !promptLabel) {
    return null;
  }

  return (
    <div className={className ?? "field-install-prompt"}>
      <div className="field-install-prompt__content">
        <p className="field-install-prompt__title">Instalar Convertilabs Campo</p>
        <p className="field-install-prompt__description">{promptLabel}</p>
      </div>
      <div className="field-install-prompt__actions">
        {deferredPrompt ? (
          <button
            type="button"
            className="ui-button ui-button--primary min-h-[40px] px-4"
            disabled={isInstalling}
            onClick={async () => {
              setIsInstalling(true);

              try {
                await deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;

                if (result.outcome === "dismissed") {
                  setWasDismissed(true);
                }
              } finally {
                setDeferredPrompt(null);
                setIsInstalling(false);
              }
            }}
          >
            {isInstalling ? "Instalando..." : "Instalar"}
          </button>
        ) : null}
        <button
          type="button"
          className="ui-button ui-button--ghost min-h-[40px] px-4"
          onClick={() => {
            setWasDismissed(true);
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
