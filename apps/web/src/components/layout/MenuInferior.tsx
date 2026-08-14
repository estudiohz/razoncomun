'use client';

import { usePathname } from 'next/navigation';
import { useEsApp } from '@/lib/useEsApp';
import { LiquidTabBar, type ItemBarraLiquida } from '@/components/nav/LiquidTabBar';

/**
 * Menú inferior fijo de la app (móvil, <960px), con el diseño "líquido"
 * (LiquidTabBar): la sección activa es una bola que hunde el borde superior.
 *
 * Los cinco destinos (para quien está en modo app, el único que lo ve):
 * - Inicio es el PANEL, no la home corporativa (el logueado entra al entorno
 *   colaborativo, no a la portada de captación).
 * - Propuestas: donde se participa a diario.
 * - El mes: la encuesta del mes (0040) — el centro, a lo que se llega en dos toques.
 * - Cambios: el bucle de retorno.
 * - Perfil: datos, contraseña, afiliación.
 *
 * No se monta en /admin (tiene su propio chrome) ni fuera del modo app. El
 * choque con el widget de chat no aplica: ChatSoloVisitantes ya lo oculta en
 * modo app (ambos usan useEsApp en espejo, nunca coinciden).
 */
export function MenuInferior() {
  const pathname = usePathname() ?? '/';
  const esApp = useEsApp();
  if (pathname.startsWith('/admin') || !esApp) return null;

  const items: ItemBarraLiquida[] = [
    { href: '/panel', label: 'Inicio', exacto: true, icono: <IconoInicio /> },
    { href: '/propuestas', label: 'Propuestas', icono: <IconoPropuestas /> },
    { href: '/mes', label: 'El mes', icono: <IconoMes /> },
    { href: '/cambios', label: 'Cambios', icono: <IconoCambios /> },
    { href: '/panel/perfil', label: 'Perfil', icono: <IconoTu /> },
  ];

  return (
    <>
      {/* Reserva el hueco de la barra fija: sin esto, el final de cada página
          quedaría tapado por la barra flotante. Se corresponde con la altura
          de la LiquidTabBar (64px) + su despegue inferior + el safe-area. */}
      <div aria-hidden className="h-[calc(70px+env(safe-area-inset-bottom))] min-[960px]:hidden" />
      <LiquidTabBar items={items} />
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
