'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * ¿Estamos en "modo app"? (decisión de Sergio, 02/08/2026)
 *
 * Verdadero si la web corre INSTALADA como PWA (display-mode standalone — sí,
 * es detectable) o si hay sesión iniciada. Dos superficies dependen de esto en
 * espejo, y esa simetría es la que evita que se pisen en móvil:
 *
 *  - MenuInferior: solo en modo app. Un visitante anónimo en el navegador ve
 *    la web corporativa sin barra de app.
 *  - ChatWidgetFlotante: solo FUERA del modo app. Es la herramienta de captar
 *    al visitante; el logueado tiene "Pregunta a la IA" en el menú. Y como
 *    nunca coinciden, el widget ya no tapa el elemento derecho del menú.
 *
 * Devuelve null mientras decide (primer render), para que cada superficie no
 * parpadee apareciendo y desapareciendo.
 */
export function useEsApp(): boolean | null {
  const [esApp, setEsApp] = useState<boolean | null>(null);

  useEffect(() => {
    const instalada =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari expone su propia bandera fuera del estándar.
      (navigator as { standalone?: boolean }).standalone === true;

    if (instalada) {
      setEsApp(true);
      return;
    }

    // getSession lee la cookie local (sin red): barato para esta decisión de
    // chrome. La autoridad de verdad sigue siendo el servidor en cada página.
    createClient()
      .auth.getSession()
      .then(({ data }) => setEsApp(Boolean(data.session)))
      .catch(() => setEsApp(false));
  }, []);

  return esApp;
}
