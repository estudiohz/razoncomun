'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Prefijo de la clave de localStorage; se ata al userId para que un cierre
 * no oculte el aviso a otra cuenta que use el mismo navegador, y para que
 * cuentas nuevas sin contraseña vuelvan a verlo aunque el aviso de una
 * cuenta anterior ya se hubiera cerrado en ese mismo dispositivo. */
const CLAVE_PREFIJO = 'rc_aviso_contrasena_cerrado_';

/**
 * Banner discreto global: "aún no tienes contraseña, créate una". Solo se
 * monta desde Nav.tsx (server) cuando `has_password()` (migración 0025,
 * rc-02) dio false para el usuario de la petición — nunca para anónimos ni
 * para quien ya tiene contraseña, así que esa parte no puede parpadear (la
 * decisión de renderizar o no el árbol entero ya la tomó el servidor).
 *
 * Lo único que ocurre en cliente es si el USUARIO YA CERRÓ este aviso antes
 * en este navegador (localStorage) — en ese caso, dado que el servidor no
 * sabe nada de localStorage, el primer render (SSR + hydration) sí pinta el
 * banner y useEffect lo oculta acto seguido si estaba cerrado. Ese
 * parpadeo de un frame es el mismo patrón que un aviso de cookies y es
 * preferible a la alternativa (rehacer todo el layout como client component
 * solo para evitarlo).
 *
 * En cuanto el usuario crea su contraseña en /perfil, has_password() pasa a
 * true en la siguiente petición y Nav.tsx deja de montar este componente:
 * desaparece solo, sin que el cierre manual tenga que ver con eso.
 */
export function AvisoContrasena({ userId }: { userId: string }) {
  const clave = CLAVE_PREFIJO + userId;
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(clave) === '1') setCerrado(true);
    } catch {
      // Modo privado o localStorage bloqueado: no pasa nada, simplemente no
      // se recuerda el cierre entre sesiones.
    }
  }, [clave]);

  if (cerrado) return null;

  function cerrar() {
    setCerrado(true);
    try {
      window.localStorage.setItem(clave, '1');
    } catch {
      // Ver comentario de arriba: sin persistencia, volverá a verse la
      // próxima vez, que es un fallo razonable (no agresivo).
    }
  }

  return (
    <div className="mx-auto w-full max-w-wrap px-4 min-[720px]:px-8">
      <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-linea bg-white/90 px-4 py-3 shadow-nav backdrop-blur-[14px]">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-grad text-white"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 11V8a4 4 0 118 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-cuerpo">
          Entras con enlace mágico y aún no tienes contraseña.{' '}
          <Link href="/perfil#contrasena" className="font-semibold text-titular underline">
            Créate una
          </Link>{' '}
          para entrar sin depender del correo.
        </p>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-full p-1.5 text-gris transition-colors hover:bg-fondo hover:text-titular"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
