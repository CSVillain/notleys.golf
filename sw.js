// Service Worker for caching static assets
const CACHE_NAME = "notleys-v7";
const STATIC_CACHE_URLS = [
  "/",
  "/index.html",
  "/course.html",
  "/facilities.html",
  "/assets/styles.css",
  "/assets/main.js",
  "/data/club-status.json",
  "/data/news.json",
  "/assets/images/avatar.svg",
  "/assets/images/badge-full.svg",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

const shouldUseNetworkFirst = (request) => {
  return (
    request.mode === "navigate" ||
    request.destination === "document" ||
    request.destination === "style" ||
    request.destination === "script"
  );
};

// Fetch event - keep app shell fresh, fall back to cache when offline
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;

  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const cacheResponse = (networkResponse) => {
    if (!networkResponse.ok) {
      return networkResponse;
    }

    const responseClone = networkResponse.clone();
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(event.request, responseClone);
    });

    return networkResponse;
  };

  if (shouldUseNetworkFirst(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(cacheResponse)
        .catch(() =>
          caches.match(event.request).then((response) => {
            if (response) {
              return response;
            }

            if (event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("/index.html");
            }
          }),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then(cacheResponse);
    }),
  );
});
