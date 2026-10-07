/* Reinos del Caos — permite instalar el juego y jugar sin internet.
   Guarda los archivos del juego la primera vez; cambia VERSION al publicar
   una versión nueva para que los teléfonos descarguen la actualización. */
const VERSION = 'rdc-v7';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/data.js', './js/audio.js', './js/state.js', './js/sprites.js', './js/battle.js', './js/ui.js', './js/main.js',
  './assets/sprites.webp', './assets/icon-192.png', './assets/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para recibir actualizaciones); sin conexión, lo guardado
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
