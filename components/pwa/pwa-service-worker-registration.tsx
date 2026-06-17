"use client";

import { useEffect } from "react";

const serviceWorkerPath = "/sw.js";

function isLocalDevelopmentHost() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    process.env.NODE_ENV === "development"
    || window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || window.location.hostname === "0.0.0.0"
  );
}

function canRegisterServiceWorker() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "serviceWorker" in navigator
    && !isLocalDevelopmentHost()
    && (window.isSecureContext || window.location.hostname === "localhost")
  );
}

async function unregisterLocalServiceWorkers() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith("convertilabs-"))
        .map((cacheName) => caches.delete(cacheName)),
    );
  }
}

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    if (isLocalDevelopmentHost()) {
      void unregisterLocalServiceWorkers().catch(() => undefined);
      return;
    }

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
