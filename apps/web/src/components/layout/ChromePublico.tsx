'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Decide si se pinta el chrome público (nav + `<main>` centrado + footer) o
 * no, según la ruta. `/admin` tiene su propio shell a pantalla completa
 * (app/admin/layout.tsx, estilo WP: sidebar fijo + contenido al 100%) — ahí
 * NO debe aparecer ni la nav ni el footer públicos.
 *
 * `nav` y `footer` llegan ya renderizados desde RootLayout (server
 * components pasados como children/props — patrón válido en App Router):
 * este wrapper solo decide si los monta o no, nunca los re-renderiza.
 *
 * `usePathname()` funciona en SSR en App Router (lee la URL de la petición
 * en el primer render de servidor de este client component), así que no hay
 * parpadeo: en `/admin` el HTML inicial ya sale sin nav/footer, no se
 * "quitan" tras hidratar.
 */
export function ChromePublico({
  nav,
  footer,
  children,
}: {
  nav: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const esAdmin = pathname?.startsWith('/admin') ?? false;

  if (esAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      {nav}
      <main>{children}</main>
      {footer}
    </>
  );
}
