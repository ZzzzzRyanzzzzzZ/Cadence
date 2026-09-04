const CACHE = "cadence-v1";
const ASSETS = [
  "./",
  "index.html",
  "css/tokens.css",
  "css/base.css",
  "css/components.css",
  "css/screens.css",
  "manifest.webmanifest",
  "icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res && res.ok && url.origin === location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(event.request).then((hit) => hit || caches.match("index.html")))
  );
});
