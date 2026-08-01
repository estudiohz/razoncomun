'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Shell de navegación compartido por los dos paneles (D-U1,
 * docs/tecnico/panel-usuario.md): `/panel` (cualquier usuario logueado) y
 * `/admin` (editor/admin). Antes esto vivía solo dentro de
 * components/admin/AdminSidebar.tsx; se ha generalizado para que el panel del
 * usuario normal NO sea una segunda interfaz distinta, sino el mismo shell con
 * los apartados que su rol permite.
 *
 * Es deliberadamente "tonto": recibe los items ya calculados en servidor
 * (con su badge y su nota), no consulta roles ni sabe qué es un editor. Quien
 * decide qué entra en la lista es cada layout.
 */
export type ItemNavPanel = {
  href: string;
  label: string;
  /** Contador que se pinta a la derecha (reportes abiertos, borradores…). */
  badge?: number;
  /** Etiqueta gris a la derecha, p. ej. "solo admin". */
  nota?: string;
  /** Marca "activo" solo con coincidencia exacta (para las raíces /panel y /admin). */
  exacto?: boolean;
};

export type GrupoNavPanel = {
  /** Título del grupo; si se omite, los items van sueltos arriba. */
  titulo?: string;
  items: ItemNavPanel[];
};

function Enlaces({ grupos, onNavegar }: { grupos: GrupoNavPanel[]; onNavegar?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5">
      {grupos.map((grupo, i) => (
        <div key={grupo.titulo ?? `grupo-${i}`} className="space-y-1">
          {grupo.titulo && (
            <p className="px-3 pb-1 text-[10.5px] font-bold uppercase tracking-[.12em] text-gris">
              {grupo.titulo}
            </p>
          )}
          {grupo.items.map((item) => {
            const activo = item.exacto
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavegar}
                aria-current={activo ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-between rounded-boton px-3 py-2 text-[13.5px] font-semibold no-underline transition-colors',
                  activo ? 'bg-accion text-white' : 'text-cuerpo hover:bg-fondo hover:text-titular',
                )}
              >
                <span>{item.label}</span>
                <span className="flex items-center gap-1.5">
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="rounded-full bg-magenta px-2 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                  {item.nota && (
                    <span className="rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold text-gris">
                      {item.nota}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Sidebar de escritorio (≥960px), estilo WordPress: fijo, altura completa. */
export function PanelSidebar({
  grupos,
  homeHref,
  etiqueta,
}: {
  grupos: GrupoNavPanel[];
  homeHref: string;
  /** Chip junto al logo: "Panel", "Administración"… */
  etiqueta: string;
}) {
  return (
    <aside className="hidden shrink-0 border-r border-linea bg-panel min-[960px]:sticky min-[960px]:top-0 min-[960px]:flex min-[960px]:h-screen min-[960px]:w-[270px] min-[960px]:flex-col">
      {/* Logo y etiqueta apilados: en línea, una etiqueta larga como
          "Administración" no cabe junto al logo en 270px y se cortaba. */}
      <Link
        href={homeHref}
        className="flex shrink-0 flex-col items-start gap-2 border-b border-linea px-5 py-5 no-underline"
      >
        <Image src="/logo-rc.png" alt="Razón Común" width={162} height={26} className="h-[26px] w-auto" />
        <span className="rounded-full bg-fondo px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gris">
          {etiqueta}
        </span>
      </Link>
      <div className="flex-1 overflow-y-auto p-3">
        <Enlaces grupos={grupos} />
      </div>
    </aside>
  );
}

/** Burger + drawer de la misma navegación, solo en móvil (<960px). */
export function PanelMobileMenu({
  grupos,
  etiqueta,
}: {
  grupos: GrupoNavPanel[];
  etiqueta: string;
}) {
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
        aria-controls="panel-menu-movil"
        className="inline-flex items-center gap-2 rounded-boton border border-linea bg-panel px-3 py-2 text-[13px] font-bold text-titular transition-colors hover:border-titular"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Menú
      </button>

      {abierto && (
        <div
          id="panel-menu-movil"
          role="dialog"
          aria-modal="true"
          aria-label="Navegación del panel"
          className="fixed inset-0 z-[60] flex flex-col bg-fondo motion-safe:animate-[sube_.3s_ease]"
        >
          <div className="flex items-center justify-between border-b border-linea px-6 py-4">
            <span className="flex flex-col items-start gap-1.5">
              <Image src="/logo-rc.png" alt="Razón Común" width={149} height={24} className="h-[24px] w-auto" />
              <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gris">
                {etiqueta}
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
            <Enlaces grupos={grupos} onNavegar={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
