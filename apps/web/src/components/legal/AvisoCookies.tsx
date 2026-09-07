'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EVENTO_CONSENTIMIENTO,
  guardarConsentimiento,
  leerConsentimiento,
} from '@/lib/legal/consentimiento-cookies';

/**
 * Aviso de cookies (07/09/2026).
 *
 * Dos decisiones de diseño que NO son estéticas, son la guía de la AEPD:
 *
 *   1. **"Rechazar" tiene el mismo peso visual que "Aceptar".** Dos botones
 *      del mismo tamaño, uno al lado del otro. Poner el rechazo como un
 *      enlace gris pequeño es el patrón que la AEPD sanciona expresamente.
 *   2. **No hay aspa de cerrar.** Cerrar el aviso no es consentir, y dejar un
 *      atajo que parece "quitarlo de en medio" sin decidir crea justo la
 *      ambigüedad que la norma prohíbe. Para irse hay que elegir.
 *
 * No aparece hasta después de montar: en el servidor no se sabe qué eligió
 * esta persona, y pintarlo siempre para esconderlo luego daría un parpadeo a
 * todo el mundo, también a quien ya decidió hace meses.
 */
export function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!leerConsentimiento()) setVisible(true);

    // Si alguien retira el consentimiento desde la política de cookies, el
    // aviso tiene que volver a salir sin recargar.
    function alCambiar(e: Event) {
      const detalle = (e as CustomEvent).detail;
      setVisible(detalle === null);
    }
    window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  }, []);

  if (!visible) return null;

  function decidir(estado: 'aceptado' | 'rechazado') {
    guardarConsentimiento(estado);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-linea bg-white p-4 shadow-[0_-8px_24px_rgba(16,28,52,.10)] min-[720px]:p-5"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 min-[860px]:flex-row min-[860px]:items-center">
        <p className="flex-1 text-[13.5px] leading-relaxed text-cuerpo">
          Usamos cookies propias necesarias para que la web funcione, y{' '}
          <strong className="text-titular">cookies de terceros de analítica y publicidad</strong>{' '}
          (Google y Meta) que solo se activan si las aceptas. Si las rechazas, la web funciona
          igual.{' '}
          <Link href="/cookies" className="font-semibold text-titular underline">
            Más detalle
          </Link>
          .
        </p>

        {/* Los dos botones, mismo tamaño y misma jerarquía. */}
        <div className="flex flex-none gap-3">
          <button
            type="button"
            onClick={() => decidir('rechazado')}
            className="flex-1 rounded-boton border border-linea bg-white px-5 py-3 text-[14px] font-bold text-titular hover:border-titular min-[860px]:flex-none"
          >
            Rechazar
          </button>
          <button
            type="button"
            onClick={() => decidir('aceptado')}
            className="flex-1 rounded-boton border border-titular bg-titular px-5 py-3 text-[14px] font-bold text-white min-[860px]:flex-none"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
