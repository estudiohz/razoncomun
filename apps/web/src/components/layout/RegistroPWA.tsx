'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker (PWA). Componente aparte y client-only porque
 * `navigator.serviceWorker` no existe en SSR; no pinta nada.
 *
 * El registro es idempotente: llamarlo en cada carga es el patrón normal, el
 * navegador solo reinstala si el fichero /sw.js cambió de bytes.
 */
export function RegistroPWA() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Sin SW no hay instalación ni página offline, pero la web funciona
        // igual: no es un error que merezca molestar al usuario.
      });
    }
  }, []);

  return null;
}
