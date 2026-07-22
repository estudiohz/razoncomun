'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { marcarNotificacionesLeidasAction } from '@/app/notificaciones/actions';
import { cn } from '@/lib/cn';
import type { Notificacion } from '@/lib/participacion/notifications';

interface CampanitaProps {
  /** Últimas notificaciones (serializables), resueltas en Nav (server). */
  notificaciones: Notificacion[];
  /** No leídas en el momento del render del servidor. */
  noLeidas: number;
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Campanita de notificaciones in-app (D-P9, rc-06). Client component: solo
 * necesita estado del desplegable — los datos llegan ya resueltos desde Nav
 * (server) y "marcar leídas" usa un server action (sí se puede pasar).
 *
 * Visible en el nav público solo con sesión (Nav decide si se monta).
 */
export function Campanita({ notificaciones, noLeidas }: CampanitaProps) {
  const [abierto, setAbierto] = useState(false);
  const [contadorLocal, setContadorLocal] = useState(noLeidas);
  const [leidasLocal, setLeidasLocal] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
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

  function alAbrir() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente && contadorLocal > 0) {
      // Optimista: al abrir el panel se marcan todas como leídas.
      setContadorLocal(0);
      setLeidasLocal(new Set(notificaciones.map((n) => n.id)));
      startTransition(() => {
        void marcarNotificacionesLeidasAction();
      });
    }
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={alAbrir}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Notificaciones"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-linea bg-white/60 text-cuerpo transition-colors hover:border-titular hover:text-titular"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 16v-5a6 6 0 10-12 0v5l-1.5 2.5h15L18 16z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 21a2 2 0 004 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {contadorLocal > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-magenta px-1 text-[10px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {contadorLocal > 9 ? '9+' : contadorLocal}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="menu"
          aria-label="Notificaciones"
          className="absolute right-0 top-[calc(100%+10px)] max-h-[70vh] w-80 overflow-y-auto rounded-[14px] border border-linea bg-white py-1.5 shadow-nav"
        >
          <div className="border-b border-linea px-4 pb-2.5 pt-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-cuerpo/70">
              Notificaciones
            </p>
          </div>

          {notificaciones.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-cuerpo">Sin notificaciones todavía.</p>
          ) : (
            notificaciones.map((n) => {
              const noLeida = !n.read_at && !leidasLocal.has(n.id);
              const contenido = (
                <div
                  className={cn(
                    'flex flex-col gap-0.5 px-4 py-2.5 text-sm no-underline transition-colors hover:bg-fondo',
                    noLeida && 'bg-fondo/70',
                  )}
                >
                  <p className="font-semibold text-titular">{n.title}</p>
                  {n.body && <p className="text-cuerpo">{n.body}</p>}
                  <p className="text-[11px] text-cuerpo/70">{formatearFecha(n.created_at)}</p>
                </div>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  role="menuitem"
                  onClick={() => setAbierto(false)}
                  className="block no-underline"
                >
                  {contenido}
                </Link>
              ) : (
                <div key={n.id} role="menuitem">
                  {contenido}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
