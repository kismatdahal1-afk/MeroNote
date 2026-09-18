/* Mero Note Service Worker (Phase 9) — vanilla, no build step.
 *
 * Caches (versioned; old versions purged on activate):
 *   meronote-static-v1 — same-origin static assets (cache-first)
 *   meronote-api-v1     — public academic GETs (network-first, cache fallback)
 *
 * Policy mirrors client/src/lib/cachePolicy.ts (version strings, allowlist
 * prefixes, /file denylist, GET+200+basic-only). `verify:cache` asserts the
 * mirror values stay in sync — edit both together.
 *
 * NEVER cached: non-GET, /api/auth/*, /api/me/*, /api/admin/*, */file,
 * non-200 responses, opaque/cross-origin responses, credentials of any kind.
 * NEVER touched: IndexedDB (permanent downloads live there, unreachable
 * from cache cleanup by design).
 */

const STATIC_CACHE = "meronote-static-v1";
const API_CACHE = "meronote-api-v1";

const API_ALLOWLIST_PREFIXES = [
  "/api/semesters",
  "/api/subjects",
  "/api/topics",
  "/api/resources",
  "/api/books",
  "/api/notices",
];

const API_DENYLIST_SUFFIXES = ["/file"];

function isCacheableApi(url, method) {
  if (method !== "GET") return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.origin !== self.location.origin) return false;
  const path = parsed.pathname;
  if (!path.startsWith("/api/")) return false;
  for (const suffix of API_DENYLIST_SUFFIXES) {
    if (path === suffix || path.endsWith(suffix)) return false;
  }
  return API_ALLOWLIST_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

function isCacheableStatic(request, url) {
  if (request.method !== "GET") return false;
  try {
    if (new URL(url).origin !== self.location.origin) return false;
  } catch {
    return false;
  }
  return (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  );
}

async function networkFirstApi(event) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(event.request);
    // Store only successful same-origin responses; never errors or auth-gated
    // payloads that slipped the allowlist.
    if (response && response.status === 200 && response.type === "basic") {
      await cache.put(event.request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirstStatic(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response && response.status === 200 && response.type === "basic") {
    await cache.put(event.request, response.clone());
  }
  return response;
}

async function navigationFallback(event) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(event.request);
    // Cache the shell on every successful online navigation so the next
    // offline visit can boot. Failures are never stored.
    if (response && response.status === 200 && response.type === "basic") {
      await cache.put("/index.html", response.clone());
    }
    return response;
  } catch {
    const shell = await cache.match("/index.html");
    if (shell) return shell;
    throw new Error("Offline and no cached app shell is available.");
  }
}

self.addEventListener("install", (event) => {
  // Activate immediately; old caches are purged in activate below.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("meronote-") && !keep.has(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(navigationFallback(event));
    return;
  }
  if (isCacheableApi(request.url, request.method)) {
    event.respondWith(networkFirstApi(event));
    return;
  }
  if (isCacheableStatic(request, request.url)) {
    event.respondWith(cacheFirstStatic(event));
    return;
  }
  // Everything else (auth, personal, /file, cross-origin PDFs): network only.
});
