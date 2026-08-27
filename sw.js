// ST Logística — Service Worker
// Cache de shell da aplicação para funcionamento offline básico (PWA installable)

const CACHE_VERSION = "st-logistica-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: network-first para navegação/HTML (dados sempre atualizados),
// cache-first para assets estáticos. Nunca intercepta chamadas ao Firebase.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin.includes("firestore") || url.origin.includes("firebase") || url.origin.includes("googleapis")) {
    return; // deixa passar direto para a rede
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    })
  );
});
