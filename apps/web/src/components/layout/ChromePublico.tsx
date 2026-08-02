'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChatWidgetFlotante } from '@/components/chat/ChatWidgetFlotante';
import { useEsApp } from '@/lib/useEsApp';

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
  // Los dos paneles con shell propio: /admin (editor/admin) y /panel
  // (cualquier usuario logueado, ola U1). Ambos traen su propio sidebar y
  // cabecera a pantalla completa, así que aquí no se pinta nav ni footer.
  const esPanel =
    (pathname?.startsWith('/admin') ?? false) || (pathname?.startsWith('/panel') ?? false);
  // /pregunta ya tiene el chat completo (PreguntaChat.tsx) — evitar duplicar la UI.
  const esPregunta = pathname?.startsWith('/pregunta') ?? false;

  if (esPanel) {
    return <>{children}</>;
  }

  return (
    <>
      {nav}
      <main>{children}</main>
      {footer}
      {!esPregunta && <ChatSoloVisitantes />}
    </>
  );
}

/**
 * El widget flotante es la herramienta de CAPTAR al visitante; en "modo app"
 * (sesión o PWA instalada) sobra — el logueado tiene "Pregunta a la IA" en el
 * menú — y además su burbuja tapaba el elemento derecho del menú inferior en
 * móvil (reporte de Sergio, 02/08/2026). Como ambas superficies usan el mismo
 * hook en espejo, nunca coinciden.
 */
function ChatSoloVisitantes() {
  const esApp = useEsApp();
  if (esApp !== false) return null;
  return <ChatWidgetFlotante />;
}
