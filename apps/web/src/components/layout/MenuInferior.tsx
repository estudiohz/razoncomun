'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useEsApp } from '@/lib/useEsApp';

/**
 * Menú inferior fijo de la app (móvil, <960px). El elemento central y
 * prominente es "El mes" — la encuesta del mes (0040), que es a lo que Sergio
 * quiere que se llegue en dos toques desde el icono de la app.
 *
 * Los otros cuatro (para quien está en modo app, que es el único que lo ve):
 * - Inicio es el PANEL, no la home corporativa — decisión de Sergio: el
 *   logueado entra a un entorno colaborativo, no a la portada de captación
 *   (que además le redirige aquí desde el middleware).
 * - Propuestas: donde se participa a diario.
 * - Cambios: el bucle de retorno a un toque es lo que lo hace creíble.
 * - Perfil: datos, contraseña, afiliación.
 *
 * No se monta en /admin: el panel de administración tiene su propio chrome y
 * este menú es de la app ciudadana. En escritorio (≥960px) desaparece — ahí
 * está la nav superior completa.
 */
const ITEMS_IZQ = [
  { href: '/panel', label: 'Inicio', exacto: true, icono: IconoInicio },
  { href: '/propuestas', label: 'Propuestas', icono: IconoPropuestas },
] as const;

const ITEMS_DER = [
  { href: '/cambios', label: 'Cambios', icono: IconoCambios },
  { href: '/panel/perfil', label: 'Perfil', icono: IconoTu },
] as const;

export function MenuInferior() {
  const pathname = usePathname() ?? '/';
  const esApp = useEsApp();
  // Solo en "modo app" (instalada como PWA o con sesión): el visitante
  // anónimo de navegador ve la web corporativa limpia — y el widget de chat,
  // que ocupa justo la esquina que aquí taparíamos.
  if (pathname.startsWith('/admin') || !esApp) return null;

  const activo = (href: string, exacto?: boolean) =>
    exacto ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const item = (i: { href: string; label: string; exacto?: boolean; icono: () => React.ReactElement }) => (
    <Link
      key={i.href}
      href={i.href}
      aria-current={activo(i.href, i.exacto) ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[10.5px] font-bold leading-none no-underline',
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
      <div aria-hidden className="h-[calc(74px+env(safe-area-inset-bottom))] min-[960px]:hidden" />

      <nav
        aria-label="Menú de la app"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-linea bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur min-[960px]:hidden"
      >
        {/* items-end + mismo padding inferior en todos: así TODAS las
            etiquetas (incluida "El mes") comparten línea base. El botón
            central sube con margen negativo, no con `relative -top-4`, que
            arrastraba también su texto y lo desalineaba. Barra 10px más alta
            para que la burbuja elevada quepa sin recortarse (petición de
            Sergio, 02/08/2026). */}
        <div className="mx-auto flex h-[74px] max-w-[520px] items-end px-1">
          {ITEMS_IZQ.map(item)}

          {/* El centro: la encuesta del mes, elevada y con el degradado del aro. */}
          <Link
            href="/mes"
            aria-current={activo('/mes') ? 'page' : undefined}
            className="flex flex-col items-center gap-1 px-2 pb-2 no-underline"
          >
            <span
              className={cn(
                '-mt-5 grid h-[52px] w-[52px] place-items-center rounded-full bg-grad text-white shadow-boton ring-4 ring-white',
                activo('/mes') && 'ring-linea',
              )}
            >
              <IconoMes />
            </span>
            <span className={cn('text-[10.5px] font-bold leading-none', activo('/mes') ? 'text-titular' : 'text-gris')}>
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
