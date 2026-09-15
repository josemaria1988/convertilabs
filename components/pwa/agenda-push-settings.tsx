"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { classifyPushSupport, getPushDeviceId, matchesRegisteredPushEndpoint, preparePushSubscription, pushEndpointHash, type PushSupport } from "@/modules/pwa/push-browser";

type Configuration = {
  configured: boolean;
  publicKey: string | null;
  subscribed: boolean;
  requiresRefresh?: boolean;
  subscriptionEndpointHash?: string | null;
  message?: string;
};

type DeviceState = {
  support: PushSupport;
  permission: NotificationPermission;
  deviceId: string | null;
  configuration: Configuration | null;
  browserSubscribed: boolean;
};

async function pushRequest(url: string, method = "GET", body?: object) {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    throw new Error(typeof result?.message === "string" ? result.message : "No se pudieron actualizar los avisos. Volvé a intentarlo.");
  }
  return result;
}

async function activeRegistration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("La aplicación todavía se está preparando. Volvé a intentarlo.")), 12_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "La conexión demoró demasiado. Comprobá tu conexión y volvé a intentarlo.";
  }
  return error instanceof Error ? error.message : "No se pudieron actualizar los avisos.";
}

export function AgendaPushSettings({ slug }: { slug: string }) {
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    setError(null);
    const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
    const support = classifyPushSupport({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: window.matchMedia("(display-mode: standalone)").matches
        || window.matchMedia("(display-mode: fullscreen)").matches
        || standaloneNavigator.standalone === true,
      secureContext: window.isSecureContext,
      localDevelopment: process.env.NODE_ENV === "development"
        || ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname),
      notifications: "Notification" in window,
      serviceWorker: "serviceWorker" in navigator,
      pushManager: "PushManager" in window,
    });
    const permission = "Notification" in window ? Notification.permission : "default";
    try {
      if (support !== "supported") {
        setDevice({ support, permission, deviceId: null, configuration: null, browserSubscribed: false });
        return;
      }
      let deviceId: string;
      try {
        deviceId = getPushDeviceId(localStorage, () => crypto.randomUUID());
      } catch {
        throw new Error("No se puede guardar la preferencia en este navegador. Habilitá el almacenamiento del sitio o abrí Convertilabs fuera del modo privado.");
      }
      const [configuration, registration] = await Promise.all([
        pushRequest(`/api/v1/push?${new URLSearchParams({ slug, deviceId })}`) as Promise<Configuration>,
        navigator.serviceWorker.getRegistration("/"),
      ]);
      const subscription = await registration?.pushManager.getSubscription();
      const browserSubscribed = await matchesRegisteredPushEndpoint(subscription, configuration.subscriptionEndpointHash);
      if (sequence === refreshSequence.current) {
        setDevice({ support, permission, deviceId, configuration, browserSubscribed });
      }
    } catch (reason) {
      if (sequence === refreshSequence.current) setError(errorMessage(reason));
    } finally {
      if (sequence === refreshSequence.current) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      refreshSequence.current += 1;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const enabled = device?.configuration?.subscribed && device.browserSubscribed && device.permission === "granted";
  const canEnable = device?.support === "supported" && device.configuration?.configured
    && Boolean(device.configuration.publicKey) && device.permission !== "denied" && !enabled;

  async function enable() {
    if (busyRef.current || !canEnable || !device?.deviceId || !device.configuration?.publicKey) return;
    busyRef.current = true;
    setBusy("enable");
    setMessage(null);
    setError(null);
    try {
      // Keep this request directly in the click handler, before any network or worker await.
      const permission = await Notification.requestPermission();
      setDevice((current) => current ? { ...current, permission } : current);
      if (permission !== "granted") {
        setMessage(permission === "denied"
          ? "El permiso quedó bloqueado. Podés cambiarlo en los ajustes de notificaciones de esta app o sitio."
          : "No se activaron los avisos. Podés volver a intentarlo cuando quieras.");
        return;
      }
      const registration = await activeRegistration();
      const { subscription, replaced } = await preparePushSubscription(
        registration.pushManager, device.configuration.publicKey, device.configuration.requiresRefresh === true,
        device.configuration.subscriptionEndpointHash,
      );
      const subscriptionEndpointHash = await pushEndpointHash(subscription.endpoint);
      await pushRequest("/api/v1/push", "POST", { slug, deviceId: device.deviceId, subscription: subscription.toJSON() });
      setDevice((current) => current ? { ...current, permission, browserSubscribed: true, configuration: { ...device.configuration!, subscribed: true, requiresRefresh: false, subscriptionEndpointHash } } : current);
      setMessage(replaced
        ? "Avisos reactivados en este dispositivo. Enviá una prueba. Si usás otras empresas aquí, comprobá también sus avisos."
        : "Avisos activados en este dispositivo. Enviá una prueba para comprobar cómo se muestran.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function disable() {
    if (busyRef.current || !device?.deviceId) return;
    busyRef.current = true;
    setBusy("disable");
    setError(null);
    setMessage(null);
    try {
      await pushRequest("/api/v1/push", "DELETE", { slug, deviceId: device.deviceId });
      // The browser subscription can also serve another organization on this device.
      setDevice((current) => current?.configuration ? { ...current, configuration: { ...current.configuration, subscribed: false } } : current);
      setMessage("Avisos desactivados para esta empresa en este dispositivo. El permiso del navegador se conserva.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function sendTest() {
    if (busyRef.current || !enabled || !device?.deviceId) return;
    busyRef.current = true;
    setBusy("test");
    setError(null);
    setMessage(null);
    try {
      const result = await pushRequest("/api/v1/push/test", "POST", { slug, deviceId: device.deviceId });
      setMessage(result.status === "already_attempted"
        ? "Ya se solicitó una prueba recientemente. Revisá las notificaciones del dispositivo."
        : "Prueba enviada al servicio de notificaciones. Comprobá si apareció en este dispositivo; el envío no confirma su recepción.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  let status = "Avisos desactivados en este dispositivo";
  let description = "Activá los avisos de vencimiento de esta empresa en este dispositivo. Podés desactivarlos acá cuando quieras.";
  if (loading && !device) status = "Comprobando notificaciones…";
  else if (!device) {
    status = "Estado de notificaciones sin comprobar";
    description = "Comprobá la conexión y volvé a consultar el estado antes de activar los avisos.";
  }
  else if (device?.support === "ios-install") {
    status = "Abrí Convertilabs desde la pantalla de inicio";
    description = "En iPhone o iPad, agregá Convertilabs a la pantalla de inicio desde Compartir. Después abrilo desde ese ícono y volvé a Agenda para activar los avisos. Requiere iOS o iPadOS 16.4 o posterior.";
  } else if (device?.support === "local") {
    status = "Notificaciones no disponibles en la vista local";
    description = "Para activar los avisos, abrí Convertilabs en su dirección publicada desde el dispositivo que los recibirá.";
  } else if (device?.support === "insecure" || device?.support === "unsupported") {
    status = "Notificaciones no compatibles en este navegador";
    description = "Abrí la dirección segura de Convertilabs en un navegador actualizado. Los vencimientos siguen disponibles en la agenda.";
  } else if (device?.permission === "denied") {
    status = "Permiso de notificaciones bloqueado";
    description = "Permití las notificaciones de esta app o sitio en los ajustes del dispositivo o navegador. Después volvé acá y comprobá el estado.";
  } else if (device?.configuration && !device.configuration.configured) {
    status = "El servicio de avisos todavía no está disponible";
    description = "La agenda sigue disponible. Podrás activar las notificaciones cuando termine la configuración del servicio.";
  } else if (enabled) {
    status = "Avisos activados en este dispositivo";
    description = "Recibirás los avisos de agenda configurados para esta empresa. La prueba permite comprobar el permiso y las preferencias de tu dispositivo.";
  } else if (device?.permission === "granted") {
    status = "Permiso concedido; falta activar los avisos";
  }

  return (
    <section className="ui-panel min-w-0" aria-labelledby="agenda-push-title">
      <h2 id="agenda-push-title" className="text-[16px] font-semibold text-white">Notificaciones en este dispositivo</h2>
      <p className="mt-2 text-sm font-semibold text-white" aria-live="polite">{status}</p>
      <p className="mt-1 max-w-3xl text-sm text-[color:var(--color-muted)]">{description}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canEnable ? <button type="button" disabled={Boolean(busy) || loading} onClick={() => { void enable(); }} className="ui-button ui-button--primary min-h-[44px] w-full whitespace-normal px-4 sm:w-auto">{busy === "enable" ? "Activando…" : "Activar avisos aquí"}</button> : null}
        {enabled ? <button type="button" disabled={Boolean(busy) || loading} onClick={() => { void sendTest(); }} className="ui-button ui-button--secondary min-h-[44px] w-full whitespace-normal px-4 sm:w-auto">{busy === "test" ? "Enviando…" : "Enviar prueba"}</button> : null}
        {device?.configuration?.subscribed ? <button type="button" disabled={Boolean(busy)} onClick={() => { void disable(); }} className="ui-button ui-button--ghost min-h-[44px] w-full whitespace-normal px-4 sm:w-auto">{busy === "disable" ? "Desactivando…" : "Desactivar en este dispositivo"}</button> : null}
        {error || device?.permission === "denied" ? <button type="button" disabled={Boolean(busy) || loading} onClick={() => { void refresh(); }} className="ui-button ui-button--secondary min-h-[44px] w-full whitespace-normal px-4 sm:w-auto">{loading ? "Comprobando…" : "Comprobar estado"}</button> : null}
      </div>
      {message ? <p role="status" className="mt-3 text-sm text-[color:var(--color-muted)]">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
