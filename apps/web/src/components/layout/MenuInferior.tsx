'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Menú inferior fijo de la app (móvil, <960px). El elemento central y
 * prominente es "El mes" — la encuesta del mes (0040), que es a lo que Sergio
 * quiere que se llegue en dos toques desde el icono de la app.
 *
 * Los otros cuatro los elegí así:
 * - Inicio y Propuestas: el qué (leer) y el dónde participar a diario.
 * - Cambios: el bucle de retorno — que el resultado de participar esté a un
 *   toque es lo que lo hace creíble.
 * - Tú (/panel): todo lo personal (perfil, mis propuestas, afiliación) ya
 *   vive unificado ahí; un anónimo aterriza en /entrar por el middleware,
 *   que es exactamente el funnel deseado.
 *
 * No se monta en /admin: el panel de administración tiene su propio chrome y
 * este menú es de la app ciudadana. En escritorio (≥960px) desaparece — ahí
 * está la nav superior completa.
 */
const ITEMS_IZQ = [
  { href: '/', label: 'Inicio', exacto: true, icono: IconoInicio },
  { href: '/propuestas', label: 'Propuestas', icono: IconoPropuestas },
] as const;

const ITEMS_DER = [
  { href: '/cambios', label: 'Cambios', icono: IconoCambios },
  { href: '/panel', label: 'Tú', icono: IconoTu },
] as const;

export function MenuInferior() {
  const pathname = usePathname() ?? '/';
  if (pathname.startsWith('/admin')) return null;

  const activo = (href: string, exacto?: boolean) =>
    exacto ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const item = (i: { href: string; label: string; exacto?: boolean; icono: () => React.ReactElement }) => (
    <Link
      key={i.href}
      href={i.href}
      aria-current={activo(i.href, i.exacto) ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold no-underline',
        activo(i.href, i.exacto) ? 'text-titular' : 'text-gris',
      )}
    >
      <i.icono />
      {i.label}
    </Link>
  );

  return (
    <>
      {/* Reserva el hueco del menú en el flujo: sin esto, el footer y el final
          de cada página quedarían tapados por la barra fija. */}
      <div aria-hidden className="h-[calc(64px+env(safe-area-inset-bottom))] min-[960px]:hidden" />

      <nav
        aria-label="Menú de la app"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-linea bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[960px]:hidden"
      >
        <div className="mx-auto flex max-w-[520px] items-stretch px-1">
          {ITEMS_IZQ.map(item)}

          {/* El centro: la encuesta del mes, elevada y con el degradado del aro. */}
          <Link
            href="/mes"
            aria-current={activo('/mes') ? 'page' : undefined}
            className="relative -top-4 flex flex-col items-center gap-0.5 px-2 no-underline"
          >
            <span
              className={cn(
                'grid h-[52px] w-[52px] place-items-center rounded-full bg-grad text-white shadow-boton ring-4 ring-white',
                activo('/mes') && 'ring-linea',
              )}
            >
              <IconoMes />
            </span>
            <span className={cn('text-[10.5px] font-bold', activo('/mes') ? 'text-titular' : 'text-gris')}>
              El mes
            </span>
          </Link>

          {ITEMS_DER.map(item)}
        </div>
      </nav>
    </>
  );
}

function IconoInicio() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-6h-5v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}
function IconoPropuestas() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a6.5 6.5 0 00-3.6 11.9c.7.5 1.1 1.2 1.1 2V18h5v-1.1c0-.8.4-1.5 1.1-2A6.5 6.5 0 0012 3z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M10 21h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IconoMes() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.5 14.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoCambios() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12a8 8 0 11-2.3-5.6M20 4v4h-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconoTu() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M5 20c0-3.2 3.1-5.3 7-5.3s7 2.1 7 5.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
