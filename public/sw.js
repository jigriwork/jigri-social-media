// ============================================================
// Jigri Service Worker — Network-First for app shell, Cache for assets
// Bump CACHE_VERSION on every deploy to bust stale caches.
// ============================================================
const CACHE_VERSION = "jigri-v3-" + "20260413";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

// Only truly static assets that rarely change
const STATIC_ASSETS = [
    "/assets/images/App%20icon%20share.png",
    "/assets/images/App%20Icon.svg",
    "/assets/images/logo.svg",
    "/assets/images/side-img.svg",
];

// ---- INSTALL: pre-cache static assets, skip waiting immediately ----
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .catch(() => undefined)
    );
    // Force this new SW to activate immediately — don't wait for tabs to close
    self.skipWaiting();
});

// ---- ACTIVATE: delete ALL old caches, claim all clients ----
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
                    .map((key) => caches.delete(key))
            )
        )
    );
    // Take control of all open tabs immediately
    self.clients.claim();
});

// ---- FETCH: Network-first for navigations & app code, cache-first for static assets ----
self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    // Navigation requests (HTML pages) — ALWAYS go to network first
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the fresh response for offline fallback
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
                    return response;
                })
                .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
        );
        return;
    }

    // JS/CSS chunks (Next.js _next/static) — network-first to always get latest
    if (url.pathname.startsWith("/_next/")) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Static assets (images, fonts) — cache-first (they don't change often)
    if (STATIC_ASSETS.some((a) => url.pathname === a || url.pathname === decodeURIComponent(a))) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
                    return response;
                });
            })
        );
        return;
    }

    // Everything else — network-first
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Only cache successful same-origin responses
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// ---- MESSAGE: Allow the app to force-refresh all clients ----
self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
    if (event.data === "FORCE_REFRESH") {
        self.clients.matchAll({ type: "window" }).then((clients) => {
            clients.forEach((client) => client.navigate(client.url));
        });
    }
    if (event.data === "CLEAR_CACHES") {
        caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }
});