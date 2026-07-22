'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cerrarSesion } from '@/app/perfil/actions';
import { cn } from '@/lib/cn';

interface MenuUsuarioProps {
  /** Nombre a mostrar junto al avatar. */
  nombre: string;
  /** Inicial del avatar (letra ya calculada en servidor). */
  inicial: string;
  /** Muestra el enlace a /admin solo si el usuario es admin o editor. */
  mostrarAdmin: boolean;
}

/**
 * Menú de usuario de la cabecera cuando hay sesión: avatar con inicial +
 * nombre y desplegable (Perfil, Admin condicional, Cerrar sesión).
 *
 * Es client porque el desplegable necesita estado, cierre al hacer clic fuera
 * y con Escape. El resto de la Nav sigue siendo server. El cierre de sesión
 * reutiliza la server action `cerrarSesion` de rc-03 vía <form action>, no
 * inventa un flujo propio.
 */
export function MenuUsuario({ nombre, inicial, mostrarAdmin }: MenuUsuarioProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function alClicFuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }

    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  const itemClase =
    'flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-cuerpo no-underline transition-colors hover:bg-fondo hover:text-titular';

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-2.5 rounded-full border border-linea bg-white/60 py-1 pl-1 pr-2.5 transition-colors hover:border-titular"
      >
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-grad text-sm font-bold text-white"
          aria-hidden="true"
        >
          {inicial}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-semibold text-titular min-[720px]:inline">
          {nombre}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={cn('text-cuerpo transition-transform duration-200', abierto && 'rotate-180')}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          aria-label="Menú de usuario"
          className="absolute right-0 top-[calc(100%+10px)] w-56 overflow-hidden rounded-[14px] border border-linea bg-white py-1.5 shadow-nav"
        >
          <div className="border-b border-linea px-4 pb-2.5 pt-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cuerpo/70">
              Sesión iniciada
            </p>
            <p className="truncate text-sm font-semibold text-titular">{nombre}</p>
          </div>

          <Link href="/perfil" role="menuitem" className={itemClase} onClick={() => setAbierto(false)}>
            <IconoPerfil />
            Perfil
          </Link>

          <Link href="/propuestas/mias" role="menuitem" className={itemClase} onClick={() => setAbierto(false)}>
            <IconoPerfil />
            Mis hilos
          </Link>

          {mostrarAdmin && (
            <Link href="/admin" role="menuitem" className={itemClase} onClick={() => setAbierto(false)}>
              <IconoAdmin />
              Admin
            </Link>
          )}

          <form action={cerrarSesion} className="border-t border-linea">
            <button
              type="submit"
              role="menuitem"
              className={cn(itemClase, 'w-full text-left hover:text-magenta')}
            >
              <IconoSalir />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function IconoPerfil() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoAdmin() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l7 3v5c0 4.4-3 8.2-7 9.5C8 19.2 5 15.4 5 11V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoSalir() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 12H4m0 0l3.5-3.5M4 12l3.5 3.5M14 5h4a1 1 0 011 1v12a1 1 0 01-1 1h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
