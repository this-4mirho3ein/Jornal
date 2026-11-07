/**
 * Trading Journal service worker — deliberately minimal (decision recorded
 * here on purpose): a realtime, auth'd finance journal must never serve
 * stale trades or config from a cache, so NOTHING dynamic is cached.
 *
 * What it does do:
 *   1. installs a branded offline fallback page (/offline);
 *   2. cache-first for /_next/static/** (immutable, content-hashed assets —
 *      safe to cache forever, invalidates naturally on new deploys);
 *   3. network-first with the /offline fallback for plain navigations, so a
 *      dropped connection shows the journal-branded screen, not a browser
 *      dinosaur.
 *
 * Everything else — API routes, RSC payloads, uploads, auth, realtime —
 * passes straight through to the network. Bump VERSION when /offline or the
 * strategy changes; old caches are purged on activate.
 */
const VERSION = "tj-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.add(OFFLINE_URL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(VERSION) === false && key.startsWith("tj-"))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Brand-branded fallback when a navigation fails (offline / server dead).
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return offline ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Content-hashed, immutable build assets: cache-first, no revalidation.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return Response.error();
        }
      })(),
    );
  }
  // Everything else: let the browser/network handle it (no interception).
});
