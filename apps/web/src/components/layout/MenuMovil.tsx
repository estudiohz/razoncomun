'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cerrarSesion } from '@/app/perfil/actions';
import { IconoRed } from '@/components/layout/iconos-redes';
import { cn } from '@/lib/cn';
import type { RedSocial } from '@/lib/site';

type ItemNav = { label: string; href: string };

export type SesionMovil = {
  nombre: string;
  inicial: string;
  mostrarAdmin: boolean;
} | null;

interface MenuMovilProps {
  navItems: readonly ItemNav[];
  redes: readonly RedSocial[];
  sesion: SesionMovil;
}

/**
 * Burger (solo <960px) + overlay a pantalla completa con la navegación
 * principal, la fila de redes sociales y las acciones según sesión.
 *
 * En escritorio (>=960px) el burger está oculto y este componente no pinta
 * nada visible: la nav de escritorio (enlaces + MenuUsuario/CTAs) manda.
 * Reutiliza `cerrarSesion` (rc-03) y la lógica de sesión que ya resuelve Nav.
 */
export function MenuMovil({ navItems, redes, sesion }: MenuMovilProps) {
  const [abierto, setAbierto] = useState(false);

  // Bloqueo de scroll del body + cierre con Escape mientras el overlay está abierto.
  useEffect(() => {
    if (!abierto) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('keydown', alEscape);
    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  const cerrar = () => setAbierto(false);

  return (
    <div className="min-[960px]:hidden">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls="menu-movil"
        className="grid h-11 w-11 place-items-center rounded-full border border-linea bg-white/60 text-titular transition-colors hover:border-titular"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {abierto && (
        <div
          id="menu-movil"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-0 z-[60] flex flex-col bg-fondo motion-safe:animate-[sube_.3s_ease]"
        >
          {/* Cabecera del overlay: marca + cerrar */}
          <div className="flex items-center justify-between px-6 pt-6">
            <span className="text-sm font-bold uppercase tracking-wide text-titular">Razón Común</span>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar menú"
              className="grid h-11 w-11 place-items-center rounded-full border border-linea bg-white text-titular transition-colors hover:border-titular"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Enlaces principales, grandes */}
          <nav className="flex flex-1 flex-col justify-center gap-1 px-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={cerrar}
                className="py-2 text-3xl font-bold text-titular no-underline transition-colors hover:text-tinta"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Acciones de sesión */}
          <div className="border-t border-linea px-6 py-5">
            {sesion ? (
              <div className="flex flex-col gap-1">
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full bg-grad text-base font-bold text-white"
                    aria-hidden="true"
                  >
                    {sesion.inicial}
                  </span>
                  <span className="truncate text-base font-semibold text-titular">
                    {sesion.nombre}
                  </span>
                </div>
                <Link
                  href="/perfil"
                  onClick={cerrar}
                  className="py-2 text-lg font-semibold text-cuerpo no-underline hover:text-titular"
                >
                  Perfil
                </Link>
                {sesion.mostrarAdmin && (
                  <Link
                    href="/admin"
                    onClick={cerrar}
                    className="py-2 text-lg font-semibold text-cuerpo no-underline hover:text-titular"
                  >
                    Admin
                  </Link>
                )}
                <form action={cerrarSesion}>
                  <button
                    type="submit"
                    className="py-2 text-lg font-semibold text-cuerpo transition-colors hover:text-magenta"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/entrar"
                  onClick={cerrar}
                  className="flex-1 rounded-boton border border-linea bg-white py-3 text-center text-base font-bold text-titular no-underline hover:border-titular"
                >
                  Entrar
                </Link>
                <Link
                  href="/afiliate"
                  onClick={cerrar}
                  className="flex-1 rounded-boton bg-accion py-3 text-center text-base font-bold text-white no-underline shadow-boton"
                >
                  Afíliate
                </Link>
              </div>
            )}
          </div>

          {/* Redes sociales */}
          <div className="flex flex-wrap items-center gap-3 border-t border-linea px-6 py-5">
            {redes.map((red) => (
              <a
                key={red.nombre}
                href={red.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={red.aria}
                className="grid h-11 w-11 place-items-center rounded-full border border-linea bg-white text-titular transition-colors hover:border-titular hover:text-tinta"
              >
                <IconoRed nombre={red.icono} className={cn('h-[18px] w-[18px]')} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
