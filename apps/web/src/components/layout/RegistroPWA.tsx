'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker (PWA) y garantiza que la app instalada SE
 * ACTUALIZA con cada deploy (encargo explícito de Sergio: en Nextfactu una PWA
 * se quedó congelada en una versión vieja y no queremos repetirlo).
 *
 * Por qué aquí no puede pasar, en tres capas:
 *
 * 1. La causa raíz del problema clásico es un SW que cachea el "app shell"
 *    (HTML/JS) y lo sirve para siempre. Nuestro sw.js NO cachea páginas ni
 *    assets — toda navegación va a la red — así que cada deploy llega a los
 *    usuarios en su siguiente navegación, aunque el SW fuera viejo.
 *
 * 2. `updateViaCache: 'none'`: el navegador revalida el fichero /sw.js contra
 *    el servidor en cada comprobación, saltándose la caché HTTP — la otra vía
 *    típica por la que un SW viejo sobrevive días.
 *
 * 3. Comprobación activa: además del chequeo automático del navegador (solo
 *    en navegaciones), forzamos `reg.update()` al volver la app a primer
 *    plano y cada 30 min con ella abierta. En el SW, `skipWaiting` +
 *    `clients.claim` hacen que la versión nueva tome el control al momento,
 *    sin esperar a que se cierren todas las pestañas.
 */
export function RegistroPWA() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let intervalo: ReturnType<typeof setInterval> | undefined;
    let alVolver: (() => void) | undefined;

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        const comprobar = () => reg.update().catch(() => {});
        alVolver = () => {
          if (document.visibilityState === 'visible') comprobar();
        };
        document.addEventListener('visibilitychange', alVolver);
        intervalo = setInterval(comprobar, 30 * 60 * 1000);
      })
      .catch(() => {
        // Sin SW no hay instalación ni página offline, pero la web funciona
        // igual: no es un error que merezca molestar al usuario.
      });

    return () => {
      if (intervalo) clearInterval(intervalo);
      if (alVolver) document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return null;
}
