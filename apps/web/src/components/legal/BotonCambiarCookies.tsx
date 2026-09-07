'use client';

import { useEffect, useState } from 'react';
import {
  EVENTO_CONSENTIMIENTO,
  leerConsentimiento,
  olvidarConsentimiento,
} from '@/lib/legal/consentimiento-cookies';

/**
 * "Cookies: aceptadas / rechazadas — cambiar". Vive en el footer, junto a las
 * páginas legales.
 *
 * POR QUÉ EXISTE: la AEPD exige que retirar el consentimiento sea **tan fácil
 * como darlo**. Sin esto, quien aceptara un día no tendría forma de volver
 * atrás salvo borrando los datos del navegador, y eso no es "igual de fácil".
 *
 * No se pinta hasta después de montar: en el servidor no se sabe qué eligió
 * esta persona, y enseñar un estado equivocado durante un instante es peor
 * que no enseñar nada.
 */
export function BotonCambiarCookies() {
  const [estado, setEstado] = useState<'aceptado' | 'rechazado' | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setEstado(leerConsentimiento()?.estado ?? null);

    function alCambiar(e: Event) {
      const detalle = (e as CustomEvent).detail as { estado?: 'aceptado' | 'rechazado' } | null;
      setEstado(detalle?.estado ?? null);
    }
    window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  }, []);

  // Sin decisión guardada el aviso ya está en pantalla: no hace falta ofrecer
  // "cambiar" algo que todavía no se ha elegido.
  if (!montado || estado === null) return null;

  return (
    <button
      type="button"
      onClick={olvidarConsentimiento}
      className="text-[12.5px] text-white/65 underline-offset-2 hover:text-white/90 hover:underline"
    >
      Cookies: {estado === 'aceptado' ? 'aceptadas' : 'rechazadas'} — cambiar
    </button>
  );
}
