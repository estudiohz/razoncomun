'use client';

import { useEffect, useState } from 'react';
import {
  EVENTO_CONSENTIMIENTO,
  leerConsentimiento,
} from '@/lib/legal/consentimiento-cookies';

/**
 * Inyecta el código de seguimiento que el admin haya puesto en Ajustes
 * (Analytics, píxel de Meta…), **solo si hay consentimiento**.
 *
 * POR QUÉ SE INYECTA DESDE EL CLIENTE Y NO EN EL `<head>` DEL SERVIDOR
 *   Porque el servidor no sabe qué eligió esta persona. Si el código fuera en
 *   el HTML, se ejecutaría en el primer render —antes de que nadie decida— y
 *   el aviso de cookies sería decorativo. Al montarlo aquí, el navegador solo
 *   descarga nada de Google o Meta después de un "Aceptar" explícito.
 *
 * Y AL REVÉS TAMBIÉN: si alguien rechaza, no se inyecta. Si retira el
 * consentimiento, los scripts ya cargados no se pueden "descargar" —eso no
 * existe en un navegador— pero desaparecen en la siguiente carga de página.
 * Se avisa de ello en la política de cookies en vez de fingir lo contrario.
 *
 * ⚠️ ESTE COMPONENTE EJECUTA CÓDIGO ARBITRARIO. Lo que se guarda en Ajustes
 * corre en el navegador de cada visitante con todos los permisos de la
 * página: puede leer el DOM, hacer peticiones y robar sesiones. Por eso
 * `settings` solo lo puede escribir un admin (`settings_write_admin`, 0019),
 * NO un editor, y todo cambio queda en `audit_log`. No es un descuido: es un
 * campo de confianza total, como el de cualquier CMS, y hay que tratarlo así.
 */
export function CodigoSeguimiento({
  codigoHead,
  codigoBody,
}: {
  codigoHead: string;
  codigoBody: string;
}) {
  const [permitido, setPermitido] = useState(false);

  useEffect(() => {
    setPermitido(leerConsentimiento()?.estado === 'aceptado');

    function alCambiar(e: Event) {
      const detalle = (e as CustomEvent).detail as { estado?: string } | null;
      setPermitido(detalle?.estado === 'aceptado');
    }
    window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  }, []);

  useEffect(() => {
    if (!permitido) return;
    if (!codigoHead.trim() && !codigoBody.trim()) return;

    // Marca para no duplicar: si el efecto se vuelve a ejecutar (cambio de
    // ruta, re-render), Analytics se cargaría dos veces y contaría doble.
    if (document.getElementById(MARCA)) return;

    const marca = document.createElement('meta');
    marca.id = MARCA;
    document.head.appendChild(marca);

    inyectar(codigoHead, document.head);
    inyectar(codigoBody, document.body);
  }, [permitido, codigoHead, codigoBody]);

  return null;
}

const MARCA = 'rc-seguimiento-cargado';

/**
 * Mete el HTML en el documento ejecutando sus `<script>`.
 *
 * `innerHTML` NO ejecuta los scripts que contiene (el navegador lo impide a
 * propósito), así que hay que recrear cada etiqueta a mano. Es el motivo por
 * el que esto no es un simple `dangerouslySetInnerHTML`.
 */
function inyectar(html: string, destino: HTMLElement) {
  if (!html.trim()) return;

  const plantilla = document.createElement('template');
  plantilla.innerHTML = html;

  for (const nodo of Array.from(plantilla.content.childNodes)) {
    if (nodo.nodeName === 'SCRIPT') {
      const viejo = nodo as HTMLScriptElement;
      const nuevo = document.createElement('script');
      for (const attr of Array.from(viejo.attributes)) {
        nuevo.setAttribute(attr.name, attr.value);
      }
      nuevo.text = viejo.text;
      destino.appendChild(nuevo);
    } else {
      destino.appendChild(nodo.cloneNode(true));
    }
  }
}
