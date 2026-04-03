"use client";

import { useEffect } from "react";

const serviceWorkerPath = "/sw.js";

function canRegisterServiceWorker() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator
    && (window.isSecureContext || window.location.hostname === "localhost")
  );
}

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) {
      return;
    }

    let cancelled = false;

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register(serviceWorkerPath, {
          scope: "/",
        });

        if (cancelled) {
          return;
        }

        if (registration.waiting) {
          registration.waiting.postMessage({
            type: "SKIP_WAITING",
          });
        }
      } catch (error) {
        console.error("No pudimos registrar el service worker de Convertilabs.", error);
      }
    }

    void registerServiceWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
