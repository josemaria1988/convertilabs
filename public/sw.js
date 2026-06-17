const CACHE_NAME = "convertilabs-static-v2";
const OFFLINE_URL = "/offline";
const STATIC_CACHE_PATHS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/maskable-icon-512.png",
  "/pwa/apple-touch-icon.png",
  "/assistant/accounting-assistant.svg",
];

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isCacheableStaticPath(pathname) {
  return (
    pathname === OFFLINE_URL
    || pathname === "/manifest.webmanifest"
    || pathname.startsWith("/pwa/")
    || pathname === "/assistant/accounting-assistant.svg"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_CACHE_PATHS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => {
      if (cacheName !== CACHE_NAME) {
        return caches.delete(cacheName);
      }

      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (!isSameOrigin(requestUrl)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  if (
    requestUrl.pathname.startsWith("/api/")
    || requestUrl.pathname.startsWith("/app/")
    || requestUrl.pathname.startsWith("/login")
    || requestUrl.pathname.startsWith("/signup")
    || requestUrl.pathname.startsWith("/logout")
    || requestUrl.pathname.startsWith("/auth/")
    || requestUrl.pathname.startsWith("/onboarding")
  ) {
    return;
  }

  if (!isCacheableStaticPath(requestUrl.pathname)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      void fetch(request).then((response) => {
        if (response.ok) {
          void cache.put(request, response.clone());
        }
      }).catch(() => undefined);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  })());
});
