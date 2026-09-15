export type PushSupport = "supported" | "ios-install" | "unsupported" | "insecure" | "local";

export function classifyPushSupport(input: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  secureContext: boolean;
  localDevelopment: boolean;
  notifications: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
}): PushSupport {
  if (input.localDevelopment) return "local";
  if (!input.secureContext) return "insecure";
  const ios = /iPhone|iPad|iPod/i.test(input.userAgent)
    || (/Macintosh/i.test(input.userAgent) && input.maxTouchPoints > 1);
  if (ios && !input.standalone) return "ios-install";
  if (!input.notifications || !input.serviceWorker || !input.pushManager) return "unsupported";
  return "supported";
}

const DEVICE_KEY = "convertilabs.push.device-id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getPushDeviceId(storage: Pick<Storage, "getItem" | "setItem">, createId: () => string) {
  const existing = storage.getItem(DEVICE_KEY);
  if (existing && UUID.test(existing)) return existing;
  const id = createId();
  if (!UUID.test(id)) throw new Error("No se pudo identificar este dispositivo.");
  storage.setItem(DEVICE_KEY, id);
  return id;
}

export function decodePushPublicKey(publicKey: string) {
  const normalized = publicKey.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

export async function pushEndpointHash(endpoint: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function matchesRegisteredPushEndpoint(
  subscription: Pick<PushSubscription, "endpoint"> | null | undefined,
  registeredHash: string | null | undefined,
) {
  return Boolean(subscription && registeredHash && await pushEndpointHash(subscription.endpoint) === registeredHash);
}

// Call only after the user chooses to activate notifications. A valid shared
// browser subscription is reused; only expired endpoints or obsolete VAPID
// bindings are replaced, since they cannot receive from the configured server.
export async function preparePushSubscription(
  manager: Pick<PushManager, "getSubscription" | "subscribe">,
  publicKey: string,
  requiresRefresh: boolean,
  registeredEndpointHash?: string | null,
) {
  const expectedKey = decodePushPublicKey(publicKey);
  let subscription = await manager.getSubscription();
  let replaced = false;
  if (subscription) {
    const boundKey = subscription.options.applicationServerKey;
    const bytes = boundKey ? new Uint8Array(boundKey) : null;
    const matchingKey = bytes?.length === expectedKey.length
      && bytes.every((value, index) => value === expectedKey[index]);
    // Another organization may already have replaced the expired endpoint.
    // Do not unsubscribe its fresh, valid binding because this org's row is old.
    const currentEndpointExpired = requiresRefresh && (!registeredEndpointHash
      || await matchesRegisteredPushEndpoint(subscription, registeredEndpointHash));
    if (currentEndpointExpired || !matchingKey) {
      await subscription.unsubscribe();
      subscription = null;
      replaced = true;
    }
  }
  subscription ??= await manager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedKey });
  return { subscription, replaced };
}
