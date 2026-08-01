/**
 * Service worker MÍNIMO a propósito (PWA, 01/08/2026).
 *
 * Su único trabajo es existir: junto con el manifest hace la web instalable
 * (icono en el móvil, pantalla completa). NO cachea páginas ni datos, y es
 * deliberado: la app es participación en vivo —votos, propuestas, cuentas— y
 * servir contenido viejo desde una caché sería peor que pedir conexión. Un
 * partido que presume de datos no puede enseñarte un recuento desactualizado.
 *
 * Lo único que guarda en caché es la página offline y el logo, para que sin
 * conexión se vea un aviso digno en vez del dinosaurio del navegador.
 *
 * Si algún día se quiere offline de verdad (p. ej. leer el programa sin
 * cobertura), se amplía con una estrategia por ruta — no con un cache-all.
 */
const CACHE = 'rc-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/logo-rc.png'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Solo navegaciones de página: los assets y las llamadas a la API pasan de
  // largo, directos a la red.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});
