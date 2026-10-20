/* Service worker: permite instalar la encuesta y abrirla aunque falle la conexión.
   Suba el número de VERSION cada vez que publique cambios. */
var VERSION = "encuesta-adep-v2";
var ARCHIVOS = [
  "./",
  "index.html",
  "css/styles.css",
  "js/config.js",
  "js/app.js",
  "manifest.webmanifest",
  "assets/logo-adep.png",
  "assets/foto-adep.jpg",
  "assets/foto-adep-difuminada.jpg",
  "assets/favicon.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (claves) {
    return Promise.all(claves.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Primero la red (para ver siempre lo último); si no hay conexión, la copia guardada.
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copia = r.clone();
      caches.open(VERSION).then(function (c) { c.put(e.request, copia); });
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
