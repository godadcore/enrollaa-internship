// Enrollaa Internship PWA Service Worker
const CACHE_NAME = "enrollaa-intern-v2";
const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API requests, sensitive endpoints, or non-GET requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/manager") ||
    url.pathname.includes("register")
  ) {
    return;
  }

  // Do not cache the Next application shell. Serving an older HTML shell with
  // newer client chunks can prevent React from hydrating and make controls
  // appear visible but unclickable.
  if (url.pathname === "/" || url.pathname.startsWith("/_next/")) {
    return;
  }

  // Network-first strategy for static assets, with offline fallback.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
