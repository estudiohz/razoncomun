'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [montado, setMontado] = useState(false);
  const [instrucciones, setInstrucciones] = useState(false);
  // Si ya se abre como app instalada, el botón «Instalar app» sobra.
  const [instalada, setInstalada] = useState(false);
  useEffect(() => {
    setInstalada(
      window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
  }, []);

  // El overlay se renderiza con portal a <body> (ver más abajo). Solo podemos
  // portalar en cliente: marcamos el montaje para no tocar `document` en SSR.
  useEffect(() => setMontado(true), []);

  // Bloqueo de scroll del body + cierre con Escape mientras el overlay está abierto.
  useEffect(() => {
    if (!abierto) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setInstrucciones(false);
        setAbierto(false);
      }
    }
    document.addEventListener('keydown', alEscape);
    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  const cerrar = () => {
    setInstrucciones(false);
    setAbierto(false);
  };

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

      {abierto &&
        montado &&
        createPortal(
          // Portal a <body>: el nav padre tiene `backdrop-blur`, que crea un
          // containing block para position:fixed y anclaba el overlay a la barra
          // (dejándolo sin fondo a pantalla completa). Fuera de ese ancestro,
          // `fixed inset-0` cubre el viewport y `bg-fondo` pinta sólido.
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
                  href="/panel"
                  onClick={cerrar}
                  className="py-2 text-lg font-semibold text-cuerpo no-underline hover:text-titular"
                >
                  Mi panel
                </Link>
                <Link
                  href="/panel/perfil"
                  onClick={cerrar}
                  className="py-2 text-lg font-semibold text-cuerpo no-underline hover:text-titular"
                >
                  Mi perfil
                </Link>
                <Link
                  href="/panel/propuestas"
                  onClick={cerrar}
                  className="py-2 text-lg font-semibold text-cuerpo no-underline hover:text-titular"
                >
                  Mis propuestas
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
                  Accede
                </Link>
                <Link
                  href="/unete"
                  onClick={cerrar}
                  className="flex-1 rounded-boton bg-accion py-3 text-center text-base font-bold text-white no-underline shadow-boton"
                >
                  Únete
                </Link>
              </div>
            )}
          </div>

          {/* Redes sociales: una sola fila (8 iconos caben en 312 px) */}
          <div className="border-t border-linea px-6 py-5">
            <div className="flex flex-nowrap items-center justify-between gap-1">
              {redes.map((red) => (
                <a
                  key={red.nombre}
                  href={red.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={red.aria}
                  className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full border border-linea bg-white text-titular transition-colors hover:border-titular hover:text-tinta"
                >
                  <IconoRed nombre={red.icono} className={cn('h-4 w-4')} />
                </a>
              ))}
            </div>
            {!instalada && (
              <button
                type="button"
                onClick={() => setInstrucciones(true)}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-boton text-base font-bold text-white shadow-boton"
                style={{ background: 'linear-gradient(120deg,#6A1FB8,#8B30D9 45%,#C3369E)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><rect x="4" y="18" width="16" height="3" rx="1.5" />
                </svg>
                Instalar app
              </button>
            )}
          </div>

          {instrucciones && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-instalar"
              className="fixed inset-0 z-[70] flex flex-col overflow-y-auto px-6 pb-10 pt-6 text-white motion-safe:animate-[sube_.3s_ease]"
              style={{ background: 'linear-gradient(150deg,#1B3D9C 0%,#8B30D9 35%,#C3369E 60%,#E8792F 80%,#16B8A0 100%)' }}
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInstrucciones(false)}
                  aria-label="Cerrar instrucciones"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <h2 id="titulo-instalar" className="mt-6 text-[30px] font-extrabold leading-tight">Lleva Razón Común en tu móvil</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-white/90">Se instala en 10 segundos, sin pasar por ninguna tienda de apps.</p>

              <ol className="mt-8 space-y-4">
                {[
                  ['1', 'Pulsa «Compartir» en tu navegador', 'En iPhone (Safari) es el cuadrado con la flecha hacia arriba, abajo en la pantalla. En Android (Chrome) son los tres puntos de arriba a la derecha.'],
                  ['2', 'Elige «Añadir a pantalla de inicio»', 'En Android también puede aparecer como «Instalar aplicación».'],
                  ['3', 'Confirma con «Añadir»', 'El icono de Razón Común aparecerá junto a tus otras apps.'],
                ].map(([n, t, d]) => (
                  <li key={n} className="flex gap-4 rounded-[16px] bg-white/15 p-4 backdrop-blur">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white text-[16px] font-extrabold text-[#8B30D9]">{n}</span>
                    <span>
                      <span className="block text-[17px] font-bold">{t}</span>
                      <span className="mt-1 block text-[14px] leading-snug text-white/85">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <button
                type="button"
                onClick={() => setInstrucciones(false)}
                className="mt-8 min-h-[48px] rounded-boton bg-white text-base font-bold text-[#6A1FB8]"
              >
                Entendido
              </button>
            </div>
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}
