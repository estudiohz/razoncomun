'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { adminNav } from '@/lib/admin/nav';

/**
 * Lista de enlaces del panel — compartida por el sidebar de escritorio y el
 * drawer móvil, para que ambos rendericen exactamente la misma navegación.
 * `onNavegar` cierra el drawer al pulsar un enlace (en escritorio es no-op).
 */
function AdminNavLinks({
  esAdmin,
  onNavegar,
}: {
  esAdmin: boolean;
  onNavegar?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {adminNav.map((item) => {
        const activo = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        const bloqueado = item.soloAdmin && !esAdmin;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavegar}
            className={cn(
              'flex items-center justify-between rounded-boton px-3 py-2 text-[13.5px] font-semibold no-underline transition-colors',
              activo ? 'bg-accion text-white' : 'text-cuerpo hover:bg-fondo hover:text-titular',
            )}
          >
            <span>{item.label}</span>
            {bloqueado && (
              <span className="rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold text-gris">
                solo admin
              </span>
            )}
            {/* El label `item.dueño` (rc-05-blog, rc-06-participacion…) es una
                etiqueta interna de los agentes de construcción; se mantiene en
                el dato (nav.ts) pero NO se pinta en el submenú: no aporta al usuario. */}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Sidebar de escritorio (≥960px), estilo WordPress: panel fijo a la
 * izquierda que ocupa toda la altura de la ventana (`sticky top-0 h-screen`),
 * con la cabecera de marca arriba y la navegación scrolleable debajo. En
 * móvil se oculta por completo: la navegación pasa al burger de
 * `AdminMobileMenu` (en la barra superior), de modo que el contenido del
 * panel ocupa todo el ancho disponible.
 */
export function AdminSidebar({ esAdmin }: { esAdmin: boolean; esEditor: boolean }) {
  return (
    <aside className="hidden shrink-0 border-r border-linea bg-panel min-[960px]:sticky min-[960px]:top-0 min-[960px]:flex min-[960px]:h-screen min-[960px]:w-[270px] min-[960px]:flex-col">
      <Link href="/admin" className="flex shrink-0 items-center gap-2.5 border-b border-linea px-5 py-5 no-underline">
        <Image src="/logo-rc.png" alt="Razón Común" width={102} height={26} className="h-[26px] w-auto" />
        <span className="rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gris">
          Panel
        </span>
      </Link>
      <div className="flex-1 overflow-y-auto p-3">
        <AdminNavLinks esAdmin={esAdmin} />
      </div>
    </aside>
  );
}

/**
 * Burger + drawer de la navegación del panel, solo en móvil (<960px).
 * Va en la cabecera del panel; en escritorio no pinta nada.
 */
export function AdminMobileMenu({ esAdmin }: { esAdmin: boolean; esEditor: boolean }) {
  const [abierto, setAbierto] = useState(false);

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

  return (
    <div className="min-[960px]:hidden">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú del panel"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls="admin-menu-movil"
        className="inline-flex items-center gap-2 rounded-boton border border-linea bg-panel px-3 py-2 text-[13px] font-bold text-titular transition-colors hover:border-titular"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Menú del panel
      </button>

      {abierto && (
        <div
          id="admin-menu-movil"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación del panel"
          className="fixed inset-0 z-[60] flex flex-col bg-fondo motion-safe:animate-[sube_.3s_ease]"
        >
          <div className="flex items-center justify-between border-b border-linea px-6 py-4">
            <span className="flex items-center gap-2.5">
              <Image src="/logo-rc.png" alt="Razón Común" width={94} height={24} className="h-[24px] w-auto" />
              <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gris">
                Panel
              </span>
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar menú del panel"
              className="grid h-11 w-11 place-items-center rounded-full border border-linea bg-white text-titular transition-colors hover:border-titular"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AdminNavLinks esAdmin={esAdmin} onNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
