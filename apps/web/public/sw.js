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
 * ─────────────────────────────────────────────────────────────────────────
 * ⚡ NAVIGATION PRELOAD (02/08/2026) — el arreglo de "la app instalada va
 * lenta o no responde a la primera" (reporte de Sergio).
 *
 * Causa: en cuanto un SW registra un handler de `fetch` con
 * `event.respondWith()`, TODA navegación pasa por él. Si el worker estaba
 * dormido (lo normal tras unos segundos de inactividad, y más aún en una app
 * instalada que se abre y cierra), el navegador debe ARRANCARLO primero y
 * solo entonces se lanza la petición de red: 100-500 ms de retraso en el
 * primer toque, justo la sensación de "no responde a la primera".
 *
 * `navigationPreload` lo elimina: el navegador dispara la petición de red EN
 * PARALELO al arranque del worker, y aquí se consume esa respuesta ya en
 * curso (`event.preloadResponse`) en vez de empezar un fetch nuevo.
 * ─────────────────────────────────────────────────────────────────────────
 */
// Subir la versión invalida la caché anterior en el 'activate' de más abajo.
const CACHE = 'rc-offline-v3';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/logo-rc.png'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Arranca la red en paralelo al worker en cada navegación.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Web Push (0046, 07/08/2026). El payload lo construye enviarPush() en el
 * servidor como JSON {title, body, url} — ver apps/web/src/lib/push/send.ts.
 */
self.addEventListener('push', (event) => {
  let datos = { title: 'Razón Común', body: '', url: '/' };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    // payload no-JSON (no debería pasar, enviarPush siempre manda JSON): usa los defaults.
  }

  event.waitUntil(
    self.registration.showNotification(datos.title, {
      body: datos.body,
      icon: '/logo-rc.png',
      badge: '/logo-rc.png',
      data: { url: datos.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existente = clientsList.find((c) => new URL(c.url).pathname === url);
      if (existente) {
        existente.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  // Solo navegaciones de página: los assets y las llamadas a la API pasan de
  // largo, directos a la red (sin respondWith no hay intermediación alguna).
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    (async () => {
      try {
        // La respuesta que el navegador ya empezó a pedir mientras arrancaba
        // este worker. Si no hay preload (navegador sin soporte), fetch normal.
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(event.request);
      } catch {
        return (await caches.match(OFFLINE_URL)) ?? Response.error();
      }
    })(),
  );
});
