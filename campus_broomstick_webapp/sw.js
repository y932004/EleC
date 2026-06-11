const CACHE = "campus-broomstick-chase-v9";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./game.js",
  "./manifest.webmanifest",
  "./icons/icon-192.webp",
  "./icons/icon-512.webp",
  "./assets/scene-01-gate.webp",
  "./assets/scene-02-rainbow-sinks.webp",
  "./assets/scene-03-white-slides.webp",
  "./assets/scene-04-football-field.webp",
  "./assets/scene-05-basketball.webp",
  "./assets/scene-06-playground.webp",
  "./assets/scene-07-classroom.webp"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // cache successful GET responses
        try {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        } catch (e) { /* ignore caching failures */ }
        return response;
      }).catch(() => {
        // Only navigation requests should fallback to the app shell HTML
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // For other resource types (images/CSS/JS), do not return HTML — return network error
        return Response.error();
      });
    })
  );
});
